import { useRef, useCallback, useMemo } from 'react';

// === CONFIGURATION ===
const POSITION_UPDATE_THROTTLE_MS = 250; // Minimum time between position updates
const CAMERA_UPDATE_THROTTLE_MS = 100; // Minimum time between camera updates
const ROUTE_UPDATE_THROTTLE_MS = 1000; // Minimum time between route redraws
const MIN_POSITION_CHANGE_M = 1; // Minimum movement to trigger update
const MIN_BEARING_CHANGE_DEG = 3; // Minimum rotation to trigger update

interface ThrottleState {
  lastPositionUpdate: number;
  lastCameraUpdate: number;
  lastRouteUpdate: number;
  lastPosition: { lat: number; lng: number } | null;
  lastBearing: number;
  routeHash: string;
}

/**
 * Calculate distance between two points (simplified planar for small distances)
 */
function quickDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const latDiff = (lat2 - lat1) * 111000; // ~111km per degree
  const lngDiff = (lng2 - lng1) * 111000 * Math.cos(lat1 * Math.PI / 180);
  return Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
}

/**
 * Calculate shortest bearing difference
 */
function bearingDiff(a: number, b: number): number {
  let diff = b - a;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return Math.abs(diff);
}

/**
 * Hook for optimizing map performance
 * - Throttles updates to prevent flickering
 * - Skips unnecessary updates when values haven't changed meaningfully
 * - Prevents route redraws unless necessary
 */
export function useMapPerformance() {
  const stateRef = useRef<ThrottleState>({
    lastPositionUpdate: 0,
    lastCameraUpdate: 0,
    lastRouteUpdate: 0,
    lastPosition: null,
    lastBearing: 0,
    routeHash: '',
  });

  /**
   * Check if position update should be applied
   */
  const shouldUpdatePosition = useCallback((lat: number, lng: number): boolean => {
    const now = Date.now();
    const state = stateRef.current;

    // Time throttle
    if (now - state.lastPositionUpdate < POSITION_UPDATE_THROTTLE_MS) {
      return false;
    }

    // Distance threshold
    if (state.lastPosition) {
      const distance = quickDistance(
        state.lastPosition.lat, state.lastPosition.lng,
        lat, lng
      );
      if (distance < MIN_POSITION_CHANGE_M) {
        return false;
      }
    }

    // Update accepted
    state.lastPositionUpdate = now;
    state.lastPosition = { lat, lng };
    return true;
  }, []);

  /**
   * Check if camera update should be applied
   */
  const shouldUpdateCamera = useCallback((lat: number, lng: number, bearing: number): boolean => {
    const now = Date.now();
    const state = stateRef.current;

    // Time throttle
    if (now - state.lastCameraUpdate < CAMERA_UPDATE_THROTTLE_MS) {
      return false;
    }

    // Check if position or bearing changed enough
    let shouldUpdate = false;

    if (state.lastPosition) {
      const distance = quickDistance(
        state.lastPosition.lat, state.lastPosition.lng,
        lat, lng
      );
      if (distance >= MIN_POSITION_CHANGE_M) {
        shouldUpdate = true;
      }
    } else {
      shouldUpdate = true;
    }

    if (bearingDiff(state.lastBearing, bearing) >= MIN_BEARING_CHANGE_DEG) {
      shouldUpdate = true;
    }

    if (shouldUpdate) {
      state.lastCameraUpdate = now;
      state.lastPosition = { lat, lng };
      state.lastBearing = bearing;
    }

    return shouldUpdate;
  }, []);

  /**
   * Check if route should be redrawn
   */
  const shouldUpdateRoute = useCallback((routePolyline: string | undefined): boolean => {
    const now = Date.now();
    const state = stateRef.current;

    // No route
    if (!routePolyline) {
      return false;
    }

    // Time throttle
    if (now - state.lastRouteUpdate < ROUTE_UPDATE_THROTTLE_MS) {
      return false;
    }

    // Check if route actually changed (simple hash)
    const hash = routePolyline.slice(0, 50) + routePolyline.length;
    if (hash === state.routeHash) {
      return false;
    }

    state.lastRouteUpdate = now;
    state.routeHash = hash;
    return true;
  }, []);

  /**
   * Force reset (e.g., when resuming from background)
   */
  const reset = useCallback(() => {
    stateRef.current = {
      lastPositionUpdate: 0,
      lastCameraUpdate: 0,
      lastRouteUpdate: 0,
      lastPosition: null,
      lastBearing: 0,
      routeHash: '',
    };
  }, []);

  /**
   * Get update statistics for debugging
   */
  const getStats = useCallback(() => {
    const state = stateRef.current;
    return {
      timeSincePosition: Date.now() - state.lastPositionUpdate,
      timeSinceCamera: Date.now() - state.lastCameraUpdate,
      timeSinceRoute: Date.now() - state.lastRouteUpdate,
      lastBearing: state.lastBearing,
    };
  }, []);

  return useMemo(() => ({
    shouldUpdatePosition,
    shouldUpdateCamera,
    shouldUpdateRoute,
    reset,
    getStats,
  }), [shouldUpdatePosition, shouldUpdateCamera, shouldUpdateRoute, reset, getStats]);
}

/**
 * Memoization helper for route coordinates
 * Prevents unnecessary re-renders when route hasn't changed
 */
export function useStableRouteCoords(routeCoords: [number, number][]): [number, number][] {
  const cacheRef = useRef<{ coords: [number, number][]; hash: string }>({
    coords: [],
    hash: '',
  });

  return useMemo(() => {
    if (routeCoords.length === 0) return [];

    // Simple hash based on first, last, and length
    const hash = `${routeCoords[0]?.[0]}_${routeCoords[routeCoords.length - 1]?.[1]}_${routeCoords.length}`;
    
    if (hash !== cacheRef.current.hash) {
      cacheRef.current = { coords: routeCoords, hash };
    }
    
    return cacheRef.current.coords;
  }, [routeCoords]);
}
