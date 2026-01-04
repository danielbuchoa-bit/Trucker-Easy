import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { decodeHereFlexiblePolyline, type LngLat } from '@/lib/hereFlexiblePolyline';
import { calculateNavigationProgress, type NavigationProgress } from '@/lib/navigationUtils';
import { useWakeLock } from '@/hooks/useWakeLock';
import type { RouteResponse, GeocodeResult } from '@/services/HereService';

const NAVIGATION_STATE_KEY = 'activeNavigation';

interface NavigationState {
  route: RouteResponse;
  origin: GeocodeResult;
  destination: GeocodeResult;
  startedAt: number;
}

interface ActiveNavigationContextValue {
  /** Whether navigation is currently active */
  isNavigating: boolean;
  /** Current route data */
  route: RouteResponse | null;
  /** Decoded route coordinates */
  routeCoords: LngLat[];
  /** Origin location */
  origin: GeocodeResult | null;
  /** Destination location */
  destination: GeocodeResult | null;
  /** User's current position */
  userPosition: { lat: number; lng: number } | null;
  /** Navigation progress data */
  progress: NavigationProgress | null;
  /** Start navigation with a route */
  startNavigation: (route: RouteResponse, origin: GeocodeResult, destination: GeocodeResult) => void;
  /** End navigation */
  endNavigation: () => void;
  /** Position tracking error */
  positionError: string | null;
}

const ActiveNavigationContext = createContext<ActiveNavigationContextValue | null>(null);

export function ActiveNavigationProvider({ children }: { children: React.ReactNode }) {
  const [route, setRoute] = useState<RouteResponse | null>(null);
  const [routeCoords, setRouteCoords] = useState<LngLat[]>([]);
  const [origin, setOrigin] = useState<GeocodeResult | null>(null);
  const [destination, setDestination] = useState<GeocodeResult | null>(null);
  const [userPosition, setUserPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [progress, setProgress] = useState<NavigationProgress | null>(null);
  const [positionError, setPositionError] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const isNavigating = route !== null;

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
        } else {
          localStorage.removeItem(NAVIGATION_STATE_KEY);
        }
      }
    } catch {
      localStorage.removeItem(NAVIGATION_STATE_KEY);
    }
  }, []);

  // Start watching position when navigating
  useEffect(() => {
    if (!isNavigating) {
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
  }, [isNavigating]);

  // Update progress when position changes
  useEffect(() => {
    if (!userPosition || !route || routeCoords.length === 0) {
      setProgress(null);
      return;
    }

    const newProgress = calculateNavigationProgress(
      userPosition.lng,
      userPosition.lat,
      routeCoords,
      route.instructions,
      route.distance,
      route.duration
    );

    setProgress(newProgress);
  }, [userPosition, route, routeCoords]);

  const startNavigation = useCallback(
    (newRoute: RouteResponse, newOrigin: GeocodeResult, newDest: GeocodeResult) => {
      setRoute(newRoute);
      setRouteCoords(decodeHereFlexiblePolyline(newRoute.polyline));
      setOrigin(newOrigin);
      setDestination(newDest);

      const state: NavigationState = {
        route: newRoute,
        origin: newOrigin,
        destination: newDest,
        startedAt: Date.now(),
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
    setProgress(null);
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
        userPosition,
        progress,
        startNavigation,
        endNavigation,
        positionError,
      }}
    >
      {children}
    </ActiveNavigationContext.Provider>
  );
}

export function useActiveNavigation() {
  const ctx = useContext(ActiveNavigationContext);
  if (!ctx) {
    throw new Error('useActiveNavigation must be used within ActiveNavigationProvider');
  }
  return ctx;
}
