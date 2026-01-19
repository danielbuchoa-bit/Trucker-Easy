/**
 * Weighted Segment Selection for Map Matching
 * 
 * Selects the best route segment considering:
 * 1. Distance from GPS position to segment
 * 2. Heading alignment between vehicle and segment
 * 3. Continuity with previous segment (avoid jumps)
 * 4. Speed consistency with road type
 */

import { MAP_MATCHING, SNAP, SPEED_THRESHOLDS } from './constants';
import { 
  haversineDistance, 
  calculateBearing, 
  absoluteAngularDifference,
  projectToSegment 
} from './geometry';
import type { LngLat } from '@/lib/hereFlexiblePolyline';

export interface SegmentCandidate {
  index: number;
  // Projection onto segment
  projectedLat: number;
  projectedLng: number;
  projectionT: number; // 0-1 along segment
  // Distance from GPS to projected point
  distanceM: number;
  // Segment bearing
  bearing: number;
  // Scores
  distanceScore: number;
  headingScore: number;
  continuityScore: number;
  speedScore: number;
  totalScore: number;
}

export interface SegmentSelectionResult {
  bestSegment: SegmentCandidate;
  candidates: SegmentCandidate[];
  confidence: number;
  shouldSnap: boolean;
}

/**
 * Calculate distance score (0-1, higher is better)
 */
function calculateDistanceScore(distanceM: number): number {
  if (distanceM <= SNAP.HARD_DISTANCE_M) {
    return 1.0;
  }
  if (distanceM >= SNAP.MAX_DISTANCE_M) {
    return 0.0;
  }
  // Linear falloff
  return 1 - (distanceM - SNAP.HARD_DISTANCE_M) / (SNAP.MAX_DISTANCE_M - SNAP.HARD_DISTANCE_M);
}

/**
 * Calculate heading alignment score (0-1, higher is better)
 */
function calculateHeadingScore(
  vehicleHeading: number | null,
  segmentBearing: number
): number {
  if (vehicleHeading === null) {
    return 0.5; // Neutral when no heading
  }
  
  const diff = absoluteAngularDifference(vehicleHeading, segmentBearing);
  
  if (diff <= 15) {
    return 1.0; // Perfect alignment
  }
  if (diff >= MAP_MATCHING.MAX_HEADING_DIFF) {
    return 0.0; // Wrong direction
  }
  
  // Linear falloff
  return 1 - (diff - 15) / (MAP_MATCHING.MAX_HEADING_DIFF - 15);
}

/**
 * Calculate continuity score (0-1, higher is better)
 */
function calculateContinuityScore(
  segmentIndex: number,
  lastSegmentIndex: number | null,
  isMovingForward: boolean
): number {
  if (lastSegmentIndex === null) {
    return 0.5; // Neutral on first match
  }
  
  const diff = segmentIndex - lastSegmentIndex;
  
  // Same segment or next segment = perfect
  if (diff >= 0 && diff <= 1) {
    return 1.0;
  }
  
  // Moving forward along route = good
  if (diff > 1 && diff <= 5) {
    return 0.8;
  }
  
  // Slight backward = acceptable (U-turn, correction)
  if (diff >= -2 && diff < 0) {
    return 0.6;
  }
  
  // Far jump = suspicious
  if (Math.abs(diff) > 10) {
    return 0.1;
  }
  
  return 0.4;
}

/**
 * Calculate speed consistency score (0-1, higher is better)
 * Based on whether current speed matches expected road type
 */
function calculateSpeedScore(
  speedMps: number | null,
  isHighway: boolean
): number {
  if (speedMps === null || speedMps < SPEED_THRESHOLDS.STATIONARY) {
    return 0.5; // Neutral when stationary
  }
  
  if (isHighway) {
    // Highway: expect higher speeds
    if (speedMps > SPEED_THRESHOLDS.MEDIUM) {
      return 1.0;
    }
    if (speedMps > SPEED_THRESHOLDS.LOW) {
      return 0.7;
    }
    return 0.4; // Too slow for highway
  } else {
    // Local road: expect lower speeds
    if (speedMps < SPEED_THRESHOLDS.MEDIUM) {
      return 1.0;
    }
    if (speedMps < SPEED_THRESHOLDS.HIGH) {
      return 0.7;
    }
    return 0.5; // Fast for local road but possible
  }
}

/**
 * Select the best segment from route coordinates
 */
export function selectBestSegment(
  lat: number,
  lng: number,
  heading: number | null,
  speedMps: number | null,
  routeCoords: LngLat[],
  lastSegmentIndex: number | null,
  options?: {
    searchAhead?: number;
    searchBehind?: number;
    forceInclude?: number[]; // Segment indices to always evaluate
  }
): SegmentSelectionResult {
  if (routeCoords.length < 2) {
    return {
      bestSegment: {
        index: 0,
        projectedLat: lat,
        projectedLng: lng,
        projectionT: 0,
        distanceM: 0,
        bearing: 0,
        distanceScore: 0,
        headingScore: 0,
        continuityScore: 0,
        speedScore: 0,
        totalScore: 0,
      },
      candidates: [],
      confidence: 0,
      shouldSnap: false,
    };
  }

  const searchAhead = options?.searchAhead ?? MAP_MATCHING.SEARCH_AHEAD;
  const searchBehind = options?.searchBehind ?? MAP_MATCHING.SEARCH_BEHIND;

  // Determine search window
  let start = 0;
  let end = routeCoords.length - 2;

  if (lastSegmentIndex !== null) {
    start = Math.max(0, lastSegmentIndex - searchBehind);
    end = Math.min(routeCoords.length - 2, lastSegmentIndex + searchAhead);
  }

  const candidates: SegmentCandidate[] = [];
  const isMovingForward = speedMps !== null && speedMps > SPEED_THRESHOLDS.STATIONARY;

  // Evaluate each segment in window
  for (let i = start; i <= end; i++) {
    const [lng1, lat1] = routeCoords[i];
    const [lng2, lat2] = routeCoords[i + 1];

    // Project point onto segment
    const proj = projectToSegment(lng, lat, lng1, lat1, lng2, lat2);
    const projectedLng = proj.x;
    const projectedLat = proj.y;

    // Calculate distance
    const distanceM = haversineDistance(lat, lng, projectedLat, projectedLng);

    // Skip if too far
    if (distanceM > SNAP.MAX_DISTANCE_M * 2) {
      continue;
    }

    // Calculate segment bearing
    const bearing = calculateBearing(lat1, lng1, lat2, lng2);

    // Calculate individual scores
    const distanceScore = calculateDistanceScore(distanceM);
    const headingScore = calculateHeadingScore(heading, bearing);
    const continuityScore = calculateContinuityScore(i, lastSegmentIndex, isMovingForward);
    const speedScore = calculateSpeedScore(speedMps, false); // TODO: detect highway

    // Calculate weighted total score
    let totalScore = 
      distanceScore * MAP_MATCHING.DISTANCE_WEIGHT +
      headingScore * MAP_MATCHING.HEADING_WEIGHT +
      continuityScore * MAP_MATCHING.CONTINUITY_WEIGHT +
      speedScore * MAP_MATCHING.SPEED_WEIGHT;

    // Bonus for forward progression
    if (lastSegmentIndex !== null && i > lastSegmentIndex && i <= lastSegmentIndex + 3) {
      totalScore += MAP_MATCHING.FORWARD_BONUS;
    }

    candidates.push({
      index: i,
      projectedLat,
      projectedLng,
      projectionT: proj.t,
      distanceM,
      bearing,
      distanceScore,
      headingScore,
      continuityScore,
      speedScore,
      totalScore,
    });
  }

  // Sort by total score (descending)
  candidates.sort((a, b) => b.totalScore - a.totalScore);

  // Select best candidate
  const best = candidates[0] || {
    index: lastSegmentIndex ?? 0,
    projectedLat: lat,
    projectedLng: lng,
    projectionT: 0,
    distanceM: 0,
    bearing: 0,
    distanceScore: 0,
    headingScore: 0,
    continuityScore: 0,
    speedScore: 0,
    totalScore: 0,
  };

  // Calculate confidence
  let confidence = best.totalScore;
  
  // Reduce confidence if second best is close
  if (candidates.length >= 2) {
    const scoreDiff = best.totalScore - candidates[1].totalScore;
    if (scoreDiff < 0.1) {
      confidence *= 0.7; // Ambiguous match
    }
  }

  // Determine if we should snap
  const shouldSnap = 
    confidence >= SNAP.MIN_CONFIDENCE &&
    best.distanceM <= SNAP.MAX_DISTANCE_M &&
    (heading === null || best.headingScore > 0.3);

  return {
    bestSegment: best,
    candidates: candidates.slice(0, 5), // Top 5 for debugging
    confidence,
    shouldSnap,
  };
}

/**
 * Calculate snap strength based on confidence and distance
 */
export function calculateSnapStrength(
  distanceM: number,
  confidence: number
): number {
  if (distanceM >= SNAP.MAX_DISTANCE_M || confidence < SNAP.MIN_CONFIDENCE) {
    return 0;
  }

  if (distanceM <= SNAP.HARD_DISTANCE_M) {
    return confidence; // Full confidence-based snap when very close
  }

  // Exponential decay between hard and max distance
  const normalized = (distanceM - SNAP.HARD_DISTANCE_M) / 
                     (SNAP.MAX_DISTANCE_M - SNAP.HARD_DISTANCE_M);
  const distanceFactor = Math.pow(1 - normalized, SNAP.BLEND_CURVE);

  return distanceFactor * confidence;
}
