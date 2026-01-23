/**
 * Unified GPS Navigation Engine Hook
 * 
 * NextBillion-Only GPS Processing:
 * 1. Kalman Filter - Position smoothing and prediction
 * 2. Weighted Segment Selection - Smart route matching
 * 3. HMM Map Matching - Probabilistic path tracking
 * 4. Adaptive Smoothing - Speed-dependent filtering
 * 5. Local Snap-to-Route - Client-side snap to polyline
 * 
 * Designed specifically for truck navigation.
 * 
 * HERE REMOVED - Now uses local snap-to-route algorithm.
 */

import { useRef, useCallback, useMemo } from 'react';
import type { LngLat } from '@/lib/hereFlexiblePolyline';
import {
  // Constants
  SPEED_THRESHOLDS,
  SNAP,
  COG,
  DEAD_RECKONING,
  SPIKE,
  getHeadingSmoothing,
  getSpeedSmoothing,
  // Geometry
  haversineDistance,
  calculateBearing,
  smoothAngle,
  lerp,
  projectPosition,
  // Kalman
  type KalmanState,
  type KalmanMeasurement,
  createKalmanState,
  kalmanUpdate,
  isSpike,
  // Weighted Selection
  selectBestSegment,
  calculateSnapStrength,
  // HMM
  type HMMState,
  createHMMState,
  processHMMObservation,
} from '@/lib/gps';

// === TYPES ===

export interface GpsInput {
  lat: number;
  lng: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

export interface NavigationOutput {
  // Raw GPS position
  rawLat: number;
  rawLng: number;
  
  // Kalman-filtered position
  filteredLat: number;
  filteredLng: number;
  
  // Route-snapped position (use for rendering)
  snappedLat: number;
  snappedLng: number;
  
  // Heading (blended from GPS, COG, and route)
  heading: number;
  
  // Smoothed speed (m/s)
  speed: number;
  
  // Route matching info
  segmentIndex: number;
  distanceToRoute: number;
  isOnRoute: boolean;
  snapStrength: number;
  matchConfidence: number;
  
  // Map matching source (always 'local' now)
  hereMatchUsed: boolean; // Always false
  hereMatchConfidence: number; // Always 0
  
  // Timing
  timestamp: number;
}

interface PositionHistoryEntry {
  lat: number;
  lng: number;
  timestamp: number;
}

// === MAIN HOOK ===

export function useGpsNavigationEngine() {
  // Kalman filter state
  const kalmanRef = useRef<KalmanState | null>(null);
  
  // HMM state
  const hmmRef = useRef<HMMState>(createHMMState());
  
  // Position history for COG calculation
  const positionHistoryRef = useRef<PositionHistoryEntry[]>([]);
  
  // Last valid heading
  const lastValidHeadingRef = useRef<number>(0);
  
  // Smoothed values
  const smoothedHeadingRef = useRef<number>(0);
  const smoothedSpeedRef = useRef<number>(0);
  
  // Last segment for continuity
  const lastSegmentRef = useRef<number>(0);
  
  // Last processed position
  const lastOutputRef = useRef<NavigationOutput | null>(null);

  /**
   * Calculate Course-Over-Ground from position history
   */
  const calculateCOG = useCallback((): number | null => {
    const history = positionHistoryRef.current;
    if (history.length < 2) return null;

    const now = Date.now();
    const latest = history[history.length - 1];

    // Find oldest valid point
    for (let i = 0; i < history.length - 1; i++) {
      const older = history[i];
      const age = now - older.timestamp;
      
      // Skip if too old
      if (age > COG.MAX_HISTORY_AGE_MS) continue;

      const distance = haversineDistance(older.lat, older.lng, latest.lat, latest.lng);
      const timeDelta = (latest.timestamp - older.timestamp) / 1000;

      // Need minimum distance and speed
      if (distance >= COG.MIN_DISTANCE_M && timeDelta > 0) {
        const speed = distance / timeDelta;
        if (speed >= COG.MIN_SPEED_MPS) {
          const cog = calculateBearing(older.lat, older.lng, latest.lat, latest.lng);
          lastValidHeadingRef.current = cog;
          return cog;
        }
      }
    }

    // Return last valid heading if no good COG
    return lastValidHeadingRef.current || null;
  }, []);

  /**
   * Blend multiple heading sources
   */
  const blendHeading = useCallback((
    gpsHeading: number | null,
    cogHeading: number | null,
    routeBearing: number | null,
    speed: number,
    snapStrength: number
  ): number => {
    // At low speed, prefer last known heading
    if (speed < SPEED_THRESHOLDS.STATIONARY) {
      return smoothedHeadingRef.current || 0;
    }

    let totalWeight = 0;
    let weightedSum = 0;

    // GPS heading (reliable at higher speeds)
    if (gpsHeading !== null && !isNaN(gpsHeading)) {
      const weight = speed > SPEED_THRESHOLDS.MEDIUM ? 0.35 : 0.15;
      const adjusted = smoothedHeadingRef.current + 
        ((gpsHeading - smoothedHeadingRef.current + 540) % 360 - 180);
      weightedSum += adjusted * weight;
      totalWeight += weight;
    }

    // COG (reliable at medium speeds)
    if (cogHeading !== null && !isNaN(cogHeading)) {
      const weight = speed > COG.MIN_SPEED_MPS ? 0.4 : 0.1;
      const adjusted = smoothedHeadingRef.current + 
        ((cogHeading - smoothedHeadingRef.current + 540) % 360 - 180);
      weightedSum += adjusted * weight;
      totalWeight += weight;
    }

    // Route bearing (when snapped to route)
    if (routeBearing !== null && !isNaN(routeBearing) && snapStrength > 0.3) {
      const weight = snapStrength * 0.5;
      const adjusted = smoothedHeadingRef.current + 
        ((routeBearing - smoothedHeadingRef.current + 540) % 360 - 180);
      weightedSum += adjusted * weight;
      totalWeight += weight;
    }

    if (totalWeight > 0) {
      return (weightedSum / totalWeight + 360) % 360;
    }

    return smoothedHeadingRef.current;
  }, []);

  /**
   * Process a GPS fix through the full pipeline
   */
  const processGpsFix = useCallback((
    input: GpsInput,
    routeCoords: LngLat[]
  ): NavigationOutput => {
    const { lat, lng, accuracy, heading: gpsHeading, speed: gpsSpeed, timestamp } = input;
    
    // === 1. SPIKE DETECTION ===
    if (kalmanRef.current) {
      const measurement: KalmanMeasurement = {
        lat,
        lng,
        accuracy: accuracy ?? 10,
        timestamp,
      };

      if (isSpike(kalmanRef.current, measurement, SPIKE.MAX_SPEED_MPS)) {
        // Return last known position if spike detected
        if (lastOutputRef.current) {
          return {
            ...lastOutputRef.current,
            timestamp,
          };
        }
      }
    }

    // === 2. KALMAN FILTER ===
    if (!kalmanRef.current) {
      kalmanRef.current = createKalmanState(lat, lng, timestamp);
    }

    const kalmanResult = kalmanUpdate(kalmanRef.current, {
      lat,
      lng,
      accuracy: accuracy ?? 10,
      timestamp,
    });

    const filteredLat = kalmanResult.lat;
    const filteredLng = kalmanResult.lng;
    const kalmanSpeed = kalmanResult.speedMps;

    // === 3. UPDATE POSITION HISTORY (for COG) ===
    positionHistoryRef.current.push({ lat: filteredLat, lng: filteredLng, timestamp });
    if (positionHistoryRef.current.length > COG.HISTORY_SIZE) {
      positionHistoryRef.current.shift();
    }

    // === 4. SPEED SMOOTHING ===
    const rawSpeed = gpsSpeed ?? kalmanSpeed;
    const speedAlpha = getSpeedSmoothing(smoothedSpeedRef.current);
    smoothedSpeedRef.current = lerp(smoothedSpeedRef.current, rawSpeed, speedAlpha);
    const smoothedSpeed = smoothedSpeedRef.current;

    // === 5. LOCAL MAP MATCHING (No HERE - uses route polyline) ===
    let segmentIndex = lastSegmentRef.current;
    let snappedLat = filteredLat;
    let snappedLng = filteredLng;
    let distanceToRoute = 0;
    let snapStrength = 0;
    let matchConfidence = 0;
    let routeBearing: number | null = null;

    if (routeCoords.length >= 2) {
      // Calculate COG for heading-aware matching
      const cogHeading = calculateCOG();
      const headingForMatch = cogHeading ?? gpsHeading ?? null;

      // Use HMM for probabilistic matching
      const hmmResult = processHMMObservation(
        hmmRef.current,
        filteredLat,
        filteredLng,
        headingForMatch,
        timestamp,
        routeCoords
      );

      // Also use weighted selection for comparison/fallback
      const weightedResult = selectBestSegment(
        filteredLat,
        filteredLng,
        headingForMatch,
        smoothedSpeed,
        routeCoords,
        lastSegmentRef.current
      );

      // Choose between HMM and weighted selection based on confidence
      if (hmmResult.confidence > 0.5 && hmmResult.confidence > weightedResult.confidence * 0.8) {
        // Use HMM result
        segmentIndex = hmmResult.segmentIndex;
        snappedLat = hmmResult.matchedLat;
        snappedLng = hmmResult.matchedLng;
        matchConfidence = hmmResult.confidence;
      } else if (weightedResult.shouldSnap) {
        // Use weighted selection
        segmentIndex = weightedResult.bestSegment.index;
        snappedLat = weightedResult.bestSegment.projectedLat;
        snappedLng = weightedResult.bestSegment.projectedLng;
        matchConfidence = weightedResult.confidence;
      }

      // Calculate distance to route
      distanceToRoute = haversineDistance(filteredLat, filteredLng, snappedLat, snappedLng);

      // Calculate snap strength - FORCE SNAP when within threshold
      snapStrength = calculateSnapStrength(distanceToRoute, matchConfidence);

      // Apply FORCED snap when within 15m threshold (route polyline reference)
      if (distanceToRoute <= SNAP.MAX_DISTANCE_M) {
        // Force snap when very close to route
        if (distanceToRoute <= SNAP.FORCE_SNAP_DISTANCE_M) {
          // 100% snap when very close to route
          // snappedLat/snappedLng already set above
        } else {
          // Progressive snap based on distance
          const forceSnapStrength = Math.max(snapStrength, 0.8);
          snappedLat = lerp(filteredLat, snappedLat, forceSnapStrength);
          snappedLng = lerp(filteredLng, snappedLng, forceSnapStrength);
        }
      } else {
        // Beyond 15m threshold - still apply soft snap but flag as off-route
        snappedLat = lerp(filteredLat, snappedLat, snapStrength * 0.3);
        snappedLng = lerp(filteredLng, snappedLng, snapStrength * 0.3);
      }

      // Get route bearing for heading calculation
      if (segmentIndex < routeCoords.length - 1) {
        const [lng1, lat1] = routeCoords[segmentIndex];
        const [lng2, lat2] = routeCoords[segmentIndex + 1];
        routeBearing = calculateBearing(lat1, lng1, lat2, lng2);
      }

      lastSegmentRef.current = segmentIndex;
    }

    // === 6. HEADING CALCULATION ===
    const cogHeading = calculateCOG();
    const blendedHeading = blendHeading(
      gpsHeading,
      cogHeading,
      routeBearing,
      smoothedSpeed,
      snapStrength
    );

    // Smooth heading
    const headingAlpha = getHeadingSmoothing(smoothedSpeed);
    const finalHeading = smoothAngle(smoothedHeadingRef.current, blendedHeading, headingAlpha);
    smoothedHeadingRef.current = finalHeading;

    // === 7. BUILD OUTPUT ===
    const isOnRoute = distanceToRoute <= SNAP.MAX_DISTANCE_M && matchConfidence > SNAP.MIN_CONFIDENCE;

    const output: NavigationOutput = {
      rawLat: lat,
      rawLng: lng,
      filteredLat,
      filteredLng,
      snappedLat,
      snappedLng,
      heading: finalHeading,
      speed: smoothedSpeed,
      segmentIndex,
      distanceToRoute,
      isOnRoute,
      snapStrength,
      matchConfidence,
      hereMatchUsed: false, // Always false now - no HERE
      hereMatchConfidence: 0, // Always 0 now
      timestamp,
    };

    lastOutputRef.current = output;
    return output;
  }, [calculateCOG, blendHeading]);

  /**
   * Get predicted position (for dead reckoning during GPS gaps)
   */
  const predictCurrentPosition = useCallback((
    targetTime: number = Date.now()
  ): NavigationOutput | null => {
    if (!lastOutputRef.current || !kalmanRef.current) {
      return null;
    }

    const last = lastOutputRef.current;
    const timeDelta = targetTime - last.timestamp;

    // Check if dead reckoning is valid
    if (timeDelta <= 0 || timeDelta > DEAD_RECKONING.MAX_DURATION_MS) {
      return last;
    }

    if (last.speed < DEAD_RECKONING.MIN_SPEED_MPS) {
      return last;
    }

    // Project position forward
    const projected = projectPosition(
      last.snappedLat,
      last.snappedLng,
      last.speed,
      last.heading,
      timeDelta
    );

    // Calculate confidence decay
    const confidenceDecay = 1 - (timeDelta / DEAD_RECKONING.MAX_DURATION_MS) * DEAD_RECKONING.CONFIDENCE_DECAY;

    return {
      ...last,
      snappedLat: projected.lat,
      snappedLng: projected.lng,
      matchConfidence: last.matchConfidence * confidenceDecay,
      timestamp: targetTime,
    };
  }, []);

  /**
   * Reset all state
   */
  const reset = useCallback(() => {
    kalmanRef.current = null;
    hmmRef.current = createHMMState();
    positionHistoryRef.current = [];
    lastValidHeadingRef.current = 0;
    smoothedHeadingRef.current = 0;
    smoothedSpeedRef.current = 0;
    lastSegmentRef.current = 0;
    lastOutputRef.current = null;
  }, []);

  return useMemo(() => ({
    processGpsFix,
    predictCurrentPosition,
    reset,
  }), [processGpsFix, predictCurrentPosition, reset]);
}
