import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { decodePolyline, type LngLat } from '@/lib/polylineDecoder';
import {
  calculateNavigationProgress,
  haversineDistance,
  matchPositionToRoute,
  type NavigationProgress,
  type RouteMatchResult,
} from '@/lib/navigationUtils';
import { useWakeLock } from '@/hooks/useWakeLock';
import { useRerouteController } from '@/hooks/useRerouteController';
import { HereService, type RouteResponse, type GeocodeResult, DEFAULT_TRUCK_PROFILE, type TruckProfile } from '@/services/HereService';

const NAVIGATION_STATE_KEY = 'activeNavigation';
const DETOUR_STATE_KEY = 'detourStop';

// === ULTRA-CONSERVATIVE ANTI-REROUTE CONFIGURATION ===
// Match Trucker Path behavior - virtually no false reroutes

// Off-route detection with VERY HIGH thresholds
const OFF_ROUTE_THRESHOLD_M = 50; // Must be 50+ meters off route
const ON_ROUTE_THRESHOLD_M = 25; // Back on route threshold

// Low speed tolerance - at parking lots, yards, exits
const LOW_SPEED_THRESHOLD_MPS = 6.7; // ~15 mph - below this = parking mode
const LOW_SPEED_OFF_ROUTE_M = 80; // 80m tolerance at low speed

// Confirmation requirements - EXTREMELY conservative
const OFF_ROUTE_CONSECUTIVE_THRESHOLD = 8; // Need 8 readings
const OFF_ROUTE_PERSIST_TIME_MS = 8000; // Must stay off-route for 8 SECONDS
const MIN_SPEED_FOR_REROUTE_MPS = 6.7; // Must be going > 15 mph to trigger reroute

// Accuracy filter - only trust good GPS
const MAX_ACCURACY_FOR_OFF_ROUTE_M = 25; // Don't trust GPS with >25m accuracy

// Search window for route matching
const ROUTE_MATCH_WINDOW = 90;

// Soft snap for visual smoothness
const SNAP_MAX_BLEND = 0.7;
const SNAP_MAX_DISTANCE_M = 50;

// 30 SECOND cooldown - absolute block
const REROUTE_COOLDOWN_MS = 30000; // 30 seconds minimum

// Detour arrival detection
const DETOUR_ARRIVAL_DISTANCE_M = 200;
const DETOUR_ARRIVAL_DWELL_TIME_MS = 10000;
const DETOUR_COOLDOWN_MS = 120000;

// Course-over-ground settings - optimized for smooth heading
const MIN_COG_SPEED_MPS = 1.0; // ~3.6 km/h
const MIN_COG_DISTANCE_M = 3;
const MAX_REASONABLE_SPEED_MPS = 55; // ~200 km/h (spike rejection)
const HEADING_SMOOTH_FACTOR = 0.15;
const SPEED_SMOOTH_FACTOR = 0.2;

// Position update throttling - 1 update per second max
const MIN_POSITION_UPDATE_MS = 1000; // REDUCED to 1 update/second

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

// Detour stop - temporary waypoint
export interface DetourStop {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  addedAt: number;
  completed: boolean;
}

// Original trip saved while on detour
interface OriginalTrip {
  route: RouteResponse;
  origin: GeocodeResult;
  destination: GeocodeResult;
  truckProfile: TruckProfile;
}

export interface UserPosition {
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
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
  // Detour functionality
  detourStop: DetourStop | null;
  hasActiveTrip: boolean;
  isOnDetour: boolean;
  addDetourStop: (poi: { lat: number; lng: number; name: string; address?: string }) => Promise<void>;
  cancelDetour: () => Promise<void>;
  // Original methods
  startNavigation: (route: RouteResponse, origin: GeocodeResult, destination: GeocodeResult, profile?: TruckProfile) => void;
  endNavigation: () => void;
  navigateToPoi: (poi: { lat: number; lng: number; name: string; address?: string }) => Promise<void>;
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

  // Detour state
  const [detourStop, setDetourStop] = useState<DetourStop | null>(null);
  const [originalTrip, setOriginalTrip] = useState<OriginalTrip | null>(null);
  const detourArrivalStartRef = useRef<number | null>(null);
  const lastDetourCompletedRef = useRef<number>(0);

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
  const offRouteCountRef = useRef<number>(0);
  const offRouteStartTimeRef = useRef<number | null>(null);
  const isReroutingRef = useRef<boolean>(false);
  const isNavigating = route !== null;
  const hasActiveTrip = originalTrip !== null || (isNavigating && !detourStop);
  const isOnDetour = detourStop !== null && !detourStop.completed;

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
        if (Date.now() - state.startedAt < 8 * 60 * 60 * 1000) {
          setRoute(state.route);
          setRouteCoords(decodePolyline(state.route.polyline));
          setOrigin(state.origin);
          setDestination(state.destination);
          setTruckProfile(state.truckProfile || DEFAULT_TRUCK_PROFILE);
        } else {
          localStorage.removeItem(NAVIGATION_STATE_KEY);
        }
      }

      // Restore detour state
      const savedDetour = localStorage.getItem(DETOUR_STATE_KEY);
      if (savedDetour) {
        const detourData = JSON.parse(savedDetour);
        if (detourData.detourStop && !detourData.detourStop.completed) {
          setDetourStop(detourData.detourStop);
          if (detourData.originalTrip) {
            setOriginalTrip(detourData.originalTrip);
          }
        } else {
          localStorage.removeItem(DETOUR_STATE_KEY);
        }
      }
    } catch {
      localStorage.removeItem(NAVIGATION_STATE_KEY);
      localStorage.removeItem(DETOUR_STATE_KEY);
    }
  }, []);

  // Initialize reroute controller
  const rerouteController = useRerouteController();

  // Last position update time for throttling
  const lastPositionUpdateRef = useRef<number>(0);

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
        const now = Date.now();
        
        // Throttle updates to prevent excessive processing
        if (now - lastPositionUpdateRef.current < MIN_POSITION_UPDATE_MS) {
          return;
        }
        
        const { latitude, longitude, heading: gpsHeading, speed: gpsSpeed, accuracy } = pos.coords;
        
        // === SPIKE REJECTION ===
        // Reject impossible jumps based on speed
        if (lastRawFixRef.current) {
          const timeDelta = (now - lastRawFixRef.current.time) / 1000;
          if (timeDelta > 0.1 && timeDelta < 30) {
            const distance = haversineDistance(
              lastRawFixRef.current.lat,
              lastRawFixRef.current.lng,
              latitude,
              longitude
            );
            const impliedSpeed = distance / timeDelta;
            
            // Reject if speed exceeds maximum possible
            if (impliedSpeed > MAX_REASONABLE_SPEED_MPS * 1.5) {
              console.log('[NAV] Spike rejected:', { 
                distance: Math.round(distance), 
                speed: Math.round(impliedSpeed),
                threshold: MAX_REASONABLE_SPEED_MPS * 1.5 
              });
              return;
            }
          }
        }
        
        lastPositionUpdateRef.current = now;
        
        // === COURSE-OVER-GROUND CALCULATION ===
        let calculatedHeading = gpsHeading;
        
        if (lastRawFixRef.current && (gpsHeading === null || gpsHeading === undefined)) {
          const timeDelta = (now - lastRawFixRef.current.time) / 1000;
          if (timeDelta > 0 && timeDelta < 5) {
            const distance = haversineDistance(
              lastRawFixRef.current.lat,
              lastRawFixRef.current.lng,
              latitude,
              longitude
            );
            
            if (distance > MIN_COG_DISTANCE_M) {
              calculatedHeading = calculateBearingBetweenPoints(
                lastRawFixRef.current.lat,
                lastRawFixRef.current.lng,
                latitude,
                longitude
              );
              lastValidHeadingRef.current = calculatedHeading;
            } else if (lastValidHeadingRef.current !== null) {
              calculatedHeading = lastValidHeadingRef.current;
            }
          }
        } else if (lastValidHeadingRef.current !== null && (gpsHeading === null || gpsHeading === undefined)) {
          calculatedHeading = lastValidHeadingRef.current;
        }
        
        // === HEADING SMOOTHING ===
        if (typeof calculatedHeading === 'number' && smoothedHeadingRef.current !== null) {
          calculatedHeading = smoothAngle(smoothedHeadingRef.current, calculatedHeading, HEADING_SMOOTH_FACTOR);
        }
        if (typeof calculatedHeading === 'number') {
          smoothedHeadingRef.current = calculatedHeading;
        }
        
        // === SPEED SMOOTHING ===
        const rawSpeed = gpsSpeed ?? 0;
        smoothedSpeedRef.current = smoothedSpeedRef.current * (1 - SPEED_SMOOTH_FACTOR) + rawSpeed * SPEED_SMOOTH_FACTOR;
        
        lastRawFixRef.current = { lat: latitude, lng: longitude, time: now };
        
        setUserPosition({
          lat: latitude,
          lng: longitude,
          heading: calculatedHeading ?? null,
          speed: smoothedSpeedRef.current, // Use smoothed speed
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
        maximumAge: 0, // Always get fresh position for navigation
        timeout: 10000, // 10 second timeout
      }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isNavigating, isSimulating]);

  // Detour arrival detection
  useEffect(() => {
    if (!detourStop || detourStop.completed || !effectivePosition) return;

    const now = Date.now();
    
    // Check cooldown
    if (now - lastDetourCompletedRef.current < DETOUR_COOLDOWN_MS) {
      return;
    }

    const distanceToDetour = haversineDistance(
      effectivePosition.lat,
      effectivePosition.lng,
      detourStop.lat,
      detourStop.lng
    );

    if (distanceToDetour <= DETOUR_ARRIVAL_DISTANCE_M) {
      // Within arrival zone
      if (detourArrivalStartRef.current === null) {
        detourArrivalStartRef.current = now;
        console.log('[DETOUR] Entered arrival zone for:', detourStop.name);
      } else {
        const dwellTime = now - detourArrivalStartRef.current;
        if (dwellTime >= DETOUR_ARRIVAL_DWELL_TIME_MS) {
          console.log('[DETOUR] Arrival confirmed at:', detourStop.name);
          handleDetourArrival();
        }
      }
    } else {
      // Left arrival zone, reset timer
      if (detourArrivalStartRef.current !== null) {
        detourArrivalStartRef.current = null;
      }
    }
  }, [effectivePosition, detourStop]);

  const handleDetourArrival = useCallback(async () => {
    if (!detourStop || !originalTrip) return;

    console.log('[DETOUR] Completing detour and resuming original trip');
    lastDetourCompletedRef.current = Date.now();
    
    // Mark detour as completed
    setDetourStop(prev => prev ? { ...prev, completed: true } : null);

    // Calculate new route from current position to original destination
    if (effectivePosition) {
      setIsRerouting(true);
      try {
        const newRoute = await HereService.calculateRoute({
          originLat: effectivePosition.lat,
          originLng: effectivePosition.lng,
          destLat: originalTrip.destination.lat,
          destLng: originalTrip.destination.lng,
          transportMode: 'truck',
          truckProfile: originalTrip.truckProfile,
        });

        const newOrigin: GeocodeResult = {
          id: 'post-detour-location',
          title: 'Current Location',
          address: `${effectivePosition.lat.toFixed(4)}, ${effectivePosition.lng.toFixed(4)}`,
          lat: effectivePosition.lat,
          lng: effectivePosition.lng,
        };

        setRoute(newRoute);
        setRouteCoords(decodePolyline(newRoute.polyline));
        setOrigin(newOrigin);
        setDestination(originalTrip.destination);
        setTruckProfile(originalTrip.truckProfile);

        // Clear detour state
        setDetourStop(null);
        setOriginalTrip(null);
        localStorage.removeItem(DETOUR_STATE_KEY);

        // Save new navigation state
        const state: NavigationState = {
          route: newRoute,
          origin: newOrigin,
          destination: originalTrip.destination,
          startedAt: Date.now(),
          truckProfile: originalTrip.truckProfile,
        };
        localStorage.setItem(NAVIGATION_STATE_KEY, JSON.stringify(state));

        console.log('[DETOUR] Resumed navigation to:', originalTrip.destination.title);
      } catch (error) {
        console.error('Failed to resume original trip:', error);
      } finally {
        setIsRerouting(false);
      }
    }
  }, [detourStop, originalTrip, effectivePosition]);

  // Route matching + off-route detection
  const lastMatchRef = useRef<RouteMatchResult | null>(null);
  const onRouteCountRef = useRef<number>(0);
  const lastClosestSegRef = useRef<number | null>(null);
  const lastDebugLogRef = useRef<number>(0);

  const checkAndReroute = useCallback(
    async (
      rawPosition: { lat: number; lng: number; accuracy: number | null; speed: number | null },
      match: RouteMatchResult,
      isProgressingAlongRoute: boolean
    ) => {
      if (!destination || !route || routeCoords.length < 2) return;
      if (isReroutingRef.current || isRerouting) return;

      const now = Date.now();
      
      // 30 second cooldown - absolute block
      if (now - lastRerouteTime.current < REROUTE_COOLDOWN_MS) {
        // During cooldown, always show as ON route
        if (isOffRoute) setIsOffRoute(false);
        return;
      }

      const accuracy = rawPosition.accuracy;
      const speed = rawPosition.speed ?? 0;
      
      // GPS accuracy check - don't trust poor signals
      if (typeof accuracy === 'number' && accuracy > MAX_ACCURACY_FOR_OFF_ROUTE_M) {
        // Reset counters with poor GPS
        offRouteStartTimeRef.current = null;
        offRouteCountRef.current = 0;
        onRouteCountRef.current = 0;
        if (isOffRoute) setIsOffRoute(false);
        return;
      }

      // Speed check - must be moving at highway speed (>15 mph) to trigger reroute
      const speedTooLow = speed < MIN_SPEED_FOR_REROUTE_MPS;

      // Adaptive thresholds based on speed (MUCH more tolerance at low speed)
      const isLowSpeed = speed < LOW_SPEED_THRESHOLD_MPS;
      const baseOffThreshold = isLowSpeed ? LOW_SPEED_OFF_ROUTE_M : OFF_ROUTE_THRESHOLD_M;
      const baseOnThreshold = isLowSpeed ? LOW_SPEED_OFF_ROUTE_M * 0.4 : ON_ROUTE_THRESHOLD_M;

      // Also factor in GPS accuracy for thresholds
      const offThreshold = Math.max(
        baseOffThreshold,
        typeof accuracy === 'number' ? accuracy * 1.5 : baseOffThreshold
      );
      const onThreshold = Math.max(
        baseOnThreshold,
        typeof accuracy === 'number' ? accuracy * 0.6 : baseOnThreshold
      );

      const distToRoute = match.distanceToRouteM;

      // Debug logging - reduced frequency
      if (now - lastDebugLogRef.current > 4000) {
        lastDebugLogRef.current = now;
        console.log('[NAV_DIAG]', {
          raw: { lat: rawPosition.lat.toFixed(5), lng: rawPosition.lng.toFixed(5), acc: accuracy?.toFixed(1) },
          distToRouteM: Math.round(distToRoute),
          thresholds: { off: Math.round(offThreshold), on: Math.round(onThreshold) },
          speed: { mps: speed.toFixed(1), mph: (speed * 2.237).toFixed(1) },
          offRouteCount: offRouteCountRef.current,
          cooldownLeft: Math.max(0, Math.round((REROUTE_COOLDOWN_MS - (now - lastRerouteTime.current)) / 1000)),
        });
      }

      // If progressing along route, use MUCH higher tolerance
      const progressingGuard = isProgressingAlongRoute && distToRoute < offThreshold * 2.0;
      const isClearlyOff = distToRoute > offThreshold;
      const isClearlyOn = distToRoute < onThreshold;

      if (!progressingGuard && isClearlyOff) {
        if (offRouteStartTimeRef.current === null) {
          offRouteStartTimeRef.current = now;
          offRouteCountRef.current = 1;
          onRouteCountRef.current = 0;
        } else {
          offRouteCountRef.current += 1;
          onRouteCountRef.current = 0;
        }

        const offRouteDuration = now - offRouteStartTimeRef.current;
        
        // DON'T show off-route warning until we're really close to triggering
        const almostConfirmed = 
          offRouteCountRef.current >= OFF_ROUTE_CONSECUTIVE_THRESHOLD - 2 &&
          offRouteDuration >= OFF_ROUTE_PERSIST_TIME_MS - 2000;
        
        if (almostConfirmed) {
          setIsOffRoute(true);
        }

        // ALL conditions must be true:
        // 1. Enough consecutive off-route readings
        // 2. Been off-route long enough
        // 3. Speed is high enough (not parking)
        const confirmedOffRoute = 
          offRouteDuration >= OFF_ROUTE_PERSIST_TIME_MS &&
          offRouteCountRef.current >= OFF_ROUTE_CONSECUTIVE_THRESHOLD &&
          !speedTooLow;

        if (confirmedOffRoute) {
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
              speed: (speed * 2.237).toFixed(1) + ' mph',
              offRouteDuration: Math.round(offRouteDuration / 1000) + 's',
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
            setRouteCoords(decodePolyline(newRoute.polyline));

            const newOrigin: GeocodeResult = {
              id: 'reroute-origin',
              title: 'Current Location',
              address: `${rawPosition.lat.toFixed(4)}, ${rawPosition.lng.toFixed(4)}`,
              lat: rawPosition.lat,
              lng: rawPosition.lng,
            };
            setOrigin(newOrigin);

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

  // Update progress when position changes
  const lastProgressUpdate = useRef<number>(0);

  useEffect(() => {
    if (!effectivePosition || !route || routeCoords.length < 2) {
      setProgress(null);
      return;
    }

    const now = Date.now();
    if (now - lastProgressUpdate.current < 1000) return;
    lastProgressUpdate.current = now;

    const filteredLat = effectivePosition.lat;
    const filteredLng = effectivePosition.lng;

    const baseMatch = matchPositionToRoute(filteredLng, filteredLat, routeCoords, {
      searchFromIndex: lastMatchRef.current?.closestSegmentIndex,
      searchWindow: ROUTE_MATCH_WINDOW,
      step: 2,
    });

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

    const newProgress = calculateNavigationProgress(
      match.matchedLng,
      match.matchedLat,
      routeCoords,
      route.instructions,
      route.distance,
      route.duration
    );

    setProgress(newProgress);

    const lastSeg = lastClosestSegRef.current;
    const isProgressing = lastSeg === null ? true : match.closestSegmentIndex >= lastSeg - 2;
    lastClosestSegRef.current = match.closestSegmentIndex;

    checkAndReroute(
      { 
        lat: effectivePosition.lat, 
        lng: effectivePosition.lng, 
        accuracy: effectivePosition.accuracy,
        speed: effectivePosition.speed,
      },
      match,
      isProgressing
    );
  }, [effectivePosition, route, routeCoords, checkAndReroute]);

  const startNavigation = useCallback(
    (newRoute: RouteResponse, newOrigin: GeocodeResult, newDest: GeocodeResult, profile?: TruckProfile) => {
      const usedProfile = profile || DEFAULT_TRUCK_PROFILE;

      setRoute(newRoute);
      setRouteCoords(decodePolyline(newRoute.polyline));
      setOrigin(newOrigin);
      setDestination(newDest);
      setTruckProfile(usedProfile);
      setProgress(null);
      setIsOffRoute(false);
      setIsRerouting(false);

      // Clear detour state when starting fresh navigation
      setDetourStop(null);
      setOriginalTrip(null);
      localStorage.removeItem(DETOUR_STATE_KEY);

      lastMatchRef.current = null;
      lastClosestSegRef.current = null;
      offRouteCountRef.current = 0;
      onRouteCountRef.current = 0;
      offRouteStartTimeRef.current = null;

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
    setDetourStop(null);
    setOriginalTrip(null);
    localStorage.removeItem(NAVIGATION_STATE_KEY);
    localStorage.removeItem(DETOUR_STATE_KEY);
  }, []);

  // Add a detour stop (temporary waypoint)
  const addDetourStop = useCallback(
    async (poi: { lat: number; lng: number; name: string; address?: string }) => {
      if (!effectivePosition) {
        console.error('Cannot add detour: no current position');
        return;
      }

      // Check cooldown
      if (Date.now() - lastDetourCompletedRef.current < DETOUR_COOLDOWN_MS) {
        console.log('[DETOUR] Still in cooldown period');
        return;
      }

      setIsRerouting(true);

      try {
        // Save original trip if we have an active navigation
        if (route && destination && !originalTrip) {
          const savedTrip: OriginalTrip = {
            route,
            origin: origin!,
            destination,
            truckProfile,
          };
          setOriginalTrip(savedTrip);
        }

        // Calculate route to detour stop
        const detourRoute = await HereService.calculateRoute({
          originLat: effectivePosition.lat,
          originLng: effectivePosition.lng,
          destLat: poi.lat,
          destLng: poi.lng,
          transportMode: 'truck',
          truckProfile,
        });

        // Create detour stop
        const newDetour: DetourStop = {
          id: `detour-${Date.now()}`,
          name: poi.name,
          address: poi.address || `${poi.lat.toFixed(4)}, ${poi.lng.toFixed(4)}`,
          lat: poi.lat,
          lng: poi.lng,
          addedAt: Date.now(),
          completed: false,
        };

        // Create new origin
        const newOrigin: GeocodeResult = {
          id: 'detour-origin',
          title: 'Current Location',
          address: `${effectivePosition.lat.toFixed(4)}, ${effectivePosition.lng.toFixed(4)}`,
          lat: effectivePosition.lat,
          lng: effectivePosition.lng,
        };

        // Create detour destination
        const detourDest: GeocodeResult = {
          id: newDetour.id,
          title: poi.name,
          address: newDetour.address,
          lat: poi.lat,
          lng: poi.lng,
        };

        // Update navigation to detour
        setRoute(detourRoute);
        setRouteCoords(decodePolyline(detourRoute.polyline));
        setOrigin(newOrigin);
        setDestination(detourDest);
        setDetourStop(newDetour);
        setIsOffRoute(false);

        // Reset route matching
        lastMatchRef.current = null;
        lastClosestSegRef.current = null;
        offRouteCountRef.current = 0;
        onRouteCountRef.current = 0;
        offRouteStartTimeRef.current = null;
        detourArrivalStartRef.current = null;

        // Save detour state
        const detourState = {
          detourStop: newDetour,
          originalTrip: originalTrip || (route && destination ? {
            route,
            origin: origin!,
            destination,
            truckProfile,
          } : null),
        };
        localStorage.setItem(DETOUR_STATE_KEY, JSON.stringify(detourState));

        // Save current navigation state
        const state: NavigationState = {
          route: detourRoute,
          origin: newOrigin,
          destination: detourDest,
          startedAt: Date.now(),
          truckProfile,
        };
        localStorage.setItem(NAVIGATION_STATE_KEY, JSON.stringify(state));

        console.log('[DETOUR] Added detour stop:', poi.name);
      } catch (error) {
        console.error('Failed to add detour stop:', error);
      } finally {
        setIsRerouting(false);
      }
    },
    [effectivePosition, route, origin, destination, truckProfile, originalTrip]
  );

  // Cancel detour and return to original trip
  const cancelDetour = useCallback(async () => {
    if (!originalTrip || !effectivePosition) return;

    setIsRerouting(true);

    try {
      const newRoute = await HereService.calculateRoute({
        originLat: effectivePosition.lat,
        originLng: effectivePosition.lng,
        destLat: originalTrip.destination.lat,
        destLng: originalTrip.destination.lng,
        transportMode: 'truck',
        truckProfile: originalTrip.truckProfile,
      });

      const newOrigin: GeocodeResult = {
        id: 'cancel-detour-origin',
        title: 'Current Location',
        address: `${effectivePosition.lat.toFixed(4)}, ${effectivePosition.lng.toFixed(4)}`,
        lat: effectivePosition.lat,
        lng: effectivePosition.lng,
      };

      setRoute(newRoute);
      setRouteCoords(decodePolyline(newRoute.polyline));
      setOrigin(newOrigin);
      setDestination(originalTrip.destination);
      setTruckProfile(originalTrip.truckProfile);
      setDetourStop(null);
      setOriginalTrip(null);
      setIsOffRoute(false);

      localStorage.removeItem(DETOUR_STATE_KEY);

      const state: NavigationState = {
        route: newRoute,
        origin: newOrigin,
        destination: originalTrip.destination,
        startedAt: Date.now(),
        truckProfile: originalTrip.truckProfile,
      };
      localStorage.setItem(NAVIGATION_STATE_KEY, JSON.stringify(state));

      console.log('[DETOUR] Cancelled, returning to:', originalTrip.destination.title);
    } catch (error) {
      console.error('Failed to cancel detour:', error);
    } finally {
      setIsRerouting(false);
    }
  }, [originalTrip, effectivePosition]);

  // Navigate to a POI directly (when no active trip)
  const navigateToPoi = useCallback(
    async (poi: { lat: number; lng: number; name: string; address?: string }) => {
      if (!effectivePosition) {
        console.error('Cannot navigate to POI: no current position');
        return;
      }

      setIsRerouting(true);

      try {
        const newRoute = await HereService.calculateRoute({
          originLat: effectivePosition.lat,
          originLng: effectivePosition.lng,
          destLat: poi.lat,
          destLng: poi.lng,
          transportMode: 'truck',
          truckProfile,
        });

        const newOrigin: GeocodeResult = {
          id: 'current-location',
          title: 'Current Location',
          address: `${effectivePosition.lat.toFixed(4)}, ${effectivePosition.lng.toFixed(4)}`,
          lat: effectivePosition.lat,
          lng: effectivePosition.lng,
        };

        const newDest: GeocodeResult = {
          id: poi.name.toLowerCase().replace(/\s+/g, '-'),
          title: poi.name,
          address: poi.address || `${poi.lat.toFixed(4)}, ${poi.lng.toFixed(4)}`,
          lat: poi.lat,
          lng: poi.lng,
        };

        setRoute(newRoute);
        setRouteCoords(decodePolyline(newRoute.polyline));
        setOrigin(newOrigin);
        setDestination(newDest);
        setIsOffRoute(false);

        lastMatchRef.current = null;
        lastClosestSegRef.current = null;
        offRouteCountRef.current = 0;
        onRouteCountRef.current = 0;
        offRouteStartTimeRef.current = null;

        const state: NavigationState = {
          route: newRoute,
          origin: newOrigin,
          destination: newDest,
          startedAt: Date.now(),
          truckProfile,
        };
        localStorage.setItem(NAVIGATION_STATE_KEY, JSON.stringify(state));

        console.log('[NAV] Navigating to POI:', poi.name);
      } catch (error) {
        console.error('Failed to calculate route to POI:', error);
      } finally {
        setIsRerouting(false);
      }
    },
    [effectivePosition, truckProfile]
  );

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
        detourStop,
        hasActiveTrip,
        isOnDetour,
        addDetourStop,
        cancelDetour,
        startNavigation,
        endNavigation,
        navigateToPoi,
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
