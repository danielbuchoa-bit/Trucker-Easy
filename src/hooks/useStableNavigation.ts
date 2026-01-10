import { useRef, useCallback, useMemo } from 'react';
import { type LngLat } from '@/lib/hereFlexiblePolyline';

// === CONFIGURATION ===
const SNAP_MAX_DISTANCE_M = 40; // Only snap if within this distance
const SNAP_BLEND_FACTOR = 0.7; // How strongly to pull toward route (0-1)
const HEADING_SMOOTH_FACTOR = 0.25; // EMA factor for heading smoothing
const SPEED_SMOOTH_FACTOR = 0.3; // EMA factor for speed smoothing
const MIN_COG_DISTANCE_M = 2; // Minimum distance to calculate COG
const MIN_COG_SPEED_MPS = 0.5; // Minimum speed to use COG
const POSITION_HISTORY_SIZE = 5; // Number of positions for averaging

interface PositionFix {
  lat: number;
  lng: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

interface StablePosition {
  lat: number;
  lng: number;
  snappedLat: number;
  snappedLng: number;
  heading: number | null;
  smoothedSpeed: number;
  distanceToRoute: number;
  isOnRoute: boolean;
  closestSegmentIndex: number;
}

/**
 * Calculate distance between two points (Haversine)
 */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Calculate bearing between two points
 */
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

/**
 * Smooth angle interpolation (handles 360° wraparound)
 */
function smoothAngle(current: number, target: number, factor: number): number {
  let diff = target - current;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return ((current + diff * factor) + 360) % 360;
}

/**
 * Project point onto line segment, return nearest point and distance
 */
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

/**
 * Hook for stable navigation positioning with map matching
 */
export function useStableNavigation() {
  // Position history for averaging
  const positionHistoryRef = useRef<PositionFix[]>([]);
  
  // Smoothed values
  const smoothedHeadingRef = useRef<number | null>(null);
  const smoothedSpeedRef = useRef<number>(0);
  
  // Last valid heading
  const lastValidHeadingRef = useRef<number | null>(null);
  
  // Last matched segment
  const lastSegmentRef = useRef<number>(0);

  /**
   * Calculate course-over-ground from position history
   */
  const calculateCOG = useCallback((): number | null => {
    const history = positionHistoryRef.current;
    if (history.length < 2) return null;

    const latest = history[history.length - 1];
    const oldest = history[0];
    
    const distance = haversineDistance(oldest.lat, oldest.lng, latest.lat, latest.lng);
    const timeDelta = (latest.timestamp - oldest.timestamp) / 1000;
    
    if (distance < MIN_COG_DISTANCE_M || timeDelta < 0.1) {
      return lastValidHeadingRef.current;
    }

    const speed = distance / timeDelta;
    if (speed < MIN_COG_SPEED_MPS) {
      return lastValidHeadingRef.current;
    }

    const cog = calculateBearing(oldest.lat, oldest.lng, latest.lat, latest.lng);
    lastValidHeadingRef.current = cog;
    return cog;
  }, []);

  /**
   * Snap position to nearest route segment (map matching)
   */
  const snapToRoute = useCallback((
    lat: number,
    lng: number,
    routeCoords: LngLat[],
    startFromSegment?: number
  ): { snappedLat: number; snappedLng: number; distance: number; segmentIndex: number } => {
    if (routeCoords.length < 2) {
      return { snappedLat: lat, snappedLng: lng, distance: 0, segmentIndex: 0 };
    }

    let minDistance = Infinity;
    let bestLat = lat;
    let bestLng = lng;
    let bestSegment = startFromSegment ?? 0;

    // Search window around last known segment
    const start = Math.max(0, (startFromSegment ?? 0) - 20);
    const end = Math.min(routeCoords.length - 1, (startFromSegment ?? 0) + 60);

    for (let i = start; i < end; i++) {
      const [ax, ay] = routeCoords[i];
      const [bx, by] = routeCoords[i + 1];

      // Project lat/lng to segment (simplified planar projection)
      const proj = projectToSegment(lng, lat, ax, ay, bx, by);
      const distance = haversineDistance(lat, lng, proj.y, proj.x);

      if (distance < minDistance) {
        minDistance = distance;
        bestLng = proj.x;
        bestLat = proj.y;
        bestSegment = i;
      }
    }

    return {
      snappedLat: bestLat,
      snappedLng: bestLng,
      distance: minDistance,
      segmentIndex: bestSegment,
    };
  }, []);

  /**
   * Process a new position fix and return stabilized result
   */
  const processPosition = useCallback((
    fix: PositionFix,
    routeCoords: LngLat[]
  ): StablePosition => {
    // Add to history
    positionHistoryRef.current.push(fix);
    if (positionHistoryRef.current.length > POSITION_HISTORY_SIZE) {
      positionHistoryRef.current.shift();
    }

    // Calculate COG from history
    const cogHeading = calculateCOG();
    
    // Prefer GPS heading if available, otherwise use COG
    let heading = fix.heading ?? cogHeading;
    
    // Smooth heading
    if (heading !== null) {
      if (smoothedHeadingRef.current !== null) {
        heading = smoothAngle(smoothedHeadingRef.current, heading, HEADING_SMOOTH_FACTOR);
      }
      smoothedHeadingRef.current = heading;
    }

    // Smooth speed
    const rawSpeed = fix.speed ?? 0;
    smoothedSpeedRef.current = smoothedSpeedRef.current * (1 - SPEED_SMOOTH_FACTOR) + rawSpeed * SPEED_SMOOTH_FACTOR;

    // Snap to route
    const snap = snapToRoute(fix.lat, fix.lng, routeCoords, lastSegmentRef.current);
    lastSegmentRef.current = snap.segmentIndex;

    // Blend position toward route (soft snap)
    const isCloseToRoute = snap.distance <= SNAP_MAX_DISTANCE_M;
    const blendFactor = isCloseToRoute 
      ? SNAP_BLEND_FACTOR * (1 - snap.distance / SNAP_MAX_DISTANCE_M)
      : 0;

    const blendedLat = fix.lat + (snap.snappedLat - fix.lat) * blendFactor;
    const blendedLng = fix.lng + (snap.snappedLng - fix.lng) * blendFactor;

    return {
      lat: fix.lat,
      lng: fix.lng,
      snappedLat: blendedLat,
      snappedLng: blendedLng,
      heading: smoothedHeadingRef.current,
      smoothedSpeed: smoothedSpeedRef.current,
      distanceToRoute: snap.distance,
      isOnRoute: snap.distance <= SNAP_MAX_DISTANCE_M,
      closestSegmentIndex: snap.segmentIndex,
    };
  }, [calculateCOG, snapToRoute]);

  /**
   * Reset internal state (e.g., when route changes)
   */
  const reset = useCallback(() => {
    positionHistoryRef.current = [];
    smoothedHeadingRef.current = null;
    smoothedSpeedRef.current = 0;
    lastValidHeadingRef.current = null;
    lastSegmentRef.current = 0;
  }, []);

  return useMemo(() => ({
    processPosition,
    reset,
  }), [processPosition, reset]);
}
