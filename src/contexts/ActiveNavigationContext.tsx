import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { decodeHereFlexiblePolyline, type LngLat } from '@/lib/hereFlexiblePolyline';
import {
  calculateNavigationProgress,
  haversineDistance,
  matchPositionToRoute,
  type NavigationProgress,
  type RouteMatchResult,
} from '@/lib/navigationUtils';
import { useWakeLock } from '@/hooks/useWakeLock';
import { HereService, type RouteResponse, type GeocodeResult, DEFAULT_TRUCK_PROFILE, type TruckProfile } from '@/services/HereService';

const NAVIGATION_STATE_KEY = 'activeNavigation';

// Off-route detection thresholds (meters) with hysteresis to prevent ping-pong.
const OFF_ROUTE_THRESHOLD_M = 55;
const ON_ROUTE_THRESHOLD_M = 35;

// Confirmation requirements
const OFF_ROUTE_CONSECUTIVE_THRESHOLD = 3; // readings
const OFF_ROUTE_PERSIST_TIME_MS = 4000; // must stay off-route for this duration

// If GPS accuracy is very poor, don't trust off-route detection.
const MAX_ACCURACY_FOR_OFF_ROUTE_M = 120;

// Search window for route matching (segments around last match)
const ROUTE_MATCH_WINDOW = 90;

// Soft snap strength (0..1). Higher = stronger pull toward route.
const SNAP_MAX_BLEND = 0.6;
const SNAP_MAX_DISTANCE_M = 80;

// NOTE: REROUTE_COOLDOWN_MS remains conservative to avoid loops.
const REROUTE_COOLDOWN_MS = 45000; // 45 seconds minimum between reroutes

// --- Course-over-ground (COG) navigation model ---
// IMPORTANT: We intentionally ignore any native heading/compass values and derive heading
// exclusively from displacement between consecutive GPS fixes.
const MIN_COG_SPEED_MPS = 0.8; // ~3 km/h
const MIN_COG_DISTANCE_M = 3; // meters between fixes to compute bearing
const MAX_REASONABLE_SPEED_MPS = 60; // ~216 km/h (spike rejection)
const HEADING_SMOOTH_FACTOR = 0.22; // 0..1
const SPEED_SMOOTH_FACTOR = 0.3; // 0..1

function calculateBearingBetweenPoints(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lng2 - lng1);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function angularDifference(a: number, b: number): number {
  let diff = b - a;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return diff;
}

function smoothAngle(current: number, target: number, factor: number): number {
  const diff = angularDifference(current, target);
  return (current + diff * factor + 360) % 360;
}

interface NavigationState {
  route: RouteResponse;
  origin: GeocodeResult;
  destination: GeocodeResult;
  startedAt: number;
  truckProfile: TruckProfile;
}

export interface UserPosition {
  lat: number;
  lng: number;
  heading: number | null; // GPS course/bearing in degrees (0-360, 0 = North)
  speed: number | null; // Speed in m/s
  accuracy: number | null;
}

interface ActiveNavigationContextValue {
  isNavigating: boolean;
  route: RouteResponse | null;
  routeCoords: LngLat[];
  origin: GeocodeResult | null;
  destination: GeocodeResult | null;
  userPosition: UserPosition | null;
  progress: NavigationProgress | null;
  truckProfile: TruckProfile;
  isRerouting: boolean;
  isOffRoute: boolean;
  isSimulating: boolean;
  startNavigation: (route: RouteResponse, origin: GeocodeResult, destination: GeocodeResult, profile?: TruckProfile) => void;
  endNavigation: () => void;
  setSimulatedPosition: (position: UserPosition | null) => void;
  setIsSimulating: (simulating: boolean) => void;
  positionError: string | null;
}

const ActiveNavigationContext = createContext<ActiveNavigationContextValue | undefined>(undefined);

export function ActiveNavigationProvider({ children }: { children: React.ReactNode }) {
  const [route, setRoute] = useState<RouteResponse | null>(null);
  const [routeCoords, setRouteCoords] = useState<LngLat[]>([]);
  const [origin, setOrigin] = useState<GeocodeResult | null>(null);
  const [destination, setDestination] = useState<GeocodeResult | null>(null);
  const [userPosition, setUserPosition] = useState<UserPosition | null>(null);
  const [simulatedPosition, setSimulatedPosition] = useState<UserPosition | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Raw fix history (for COG) + filtered fix (for stable nav)
  const lastRawFixRef = useRef<{ lat: number; lng: number; time: number } | null>(null);
  const filteredFixRef = useRef<{ lat: number; lng: number; time: number } | null>(null);
  const lastValidHeadingRef = useRef<number | null>(null);
  const smoothedHeadingRef = useRef<number | null>(null);
  const smoothedSpeedRef = useRef<number>(0);

  const [progress, setProgress] = useState<NavigationProgress | null>(null);
  const [positionError, setPositionError] = useState<string | null>(null);
  const [truckProfile, setTruckProfile] = useState<TruckProfile>(DEFAULT_TRUCK_PROFILE);
  const [isRerouting, setIsRerouting] = useState(false);
  const [isOffRoute, setIsOffRoute] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const lastRerouteTime = useRef<number>(0);
  const offRouteCountRef = useRef<number>(0); // Consecutive off-route detections
  const offRouteStartTimeRef = useRef<number | null>(null); // When off-route started
  const isReroutingRef = useRef<boolean>(false); // Prevent concurrent reroutes
  const isNavigating = route !== null;

  // Use simulated position if simulating, otherwise real position
  const effectivePosition = isSimulating ? simulatedPosition : userPosition;

  // Keep screen on during navigation
  useWakeLock(isNavigating);

  // Restore navigation state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(NAVIGATION_STATE_KEY);
      if (saved) {
        const state: NavigationState = JSON.parse(saved);
        // Only restore if less than 8 hours old
        if (Date.now() - state.startedAt < 8 * 60 * 60 * 1000) {
          setRoute(state.route);
          setRouteCoords(decodeHereFlexiblePolyline(state.route.polyline));
          setOrigin(state.origin);
          setDestination(state.destination);
          setTruckProfile(state.truckProfile || DEFAULT_TRUCK_PROFILE);
        } else {
          localStorage.removeItem(NAVIGATION_STATE_KEY);
        }
      }
    } catch {
      localStorage.removeItem(NAVIGATION_STATE_KEY);
    }
  }, []);

  // Start watching position when navigating (only if not simulating)
  useEffect(() => {
    if (!isNavigating || isSimulating) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (!('geolocation' in navigator)) {
      setPositionError('Geolocation not supported');
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, heading: gpsHeading, speed: gpsSpeed, accuracy } = pos.coords;
        
        // Calculate heading from movement if GPS heading is not available
        let calculatedHeading = gpsHeading;
        const now = Date.now();
        
        if (lastRawFixRef.current && (gpsHeading === null || gpsHeading === undefined)) {
          const timeDelta = (now - lastRawFixRef.current.time) / 1000; // seconds
          if (timeDelta > 0 && timeDelta < 5) { // Only calculate if reasonable time gap
            const distance = haversineDistance(
              lastRawFixRef.current.lat,
              lastRawFixRef.current.lng,
              latitude,
              longitude
            );
            
            // Only calculate if there's meaningful movement
            if (distance > MIN_COG_DISTANCE_M) {
              // Calculate bearing from movement using helper
              calculatedHeading = calculateBearingBetweenPoints(
                lastRawFixRef.current.lat,
                lastRawFixRef.current.lng,
                latitude,
                longitude
              );
              lastValidHeadingRef.current = calculatedHeading;
            } else if (lastValidHeadingRef.current !== null) {
              // Keep last valid heading if not moving enough
              calculatedHeading = lastValidHeadingRef.current;
            }
          }
        } else if (lastValidHeadingRef.current !== null && (gpsHeading === null || gpsHeading === undefined)) {
          calculatedHeading = lastValidHeadingRef.current;
        }
        
        // Smooth heading
        if (typeof calculatedHeading === 'number' && smoothedHeadingRef.current !== null) {
          calculatedHeading = smoothAngle(smoothedHeadingRef.current, calculatedHeading, HEADING_SMOOTH_FACTOR);
        }
        if (typeof calculatedHeading === 'number') {
          smoothedHeadingRef.current = calculatedHeading;
        }
        
        // Smooth speed
        const rawSpeed = gpsSpeed ?? 0;
        smoothedSpeedRef.current = smoothedSpeedRef.current * (1 - SPEED_SMOOTH_FACTOR) + rawSpeed * SPEED_SMOOTH_FACTOR;
        
        lastRawFixRef.current = { lat: latitude, lng: longitude, time: now };
        
        setUserPosition({
          lat: latitude,
          lng: longitude,
          heading: calculatedHeading ?? null,
          speed: gpsSpeed ?? null,
          accuracy: accuracy ?? null,
        });
        setPositionError(null);
      },
      (err) => {
        console.error('Geolocation error:', err);
        setPositionError(err.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 500, // Reduced from 2000ms for fresher data
        timeout: 10000,
      }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isNavigating, isSimulating]);

  // Route matching + off-route detection + reroute (robust, with hysteresis)
  const lastMatchRef = useRef<RouteMatchResult | null>(null);
  const onRouteCountRef = useRef<number>(0);
  const lastClosestSegRef = useRef<number | null>(null);
  const lastDebugLogRef = useRef<number>(0);

  const checkAndReroute = useCallback(
    async (
      rawPosition: { lat: number; lng: number; accuracy: number | null },
      match: RouteMatchResult,
      isProgressingAlongRoute: boolean
    ) => {
      if (!destination || !route || routeCoords.length < 2) return;

      // Prevent concurrent reroutes
      if (isReroutingRef.current || isRerouting) return;

      const now = Date.now();

      // Don't even consider rerouting during cooldown period
      if (now - lastRerouteTime.current < REROUTE_COOLDOWN_MS) {
        return;
      }

      const accuracy = rawPosition.accuracy;
      const accuracyTooPoor = typeof accuracy === 'number' && accuracy > MAX_ACCURACY_FOR_OFF_ROUTE_M;

      // Dynamic thresholds based on reported accuracy (when available)
      const offThreshold = Math.max(
        OFF_ROUTE_THRESHOLD_M,
        typeof accuracy === 'number' ? accuracy * 1.5 : OFF_ROUTE_THRESHOLD_M
      );
      const onThreshold = Math.max(
        ON_ROUTE_THRESHOLD_M,
        typeof accuracy === 'number' ? accuracy * 1.0 : ON_ROUTE_THRESHOLD_M
      );

      const distToRoute = match.distanceToRouteM;

      // --- Diagnostics (throttled) ---
      if (now - lastDebugLogRef.current > 2000) {
        lastDebugLogRef.current = now;
        console.log('[NAV_DIAG]', {
          raw: { lat: rawPosition.lat, lng: rawPosition.lng, acc: rawPosition.accuracy },
          matched: { lat: match.matchedLat, lng: match.matchedLng },
          distToRouteM: Math.round(distToRoute),
          thresholds: { off: Math.round(offThreshold), on: Math.round(onThreshold) },
          isOffRoute,
          offRouteCount: offRouteCountRef.current,
          onRouteCount: onRouteCountRef.current,
          progressing: isProgressingAlongRoute,
          closestSeg: match.closestSegmentIndex,
        });
      }

      // If GPS accuracy is too poor, avoid toggling off-route; keep state stable.
      if (accuracyTooPoor) {
        return;
      }

      // Sanity check: if we're steadily progressing along the route, do not mark off-route
      // unless deviation is very large.
      const progressingGuard = isProgressingAlongRoute && distToRoute < offThreshold * 1.8;

      const isClearlyOff = distToRoute > offThreshold;
      const isClearlyOn = distToRoute < onThreshold;

      if (!progressingGuard && isClearlyOff) {
        // Start or continue off-route timer
        if (offRouteStartTimeRef.current === null) {
          offRouteStartTimeRef.current = now;
          offRouteCountRef.current = 1;
          onRouteCountRef.current = 0;
        } else {
          offRouteCountRef.current += 1;
          onRouteCountRef.current = 0;
        }

        const offRouteDuration = now - offRouteStartTimeRef.current;

        // Visually show off-route but don't reroute yet
        setIsOffRoute(true);

        // Confirmed off-route (time + count)
        if (
          offRouteDuration >= OFF_ROUTE_PERSIST_TIME_MS &&
          offRouteCountRef.current >= OFF_ROUTE_CONSECUTIVE_THRESHOLD
        ) {
          // Lock to prevent concurrent calls
          isReroutingRef.current = true;
          setIsRerouting(true);
          lastRerouteTime.current = now;
          offRouteCountRef.current = 0;
          onRouteCountRef.current = 0;
          offRouteStartTimeRef.current = null;

          try {
            console.log('[NAV_DIAG] reroute_requested', {
              distToRouteM: Math.round(distToRoute),
              accuracy,
              closestSeg: match.closestSegmentIndex,
            });

            const newRoute = await HereService.calculateRoute({
              originLat: rawPosition.lat,
              originLng: rawPosition.lng,
              destLat: destination.lat,
              destLng: destination.lng,
              transportMode: 'truck',
              truckProfile,
            });

            setRoute(newRoute);
            setRouteCoords(decodeHereFlexiblePolyline(newRoute.polyline));

            // Update origin to current position
            const newOrigin: GeocodeResult = {
              id: 'reroute-origin',
              title: 'Current Location',
              address: `${rawPosition.lat.toFixed(4)}, ${rawPosition.lng.toFixed(4)}`,
              lat: rawPosition.lat,
              lng: rawPosition.lng,
            };
            setOrigin(newOrigin);

            // Save updated state
            const state: NavigationState = {
              route: newRoute,
              origin: newOrigin,
              destination,
              startedAt: Date.now(),
              truckProfile,
            };
            localStorage.setItem(NAVIGATION_STATE_KEY, JSON.stringify(state));

            setIsOffRoute(false);
          } catch (error) {
            console.error('Reroute failed:', error);
          } finally {
            setIsRerouting(false);
            isReroutingRef.current = false;
          }
        }
      } else if (isClearlyOn || progressingGuard) {
        // Back on route - require a couple confirmations (hysteresis)
        offRouteCountRef.current = 0;
        offRouteStartTimeRef.current = null;
        onRouteCountRef.current += 1;

        if (onRouteCountRef.current >= 2) {
          setIsOffRoute(false);
        }
      }
    },
    [destination, route, routeCoords, isRerouting, truckProfile, isOffRoute]
  );

  // Update progress when position changes (throttled)
  const lastProgressUpdate = useRef<number>(0);

  useEffect(() => {
    if (!effectivePosition || !route || routeCoords.length < 2) {
      setProgress(null);
      return;
    }

    // Throttle updates to max once per second
    const now = Date.now();
    if (now - lastProgressUpdate.current < 1000) return;
    lastProgressUpdate.current = now;

    // IMPORTANT: effectivePosition is already filtered/stabilized in the core.
    // Use it consistently for map-matching, progress, and off-route validation.
    const filteredLat = effectivePosition.lat;
    const filteredLng = effectivePosition.lng;

    // --- Map-matching (soft snap) ---
    const baseMatch = matchPositionToRoute(filteredLng, filteredLat, routeCoords, {
      searchFromIndex: lastMatchRef.current?.closestSegmentIndex,
      searchWindow: ROUTE_MATCH_WINDOW,
      step: 2,
    });

    // Blend toward route to avoid hard snapping
    const blend = Math.min(
      SNAP_MAX_BLEND,
      Math.max(0, (SNAP_MAX_DISTANCE_M - baseMatch.distanceToRouteM) / SNAP_MAX_DISTANCE_M) * SNAP_MAX_BLEND
    );

    const matchedLat = filteredLat + (baseMatch.matchedLat - filteredLat) * blend;
    const matchedLng = filteredLng + (baseMatch.matchedLng - filteredLng) * blend;

    const match: RouteMatchResult = {
      ...baseMatch,
      matchedLat,
      matchedLng,
    };

    lastMatchRef.current = match;

    // Progress is computed against matched coordinates (more stable)
    const newProgress = calculateNavigationProgress(
      match.matchedLng,
      match.matchedLat,
      routeCoords,
      route.instructions,
      route.distance,
      route.duration
    );

    setProgress(newProgress);

    // Progress sanity check: closest segment index should generally increase as you move.
    const lastSeg = lastClosestSegRef.current;
    const isProgressing = lastSeg === null ? true : match.closestSegmentIndex >= lastSeg - 2;
    lastClosestSegRef.current = match.closestSegmentIndex;

    // Check if off route (only for real navigation, not simulation)
    if (!isSimulating) {
      checkAndReroute(
        { lat: filteredLat, lng: filteredLng, accuracy: effectivePosition.accuracy ?? null },
        match,
        isProgressing
      );
    }
  }, [effectivePosition, route, routeCoords, isSimulating, checkAndReroute]);

  const startNavigation = useCallback(
    (newRoute: RouteResponse, newOrigin: GeocodeResult, newDest: GeocodeResult, profile?: TruckProfile) => {
      const usedProfile = profile || DEFAULT_TRUCK_PROFILE;
      
      setRoute(newRoute);
      setRouteCoords(decodeHereFlexiblePolyline(newRoute.polyline));
      setOrigin(newOrigin);
      setDestination(newDest);
      setTruckProfile(usedProfile);
      setIsOffRoute(false);
      setIsRerouting(false);

      const state: NavigationState = {
        route: newRoute,
        origin: newOrigin,
        destination: newDest,
        startedAt: Date.now(),
        truckProfile: usedProfile,
      };
      localStorage.setItem(NAVIGATION_STATE_KEY, JSON.stringify(state));
    },
    []
  );

  const endNavigation = useCallback(() => {
    setRoute(null);
    setRouteCoords([]);
    setOrigin(null);
    setDestination(null);
    setUserPosition(null);
    setSimulatedPosition(null);
    setIsSimulating(false);
    setProgress(null);
    setIsOffRoute(false);
    setIsRerouting(false);
    localStorage.removeItem(NAVIGATION_STATE_KEY);
  }, []);

  return (
    <ActiveNavigationContext.Provider
      value={{
        isNavigating,
        route,
        routeCoords,
        origin,
        destination,
        userPosition: effectivePosition,
        progress,
        truckProfile,
        isRerouting,
        isOffRoute,
        isSimulating,
        startNavigation,
        endNavigation,
        setSimulatedPosition,
        setIsSimulating,
        positionError,
      }}
    >
      {children}
    </ActiveNavigationContext.Provider>
  );
}

export function useActiveNavigation(): ActiveNavigationContextValue {
  const ctx = useContext(ActiveNavigationContext);
  if (ctx === undefined) {
    throw new Error('useActiveNavigation must be used within ActiveNavigationProvider');
  }
  return ctx;
}
