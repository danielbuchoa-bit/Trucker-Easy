/**
 * GPS Geometry Utilities
 * 
 * Core mathematical functions for GPS navigation:
 * - Distance calculations (Haversine)
 * - Bearing calculations
 * - Point-to-segment projection
 * - Angle interpolation
 */

const EARTH_RADIUS_M = 6371000;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const METERS_PER_DEG_LAT = 111000;

/**
 * Convert degrees to radians
 */
export function toRadians(degrees: number): number {
  return degrees * DEG_TO_RAD;
}

/**
 * Convert radians to degrees
 */
export function toDegrees(radians: number): number {
  return radians * RAD_TO_DEG;
}

/**
 * Haversine distance between two points in meters
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const φ1 = lat1 * DEG_TO_RAD;
  const φ2 = lat2 * DEG_TO_RAD;
  const Δφ = (lat2 - lat1) * DEG_TO_RAD;
  const Δλ = (lng2 - lng1) * DEG_TO_RAD;

  const a = Math.sin(Δφ / 2) ** 2 + 
            Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Calculate initial bearing from point 1 to point 2
 * Returns degrees 0-360 (0 = North, 90 = East)
 */
export function calculateBearing(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const φ1 = lat1 * DEG_TO_RAD;
  const φ2 = lat2 * DEG_TO_RAD;
  const Δλ = (lng2 - lng1) * DEG_TO_RAD;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - 
            Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  return ((Math.atan2(y, x) * RAD_TO_DEG) + 360) % 360;
}

/**
 * Calculate angular difference between two bearings
 * Returns value in range -180 to +180
 */
export function angularDifference(bearing1: number, bearing2: number): number {
  let diff = bearing2 - bearing1;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return diff;
}

/**
 * Calculate absolute angular difference (always positive)
 */
export function absoluteAngularDifference(bearing1: number, bearing2: number): number {
  return Math.abs(angularDifference(bearing1, bearing2));
}

/**
 * Smoothly interpolate between two angles
 * factor: 0-1, where 1 = immediate snap to target
 */
export function smoothAngle(current: number, target: number, factor: number): number {
  const diff = angularDifference(current, target);
  return ((current + diff * factor) + 360) % 360;
}

/**
 * Linear interpolation between two values
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

/**
 * Interpolate between two angles with wraparound handling
 */
export function lerpAngle(a: number, b: number, t: number): number {
  const diff = angularDifference(a, b);
  return ((a + diff * Math.max(0, Math.min(1, t))) + 360) % 360;
}

/**
 * Project a point onto a line segment
 * Returns the closest point on the segment and the projection parameter t
 * 
 * @param px, py - Point coordinates
 * @param ax, ay - Segment start coordinates
 * @param bx, by - Segment end coordinates
 * @returns { x, y, t, distance } where t is 0-1 along segment
 */
export function projectToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
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
 * Convert local meter offsets to lat/lng deltas
 */
export function metersToLatLng(
  metersNorth: number,
  metersEast: number,
  atLatitude: number
): { dLat: number; dLng: number } {
  const dLat = metersNorth / METERS_PER_DEG_LAT;
  const dLng = metersEast / (METERS_PER_DEG_LAT * Math.cos(atLatitude * DEG_TO_RAD));
  return { dLat, dLng };
}

/**
 * Project position forward given speed and heading
 */
export function projectPosition(
  lat: number,
  lng: number,
  speedMps: number,
  headingDeg: number,
  deltaMs: number
): { lat: number; lng: number } {
  if (speedMps <= 0 || deltaMs <= 0) {
    return { lat, lng };
  }

  const distanceM = speedMps * (deltaMs / 1000);
  const headingRad = headingDeg * DEG_TO_RAD;

  const dLat = (distanceM * Math.cos(headingRad)) / METERS_PER_DEG_LAT;
  const dLng = (distanceM * Math.sin(headingRad)) / 
               (METERS_PER_DEG_LAT * Math.cos(lat * DEG_TO_RAD));

  return {
    lat: lat + dLat,
    lng: lng + dLng,
  };
}

/**
 * Calculate distance from point to line segment (in meters)
 */
export function distanceToSegment(
  lat: number,
  lng: number,
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const proj = projectToSegment(lng, lat, lng1, lat1, lng2, lat2);
  return haversineDistance(lat, lng, proj.y, proj.x);
}

/**
 * Calculate median position from array of positions
 */
export function calculateMedianPosition(
  positions: Array<{ lat: number; lng: number }>
): { lat: number; lng: number } {
  if (positions.length === 0) {
    return { lat: 0, lng: 0 };
  }

  const lats = positions.map(p => p.lat).sort((a, b) => a - b);
  const lngs = positions.map(p => p.lng).sort((a, b) => a - b);

  const mid = Math.floor(positions.length / 2);

  return {
    lat: positions.length % 2 ? lats[mid] : (lats[mid - 1] + lats[mid]) / 2,
    lng: positions.length % 2 ? lngs[mid] : (lngs[mid - 1] + lngs[mid]) / 2,
  };
}

/**
 * Ease-out cubic function for smooth deceleration
 */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
}

/**
 * Ease-out quart function for smoother deceleration
 */
export function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 4);
}
