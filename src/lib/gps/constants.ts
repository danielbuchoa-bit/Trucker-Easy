/**
 * GPS Navigation Constants for Truck Navigation
 * 
 * These values are tuned specifically for commercial trucks:
 * - Slower acceleration/deceleration than cars
 * - Larger turning radius
 * - Higher GPS antenna position (~3m)
 * - Different speed profiles (highway vs urban vs maneuvering)
 */

// === SPEED THRESHOLDS (m/s) ===
export const SPEED_THRESHOLDS = {
  /** Below this speed, ignore heading (stationary/maneuvering) */
  STATIONARY: 1.4, // ~5 km/h
  /** Low speed - urban/yard driving */
  LOW: 5.6, // ~20 km/h
  /** Medium speed - urban arterials */
  MEDIUM: 13.9, // ~50 km/h
  /** High speed - highway driving */
  HIGH: 22.2, // ~80 km/h
  /** Maximum reasonable speed for trucks */
  MAX_TRUCK: 33.3, // ~120 km/h
};

// === SMOOTHING FACTORS (0-1, higher = more responsive) ===
// Adaptive based on speed mode
export const SMOOTHING = {
  // Position smoothing (EMA alpha)
  POSITION: {
    STATIONARY: 0.08, // Very smooth when stopped
    LOW: 0.15,        // Smooth for maneuvering
    MEDIUM: 0.30,     // Balanced for urban
    HIGH: 0.45,       // Responsive for highway
  },
  // Heading smoothing (EMA alpha)
  HEADING: {
    STATIONARY: 0.05, // Almost frozen when stopped
    LOW: 0.12,        // Slow changes in yard
    MEDIUM: 0.25,     // Balanced
    HIGH: 0.40,       // Quick response on highway
  },
  // Speed smoothing (EMA alpha)
  SPEED: {
    STATIONARY: 0.10,
    LOW: 0.20,
    MEDIUM: 0.35,
    HIGH: 0.45,
  },
};

// === SNAP TO ROUTE CONFIGURATION ===
export const SNAP = {
  /** Maximum distance to consider snapping (meters) */
  MAX_DISTANCE_M: 45,
  /** Distance at which snap is 100% (meters) */
  HARD_DISTANCE_M: 12,
  /** Exponential curve for snap blending */
  BLEND_CURVE: 2.0,
  /** Minimum confidence to apply snap (0-1) */
  MIN_CONFIDENCE: 0.6,
};

// === MAP MATCHING CONFIGURATION ===
export const MAP_MATCHING = {
  /** Search window ahead on route (segments) */
  SEARCH_AHEAD: 80,
  /** Search window behind on route (segments) */
  SEARCH_BEHIND: 15,
  /** Weight for distance in segment selection (0-1) */
  DISTANCE_WEIGHT: 0.25,
  /** Weight for heading alignment (0-1) */
  HEADING_WEIGHT: 0.45,
  /** Weight for segment continuity (0-1) */
  CONTINUITY_WEIGHT: 0.20,
  /** Weight for speed consistency (0-1) */
  SPEED_WEIGHT: 0.10,
  /** Maximum heading difference to consider (degrees) */
  MAX_HEADING_DIFF: 60,
  /** Bonus for forward progression along route */
  FORWARD_BONUS: 0.15,
};

// === COURSE OVER GROUND (COG) ===
export const COG = {
  /** Minimum distance to calculate COG (meters) */
  MIN_DISTANCE_M: 8,
  /** Minimum speed for reliable COG (m/s) */
  MIN_SPEED_MPS: 2.5,
  /** Maximum age of history point (ms) */
  MAX_HISTORY_AGE_MS: 8000,
  /** Number of points to keep in history */
  HISTORY_SIZE: 10,
};

// === KALMAN FILTER CONFIGURATION ===
export const KALMAN = {
  /** Process noise for position (degrees²) */
  Q_POSITION: 0.000001,
  /** Process noise for velocity (degrees²/s²) */
  Q_VELOCITY: 0.00001,
  /** Base measurement noise (degrees²) - scaled by GPS accuracy */
  R_BASE: 0.0000001,
  /** Minimum measurement noise */
  R_MIN: 0.00000001,
  /** Maximum measurement noise */
  R_MAX: 0.0001,
};

// === SPIKE DETECTION ===
export const SPIKE = {
  /** Maximum implied speed before rejection (m/s) */
  MAX_SPEED_MPS: 35, // ~126 km/h
  /** Maximum acceleration before rejection (m/s²) */
  MAX_ACCELERATION: 5.0,
  /** Maximum distance from median (meters) */
  MAX_MEDIAN_DEVIATION_M: 100,
  /** Minimum time between fixes to evaluate (seconds) */
  MIN_TIME_DELTA_S: 0.1,
  /** Maximum time between fixes (seconds) */
  MAX_TIME_DELTA_S: 30,
};

// === DEAD RECKONING ===
export const DEAD_RECKONING = {
  /** Minimum speed to apply dead reckoning (m/s) */
  MIN_SPEED_MPS: 1.5,
  /** Maximum time to project forward (ms) */
  MAX_DURATION_MS: 3000,
  /** Decay factor for confidence over time */
  CONFIDENCE_DECAY: 0.15,
};

// === HMM MAP MATCHING ===
export const HMM = {
  /** Standard deviation for emission probability (meters) */
  SIGMA_Z: 15,
  /** Beta parameter for transition probability */
  BETA: 5,
  /** Maximum candidates per observation */
  MAX_CANDIDATES: 8,
  /** Minimum transition probability */
  MIN_TRANSITION_PROB: 0.001,
  /** History window size for Viterbi */
  WINDOW_SIZE: 10,
};

// === UPDATE INTERVALS ===
export const UPDATE = {
  /** Position update interval - highway (ms) */
  INTERVAL_HIGHWAY_MS: 800,
  /** Position update interval - urban (ms) */
  INTERVAL_URBAN_MS: 500,
  /** Position update interval - maneuvering (ms) */
  INTERVAL_MANEUVERING_MS: 300,
  /** Cursor animation target FPS */
  TARGET_FPS: 60,
  /** State update throttle (ms) - for React renders */
  STATE_THROTTLE_MS: 50,
};

// === HELPER FUNCTIONS ===

/**
 * Get speed mode based on current speed
 */
export function getSpeedMode(speedMps: number): 'STATIONARY' | 'LOW' | 'MEDIUM' | 'HIGH' {
  if (speedMps < SPEED_THRESHOLDS.STATIONARY) return 'STATIONARY';
  if (speedMps < SPEED_THRESHOLDS.LOW) return 'LOW';
  if (speedMps < SPEED_THRESHOLDS.MEDIUM) return 'MEDIUM';
  return 'HIGH';
}

/**
 * Get adaptive smoothing factor for position
 */
export function getPositionSmoothing(speedMps: number, accuracyM?: number): number {
  const mode = getSpeedMode(speedMps);
  let factor = SMOOTHING.POSITION[mode];
  
  // Reduce responsiveness with poor GPS
  if (accuracyM && accuracyM > 15) {
    factor *= Math.max(0.5, 1 - (accuracyM - 15) / 50);
  }
  
  return factor;
}

/**
 * Get adaptive smoothing factor for heading
 */
export function getHeadingSmoothing(speedMps: number): number {
  const mode = getSpeedMode(speedMps);
  return SMOOTHING.HEADING[mode];
}

/**
 * Get adaptive smoothing factor for speed
 */
export function getSpeedSmoothing(speedMps: number): number {
  const mode = getSpeedMode(speedMps);
  return SMOOTHING.SPEED[mode];
}

/**
 * Get position update interval based on driving mode
 */
export function getUpdateInterval(speedMps: number, nearManeuver: boolean): number {
  if (nearManeuver) return UPDATE.INTERVAL_MANEUVERING_MS;
  
  const mode = getSpeedMode(speedMps);
  switch (mode) {
    case 'STATIONARY':
    case 'LOW':
      return UPDATE.INTERVAL_MANEUVERING_MS;
    case 'MEDIUM':
      return UPDATE.INTERVAL_URBAN_MS;
    case 'HIGH':
      return UPDATE.INTERVAL_HIGHWAY_MS;
  }
}
