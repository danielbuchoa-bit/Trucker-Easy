import type { LngLat } from './hereFlexiblePolyline';
import type { RouteInstruction } from '@/services/HereService';

export interface NavigationProgress {
  /** Current instruction index */
  currentInstructionIndex: number;
  /** Distance to next maneuver in meters */
  distanceToNextManeuver: number;
  /** Remaining distance to destination in meters */
  remainingDistance: number;
  /** Remaining duration in seconds */
  remainingDuration: number;
  /** Completed percentage 0-100 */
  completedPercentage: number;
  /** True if we reached the destination */
  arrived: boolean;
}

/**
 * Haversine distance in meters between two points.
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Find the closest point on the route to the user's position.
 * Returns { index, distance } where index is the segment index.
 */
export function findClosestPointOnRoute(
  userLng: number,
  userLat: number,
  routeCoords: LngLat[]
): { index: number; distance: number } {
  let minDist = Infinity;
  let minIndex = 0;

  for (let i = 0; i < routeCoords.length; i++) {
    const [lng, lat] = routeCoords[i];
    const dist = haversineDistance(userLat, userLng, lat, lng);
    if (dist < minDist) {
      minDist = dist;
      minIndex = i;
    }
  }

  return { index: minIndex, distance: minDist };
}

/**
 * Calculate remaining route distance from a given point index.
 */
export function calculateRemainingDistance(
  routeCoords: LngLat[],
  fromIndex: number
): number {
  let dist = 0;
  for (let i = fromIndex; i < routeCoords.length - 1; i++) {
    const [lng1, lat1] = routeCoords[i];
    const [lng2, lat2] = routeCoords[i + 1];
    dist += haversineDistance(lat1, lng1, lat2, lng2);
  }
  return dist;
}

/**
 * Determine which instruction is current based on distance traveled.
 * Instructions have cumulative lengths; we find the first whose cumulative end is ahead of us.
 */
export function getCurrentInstructionIndex(
  instructions: RouteInstruction[],
  distanceTraveled: number
): number {
  let cumulative = 0;

  for (let i = 0; i < instructions.length; i++) {
    cumulative += instructions[i].length;
    if (distanceTraveled < cumulative) {
      return i;
    }
  }

  return instructions.length - 1;
}

/**
 * Calculate full navigation progress.
 */
export function calculateNavigationProgress(
  userLng: number,
  userLat: number,
  routeCoords: LngLat[],
  instructions: RouteInstruction[],
  totalDistance: number,
  totalDuration: number
): NavigationProgress {
  if (routeCoords.length === 0) {
    return {
      currentInstructionIndex: 0,
      distanceToNextManeuver: 0,
      remainingDistance: totalDistance,
      remainingDuration: totalDuration,
      completedPercentage: 0,
      arrived: false,
    };
  }

  const { index, distance: distFromRoute } = findClosestPointOnRoute(
    userLng,
    userLat,
    routeCoords
  );

  const remainingDistance = calculateRemainingDistance(routeCoords, index);
  const traveledDistance = totalDistance - remainingDistance;

  const completedPercentage = Math.min(
    100,
    Math.max(0, (traveledDistance / totalDistance) * 100)
  );

  const currentInstructionIndex = getCurrentInstructionIndex(
    instructions,
    traveledDistance
  );

  // Distance to next maneuver: sum lengths of instructions from current index
  let distToNext = 0;
  if (instructions[currentInstructionIndex]) {
    let cumulative = 0;
    for (let i = 0; i <= currentInstructionIndex; i++) {
      cumulative += instructions[i].length;
    }
    distToNext = Math.max(0, cumulative - traveledDistance);
  }

  // Remaining duration estimate based on percentage
  const remainingDuration = Math.round(totalDuration * (1 - completedPercentage / 100));

  // Arrived if within 50m of destination
  const destCoord = routeCoords[routeCoords.length - 1];
  const distToDest = haversineDistance(userLat, userLng, destCoord[1], destCoord[0]);
  const arrived = distToDest < 50;

  return {
    currentInstructionIndex,
    distanceToNextManeuver: Math.round(distToNext),
    remainingDistance: Math.round(remainingDistance),
    remainingDuration,
    completedPercentage,
    arrived,
  };
}

/**
 * Get maneuver icon name based on instruction text.
 */
export function getManeuverIcon(instruction: string): string {
  const lower = instruction.toLowerCase();

  if (lower.includes('left')) return 'turn-left';
  if (lower.includes('right')) return 'turn-right';
  if (lower.includes('u-turn') || lower.includes('uturn')) return 'u-turn';
  if (lower.includes('merge')) return 'merge';
  if (lower.includes('exit')) return 'exit';
  if (lower.includes('roundabout') || lower.includes('rotary')) return 'roundabout';
  if (lower.includes('arrive') || lower.includes('destination')) return 'destination';
  if (lower.includes('continue') || lower.includes('straight')) return 'straight';

  return 'straight';
}
