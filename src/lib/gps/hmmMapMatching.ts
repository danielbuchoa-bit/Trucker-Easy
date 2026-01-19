/**
 * Hidden Markov Model (HMM) Map Matching
 * 
 * Probabilistic map matching using:
 * - Emission probability: P(observation | state) based on distance + heading
 * - Transition probability: P(state_t | state_{t-1}) based on route continuity
 * 
 * Uses a sliding window Viterbi algorithm for real-time matching.
 */

import { HMM, MAP_MATCHING, SNAP, SPEED_THRESHOLDS } from './constants';
import { 
  haversineDistance, 
  calculateBearing, 
  absoluteAngularDifference,
  projectToSegment 
} from './geometry';
import type { LngLat } from '@/lib/hereFlexiblePolyline';

// === TYPES ===

export interface HMMCandidate {
  segmentIndex: number;
  projectedLat: number;
  projectedLng: number;
  distanceM: number;
  bearing: number;
  emissionProb: number;
}

export interface HMMState {
  observations: Array<{
    lat: number;
    lng: number;
    heading: number | null;
    timestamp: number;
    candidates: HMMCandidate[];
    bestPath: number[]; // Segment indices
    probabilities: number[];
  }>;
  currentBestSegment: number;
  lastMatchedLat: number;
  lastMatchedLng: number;
}

export interface HMMResult {
  segmentIndex: number;
  matchedLat: number;
  matchedLng: number;
  confidence: number;
  pathHistory: number[];
}

// === PROBABILITY FUNCTIONS ===

/**
 * Calculate emission probability P(observation | state)
 * Based on distance and heading alignment
 */
function calculateEmissionProbability(
  distanceM: number,
  vehicleHeading: number | null,
  segmentBearing: number
): number {
  // Distance component (Gaussian)
  const distanceProb = Math.exp(-(distanceM ** 2) / (2 * HMM.SIGMA_Z ** 2));

  // Heading component (if available)
  let headingProb = 1.0;
  if (vehicleHeading !== null) {
    const headingDiff = absoluteAngularDifference(vehicleHeading, segmentBearing);
    // Von Mises-like distribution
    headingProb = Math.exp(-headingDiff / 30);
  }

  return distanceProb * headingProb;
}

/**
 * Calculate transition probability P(state_t | state_{t-1})
 * Based on route distance vs great circle distance
 */
function calculateTransitionProbability(
  fromSegment: number,
  toSegment: number,
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  routeCoords: LngLat[]
): number {
  // Great circle distance between observations
  const directDistance = haversineDistance(fromLat, fromLng, toLat, toLng);
  
  if (directDistance < 1) {
    // Very close points - high probability for same/adjacent segment
    if (Math.abs(toSegment - fromSegment) <= 1) {
      return 1.0;
    }
    return 0.5;
  }

  // Route distance between segments
  let routeDistance = 0;
  const start = Math.min(fromSegment, toSegment);
  const end = Math.max(fromSegment, toSegment);
  
  for (let i = start; i < end && i < routeCoords.length - 1; i++) {
    const [lng1, lat1] = routeCoords[i];
    const [lng2, lat2] = routeCoords[i + 1];
    routeDistance += haversineDistance(lat1, lng1, lat2, lng2);
  }

  // Difference between route distance and direct distance
  const diff = Math.abs(routeDistance - directDistance);
  
  // Exponential decay based on difference
  let prob = Math.exp(-diff / (HMM.BETA * directDistance + 1));
  
  // Bonus for forward progression
  if (toSegment > fromSegment && toSegment <= fromSegment + 5) {
    prob *= 1.2;
  }
  
  // Penalty for large backward jumps
  if (fromSegment - toSegment > 3) {
    prob *= 0.5;
  }

  return Math.max(HMM.MIN_TRANSITION_PROB, Math.min(1, prob));
}

/**
 * Find candidate segments for an observation
 */
function findCandidates(
  lat: number,
  lng: number,
  heading: number | null,
  routeCoords: LngLat[],
  searchCenter: number
): HMMCandidate[] {
  const candidates: HMMCandidate[] = [];
  
  const start = Math.max(0, searchCenter - MAP_MATCHING.SEARCH_BEHIND);
  const end = Math.min(routeCoords.length - 2, searchCenter + MAP_MATCHING.SEARCH_AHEAD);

  for (let i = start; i <= end; i++) {
    const [lng1, lat1] = routeCoords[i];
    const [lng2, lat2] = routeCoords[i + 1];

    const proj = projectToSegment(lng, lat, lng1, lat1, lng2, lat2);
    const distanceM = haversineDistance(lat, lng, proj.y, proj.x);

    if (distanceM > SNAP.MAX_DISTANCE_M * 3) {
      continue;
    }

    const bearing = calculateBearing(lat1, lng1, lat2, lng2);
    const emissionProb = calculateEmissionProbability(distanceM, heading, bearing);

    candidates.push({
      segmentIndex: i,
      projectedLat: proj.y,
      projectedLng: proj.x,
      distanceM,
      bearing,
      emissionProb,
    });
  }

  // Sort by emission probability and take top candidates
  candidates.sort((a, b) => b.emissionProb - a.emissionProb);
  return candidates.slice(0, HMM.MAX_CANDIDATES);
}

/**
 * Create initial HMM state
 */
export function createHMMState(): HMMState {
  return {
    observations: [],
    currentBestSegment: 0,
    lastMatchedLat: 0,
    lastMatchedLng: 0,
  };
}

/**
 * Process a new observation through the HMM
 */
export function processHMMObservation(
  state: HMMState,
  lat: number,
  lng: number,
  heading: number | null,
  timestamp: number,
  routeCoords: LngLat[]
): HMMResult {
  // Find candidates for this observation
  const candidates = findCandidates(
    lat, lng, heading, routeCoords, state.currentBestSegment
  );

  if (candidates.length === 0) {
    // No candidates found - return last known position
    return {
      segmentIndex: state.currentBestSegment,
      matchedLat: lat,
      matchedLng: lng,
      confidence: 0,
      pathHistory: [],
    };
  }

  // Get previous observation
  const prevObs = state.observations[state.observations.length - 1];

  // Calculate path probabilities
  const pathProbs: number[] = new Array(candidates.length).fill(0);
  const bestPrevIndex: number[] = new Array(candidates.length).fill(-1);

  if (prevObs && prevObs.candidates.length > 0) {
    // Viterbi step: for each current candidate, find best previous
    for (let j = 0; j < candidates.length; j++) {
      const currCand = candidates[j];
      let maxProb = 0;
      let maxIdx = 0;

      for (let i = 0; i < prevObs.candidates.length; i++) {
        const prevCand = prevObs.candidates[i];
        
        // Transition probability
        const transProb = calculateTransitionProbability(
          prevCand.segmentIndex,
          currCand.segmentIndex,
          prevObs.candidates[i].projectedLat,
          prevObs.candidates[i].projectedLng,
          currCand.projectedLat,
          currCand.projectedLng,
          routeCoords
        );

        // Total probability = prev path prob * transition * emission
        const totalProb = prevObs.probabilities[i] * transProb * currCand.emissionProb;

        if (totalProb > maxProb) {
          maxProb = totalProb;
          maxIdx = i;
        }
      }

      pathProbs[j] = maxProb;
      bestPrevIndex[j] = maxIdx;
    }
  } else {
    // First observation - use emission probability only
    for (let j = 0; j < candidates.length; j++) {
      pathProbs[j] = candidates[j].emissionProb;
    }
  }

  // Normalize probabilities
  const probSum = pathProbs.reduce((a, b) => a + b, 0);
  if (probSum > 0) {
    for (let j = 0; j < pathProbs.length; j++) {
      pathProbs[j] /= probSum;
    }
  }

  // Find best candidate
  let bestIdx = 0;
  let bestProb = pathProbs[0];
  for (let j = 1; j < pathProbs.length; j++) {
    if (pathProbs[j] > bestProb) {
      bestProb = pathProbs[j];
      bestIdx = j;
    }
  }

  const bestCandidate = candidates[bestIdx];

  // Reconstruct path (simplified - just track last few)
  const pathHistory: number[] = [];
  if (prevObs && bestPrevIndex[bestIdx] >= 0) {
    pathHistory.push(...(prevObs.bestPath || []).slice(-4));
  }
  pathHistory.push(bestCandidate.segmentIndex);

  // Store observation
  const observation = {
    lat,
    lng,
    heading,
    timestamp,
    candidates,
    bestPath: pathHistory,
    probabilities: pathProbs,
  };

  // Maintain window size
  state.observations.push(observation);
  if (state.observations.length > HMM.WINDOW_SIZE) {
    state.observations.shift();
  }

  // Update state
  state.currentBestSegment = bestCandidate.segmentIndex;
  state.lastMatchedLat = bestCandidate.projectedLat;
  state.lastMatchedLng = bestCandidate.projectedLng;

  return {
    segmentIndex: bestCandidate.segmentIndex,
    matchedLat: bestCandidate.projectedLat,
    matchedLng: bestCandidate.projectedLng,
    confidence: bestProb,
    pathHistory,
  };
}

/**
 * Reset HMM state (call when route changes)
 */
export function resetHMMState(state: HMMState): void {
  state.observations = [];
  state.currentBestSegment = 0;
  state.lastMatchedLat = 0;
  state.lastMatchedLng = 0;
}
