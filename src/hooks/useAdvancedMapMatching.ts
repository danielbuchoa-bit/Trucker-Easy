import { useRef, useCallback, useMemo } from 'react';
import type { LngLat } from '@/lib/hereFlexiblePolyline';

// === CONFIGURATION ===
// Snap to route settings - aggressive for highway navigation
const SNAP_MAX_DISTANCE_M = 50; // Max distance to snap to route
const SNAP_HARD_DISTANCE_M = 20; // Distance within which we snap 100%
const SNAP_BLEND_CURVE = 2.5; // Exponential curve for snap blending

// Heading calculation
const MIN_SPEED_FOR_HEADING_MPS = 0.8; // ~3 km/h minimum for heading calculation
const HEADING_SMOOTH_FACTOR = 0.35; // EMA for heading (higher = more responsive)
const ROUTE_HEADING_WEIGHT = 0.6; // Weight for route-based heading vs GPS heading

// Position smoothing
const POSITION_SMOOTH_FACTOR = 0.4; // EMA for position smoothing
const SPEED_SMOOTH_FACTOR = 0.3; // EMA for speed smoothing

// Route matching optimization
const SEARCH_WINDOW_AHEAD = 80; // Points ahead to search
const SEARCH_WINDOW_BEHIND = 10; // Points behind to search

interface PositionFix {
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

// === UTILITY FUNCTIONS ===

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lng2 - lng1);
  
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function smoothAngle(current: number, target: number, factor: number): number {
  let diff = target - current;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return ((current + diff * factor) + 360) % 360;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

// Project point onto line segment and return closest point
function projectToSegment(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number
): { x: number; y: number; t: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  
  if (lenSq === 0) {
    return { x: ax, y: ay, t: 0 };
  }
  
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  
  return {
    x: ax + t * dx,
    y: ay + t * dy,
    t,
  };
}

// Calculate snap strength based on distance (exponential decay)
function calculateSnapStrength(distance: number): number {
  if (distance <= SNAP_HARD_DISTANCE_M) {
    return 1.0; // 100% snap when very close
  }
  if (distance >= SNAP_MAX_DISTANCE_M) {
    return 0.0; // No snap when too far
  }
  
  // Exponential decay between hard and max distance
  const normalized = (distance - SNAP_HARD_DISTANCE_M) / (SNAP_MAX_DISTANCE_M - SNAP_HARD_DISTANCE_M);
  return Math.pow(1 - normalized, SNAP_BLEND_CURVE);
}

/**
 * Advanced map matching hook with:
 * - Aggressive snap-to-route for highway driving
 * - Route-based heading alignment
 * - Position smoothing (EMA)
 * - Speed-based adaptive smoothing
 */
export function useAdvancedMapMatching() {
  // State refs
  const lastSegmentRef = useRef<number>(0);
  const smoothedLatRef = useRef<number | null>(null);
  const smoothedLngRef = useRef<number | null>(null);
  const smoothedHeadingRef = useRef<number>(0);
  const smoothedSpeedRef = useRef<number>(0);
  const lastPositionRef = useRef<{ lat: number; lng: number; time: number } | null>(null);

  /**
   * Find closest point on route using optimized segment search
   */
  const findClosestRoutePoint = useCallback((
    lat: number,
    lng: number,
    routeCoords: LngLat[],
    fromSegment: number
  ): { 
    lat: number; 
    lng: number; 
    distance: number; 
    segmentIndex: number;
    segmentBearing: number;
  } => {
    if (routeCoords.length < 2) {
      return { lat, lng, distance: Infinity, segmentIndex: 0, segmentBearing: 0 };
    }

    const start = Math.max(0, fromSegment - SEARCH_WINDOW_BEHIND);
    const end = Math.min(routeCoords.length - 2, fromSegment + SEARCH_WINDOW_AHEAD);
    
    let minDistance = Infinity;
    let bestLat = lat;
    let bestLng = lng;
    let bestSegment = fromSegment;
    let bestBearing = 0;

    for (let i = start; i <= end; i++) {
      const [ax, ay] = routeCoords[i]; // lng, lat
      const [bx, by] = routeCoords[i + 1];
      
      // Project point onto segment (using lat/lng directly for small distances)
      const proj = projectToSegment(lng, lat, ax, ay, bx, by);
      const projLat = proj.y;
      const projLng = proj.x;
      
      const distance = haversineDistance(lat, lng, projLat, projLng);
      
      if (distance < minDistance) {
        minDistance = distance;
        bestLat = projLat;
        bestLng = projLng;
        bestSegment = i;
        // Calculate bearing of this segment
        bestBearing = calculateBearing(ay, ax, by, bx);
      }
    }

    return {
      lat: bestLat,
      lng: bestLng,
      distance: minDistance,
      segmentIndex: bestSegment,
      segmentBearing: bestBearing,
    };
  }, []);

  /**
   * Process a position fix and return matched position
   */
  const processPosition = useCallback((
    fix: PositionFix,
    routeCoords: LngLat[]
  ): MatchedPosition => {
    const now = fix.timestamp;
    
    // Initialize smoothed position on first call
    if (smoothedLatRef.current === null) {
      smoothedLatRef.current = fix.lat;
      smoothedLngRef.current = fix.lng;
    }
    
    // Calculate implied speed from position change
    let impliedSpeed = fix.speed ?? 0;
    if (lastPositionRef.current) {
      const timeDelta = (now - lastPositionRef.current.time) / 1000;
      if (timeDelta > 0.1 && timeDelta < 10) {
        const distance = haversineDistance(
          lastPositionRef.current.lat,
          lastPositionRef.current.lng,
          fix.lat,
          fix.lng
        );
        impliedSpeed = Math.max(impliedSpeed, distance / timeDelta);
      }
    }
    
    // Adaptive smoothing factor based on speed
    // Higher speed = less smoothing for responsiveness
    const speedKmh = impliedSpeed * 3.6;
    const adaptiveFactor = Math.min(0.8, POSITION_SMOOTH_FACTOR + speedKmh * 0.005);
    
    // Smooth the raw GPS position
    smoothedLatRef.current = lerp(smoothedLatRef.current!, fix.lat, adaptiveFactor);
    smoothedLngRef.current = lerp(smoothedLngRef.current!, fix.lng, adaptiveFactor);
    
    // Find closest point on route
    const routeMatch = findClosestRoutePoint(
      smoothedLatRef.current,
      smoothedLngRef.current!,
      routeCoords,
      lastSegmentRef.current
    );
    
    // Update last segment for next search
    lastSegmentRef.current = routeMatch.segmentIndex;
    
    // Calculate snap strength
    const snapStrength = calculateSnapStrength(routeMatch.distance);
    
    // Snap position to route with calculated strength
    const snappedLat = lerp(smoothedLatRef.current, routeMatch.lat, snapStrength);
    const snappedLng = lerp(smoothedLngRef.current!, routeMatch.lng, snapStrength);
    
    // Calculate heading - blend GPS heading with route bearing
    let heading = smoothedHeadingRef.current;
    
    if (impliedSpeed >= MIN_SPEED_FOR_HEADING_MPS) {
      // When moving, blend GPS heading with route bearing
      const gpsHeading = fix.heading ?? smoothedHeadingRef.current;
      const routeBearing = routeMatch.segmentBearing;
      
      // Weight route bearing more heavily when snapped to route
      const routeWeight = ROUTE_HEADING_WEIGHT * snapStrength;
      const blendedHeading = smoothAngle(gpsHeading, routeBearing, routeWeight);
      
      // Smooth the final heading
      heading = smoothAngle(smoothedHeadingRef.current, blendedHeading, HEADING_SMOOTH_FACTOR);
    }
    
    smoothedHeadingRef.current = heading;
    
    // Smooth speed
    smoothedSpeedRef.current = lerp(smoothedSpeedRef.current, impliedSpeed, SPEED_SMOOTH_FACTOR);
    
    // Store for next iteration
    lastPositionRef.current = { lat: fix.lat, lng: fix.lng, time: now };
    
    return {
      rawLat: fix.lat,
      rawLng: fix.lng,
      smoothedLat: smoothedLatRef.current,
      smoothedLng: smoothedLngRef.current!,
      snappedLat,
      snappedLng,
      heading,
      speed: smoothedSpeedRef.current,
      distanceToRoute: routeMatch.distance,
      isOnRoute: routeMatch.distance <= SNAP_MAX_DISTANCE_M,
      segmentIndex: routeMatch.segmentIndex,
      snapStrength,
      timestamp: now,
    };
  }, [findClosestRoutePoint]);

  /**
   * Reset internal state (call when route changes)
   */
  const reset = useCallback(() => {
    lastSegmentRef.current = 0;
    smoothedLatRef.current = null;
    smoothedLngRef.current = null;
    smoothedHeadingRef.current = 0;
    smoothedSpeedRef.current = 0;
    lastPositionRef.current = null;
  }, []);

  return useMemo(() => ({
    processPosition,
    reset,
  }), [processPosition, reset]);
}
