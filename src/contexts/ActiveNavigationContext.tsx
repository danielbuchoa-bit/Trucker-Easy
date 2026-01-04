import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { decodeHereFlexiblePolyline, type LngLat } from '@/lib/hereFlexiblePolyline';
import { calculateNavigationProgress, haversineDistance, type NavigationProgress } from '@/lib/navigationUtils';
import { useWakeLock } from '@/hooks/useWakeLock';
import { HereService, type RouteResponse, type GeocodeResult, DEFAULT_TRUCK_PROFILE, type TruckProfile } from '@/services/HereService';

const NAVIGATION_STATE_KEY = 'activeNavigation';
const OFF_ROUTE_THRESHOLD = 100; // meters - trigger reroute if user is this far from route

interface NavigationState {
  route: RouteResponse;
  origin: GeocodeResult;
  destination: GeocodeResult;
  startedAt: number;
  truckProfile: TruckProfile;
}

interface ActiveNavigationContextValue {
  isNavigating: boolean;
  route: RouteResponse | null;
  routeCoords: LngLat[];
  origin: GeocodeResult | null;
  destination: GeocodeResult | null;
  userPosition: { lat: number; lng: number } | null;
  progress: NavigationProgress | null;
  truckProfile: TruckProfile;
  isRerouting: boolean;
  isOffRoute: boolean;
  isSimulating: boolean;
  startNavigation: (route: RouteResponse, origin: GeocodeResult, destination: GeocodeResult, profile?: TruckProfile) => void;
  endNavigation: () => void;
  setSimulatedPosition: (position: { lat: number; lng: number } | null) => void;
  setIsSimulating: (simulating: boolean) => void;
  positionError: string | null;
}

const ActiveNavigationContext = createContext<ActiveNavigationContextValue | undefined>(undefined);

export function ActiveNavigationProvider({ children }: { children: React.ReactNode }) {
  const [route, setRoute] = useState<RouteResponse | null>(null);
  const [routeCoords, setRouteCoords] = useState<LngLat[]>([]);
  const [origin, setOrigin] = useState<GeocodeResult | null>(null);
  const [destination, setDestination] = useState<GeocodeResult | null>(null);
  const [userPosition, setUserPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [simulatedPosition, setSimulatedPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [progress, setProgress] = useState<NavigationProgress | null>(null);
  const [positionError, setPositionError] = useState<string | null>(null);
  const [truckProfile, setTruckProfile] = useState<TruckProfile>(DEFAULT_TRUCK_PROFILE);
  const [isRerouting, setIsRerouting] = useState(false);
  const [isOffRoute, setIsOffRoute] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const lastRerouteTime = useRef<number>(0);
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
        setUserPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setPositionError(null);
      },
      (err) => {
        console.error('Geolocation error:', err);
        setPositionError(err.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
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

  // Check if off route and trigger reroute
  const checkAndReroute = useCallback(async (position: { lat: number; lng: number }) => {
    if (!destination || !route || routeCoords.length === 0) return;
    if (isRerouting) return;
    
    // Don't reroute more than once every 10 seconds
    const now = Date.now();
    if (now - lastRerouteTime.current < 10000) return;

    // Find closest point on route
    let minDist = Infinity;
    for (const [lng, lat] of routeCoords) {
      const dist = haversineDistance(position.lat, position.lng, lat, lng);
      if (dist < minDist) minDist = dist;
    }

    if (minDist > OFF_ROUTE_THRESHOLD) {
      setIsOffRoute(true);
      setIsRerouting(true);
      lastRerouteTime.current = now;

      try {
        console.log('Off route detected, rerouting...');
        const newRoute = await HereService.calculateRoute({
          originLat: position.lat,
          originLng: position.lng,
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
          address: `${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}`,
          lat: position.lat,
          lng: position.lng,
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
      }
    } else {
      setIsOffRoute(false);
    }
  }, [destination, route, routeCoords, isRerouting, truckProfile]);

  // Update progress when position changes (throttled)
  const lastProgressUpdate = useRef<number>(0);
  useEffect(() => {
    if (!effectivePosition || !route || routeCoords.length === 0) {
      setProgress(null);
      return;
    }

    // Throttle updates to max once per second
    const now = Date.now();
    if (now - lastProgressUpdate.current < 1000) return;
    lastProgressUpdate.current = now;

    const newProgress = calculateNavigationProgress(
      effectivePosition.lng,
      effectivePosition.lat,
      routeCoords,
      route.instructions,
      route.distance,
      route.duration
    );

    setProgress(newProgress);

    // Check if off route (only for real navigation, not simulation)
    if (!isSimulating) {
      checkAndReroute(effectivePosition);
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
