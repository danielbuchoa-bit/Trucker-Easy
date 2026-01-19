/**
 * Advanced Map Matching Hook
 * 
 * NOW USES THE UNIFIED GPS NAVIGATION ENGINE
 * 
 * This hook wraps the new GPS engine for backward compatibility
 * with existing components that use this interface.
 */

import { useRef, useCallback, useMemo } from 'react';
import type { LngLat } from '@/lib/hereFlexiblePolyline';
import { useGpsNavigationEngine, type NavigationOutput } from './useGpsNavigationEngine';

export interface PositionFix {
  lat: number;
  lng: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

export interface MatchedPosition {
  // Raw GPS position
  rawLat: number;
  rawLng: number;
  
  // Smoothed GPS position (before snap)
  smoothedLat: number;
  smoothedLng: number;
  
  // Final snapped position (use for rendering)
  snappedLat: number;
  snappedLng: number;
  
  // Heading (route-aligned)
  heading: number;
  
  // Speed (smoothed)
  speed: number;
  
  // Route matching info
  distanceToRoute: number;
  isOnRoute: boolean;
  segmentIndex: number;
  snapStrength: number;
  
  // Timestamp
  timestamp: number;
}

/**
 * Advanced map matching hook with:
 * - Kalman filter for position smoothing
 * - HMM probabilistic map matching
 * - Weighted segment selection with heading constraint
 * - Adaptive smoothing based on speed
 * 
 * @returns processPosition function and reset function
 */
export function useAdvancedMapMatching() {
  const gpsEngine = useGpsNavigationEngine();
  
  // Convert NavigationOutput to MatchedPosition for backward compatibility
  const convertOutput = useCallback((output: NavigationOutput): MatchedPosition => {
    return {
      rawLat: output.rawLat,
      rawLng: output.rawLng,
      smoothedLat: output.filteredLat,
      smoothedLng: output.filteredLng,
      snappedLat: output.snappedLat,
      snappedLng: output.snappedLng,
      heading: output.heading,
      speed: output.speed,
      distanceToRoute: output.distanceToRoute,
      isOnRoute: output.isOnRoute,
      segmentIndex: output.segmentIndex,
      snapStrength: output.snapStrength,
      timestamp: output.timestamp,
    };
  }, []);

  const processPosition = useCallback((
    fix: PositionFix,
    routeCoords: LngLat[]
  ): MatchedPosition => {
    const output = gpsEngine.processGpsFix({
      lat: fix.lat,
      lng: fix.lng,
      accuracy: fix.accuracy,
      heading: fix.heading,
      speed: fix.speed,
      timestamp: fix.timestamp,
    }, routeCoords);
    
    return convertOutput(output);
  }, [gpsEngine, convertOutput]);

  const reset = useCallback(() => {
    gpsEngine.reset();
  }, [gpsEngine]);

  return useMemo(() => ({
    processPosition,
    reset,
  }), [processPosition, reset]);
}
