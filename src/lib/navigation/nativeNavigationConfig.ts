/**
 * Native Navigation Configuration
 * 
 * Adjustable parameters for iOS navigation engine.
 * These can be tuned without code changes.
 */

export interface NativeNavigationConfig {
  // =========================================
  // CORELOCATION SETTINGS
  // =========================================
  
  /**
   * Minimum distance (meters) before new update is triggered
   * Lower = more updates but more battery drain
   * Recommended: 3-10m for navigation
   */
  distanceFilter: number;
  
  /**
   * Minimum time (ms) between updates
   * 200ms = 5Hz, 100ms = 10Hz
   */
  minUpdateIntervalMs: number;
  
  /**
   * Maximum age (ms) for a GPS update to be considered valid
   * Updates older than this are rejected as "stale"
   */
  maxStaleUpdateMs: number;

  // =========================================
  // KALMAN FILTER SETTINGS
  // =========================================
  
  /**
   * Process noise - how much we expect position to change
   * Lower = smoother but slower response
   * Higher = more responsive but noisier
   */
  kalmanQ: number;
  
  /**
   * Measurement noise - how much we trust GPS readings
   * Lower = trust GPS more
   * Higher = filter more aggressively
   */
  kalmanR: number;

  // =========================================
  // SPEED SETTINGS
  // =========================================
  
  /**
   * Number of speed samples to average (moving average)
   * Higher = smoother but slower response
   */
  speedSmoothingSamples: number;
  
  /**
   * Speed below this (m/s) displays as 0
   * Prevents jittery speed display when stopped
   */
  minSpeedThreshold: number;
  
  /**
   * Maximum reasonable speed (m/s)
   * Updates implying higher speed are rejected
   * 45 m/s ≈ 100 mph
   */
  maxReasonableSpeed: number;

  // =========================================
  // HEADING SETTINGS
  // =========================================
  
  /**
   * Lerp factor for heading smoothing (0-1)
   * Lower = smoother rotation but slower
   * Higher = snappier but more jittery
   */
  headingLerpFactor: number;
  
  /**
   * Minimum speed (m/s) before using GPS course for heading
   * Below this, keep last valid heading
   * Prevents rotation jitter when stopped
   */
  minSpeedForHeading: number;

  // =========================================
  // SNAP-TO-ROAD SETTINGS
  // =========================================
  
  /**
   * Distance (meters) within which to snap to route
   * Position is snapped if within this distance
   */
  snapThresholdMeters: number;
  
  /**
   * Distance (meters) before considering driver off-route
   * Highway: 50m, City: 25m
   */
  offRouteThresholdMeters: number;
  
  /**
   * Duration (seconds) off-route before triggering reroute
   * Prevents false reroutes from GPS drift
   */
  offRouteDurationSeconds: number;

  // =========================================
  // TELEPORT PREVENTION
  // =========================================
  
  /**
   * Maximum position jump (meters) before rejecting update
   * Larger jumps trigger dead reckoning instead
   */
  maxPositionJumpMeters: number;
  
  /**
   * Maximum acceleration (m/s²) before rejecting update
   * Prevents accepting physically impossible movements
   */
  maxAccelerationMps2: number;

  // =========================================
  // DEBUG
  // =========================================
  
  /**
   * Enable verbose logging
   */
  enableDebugLogging: boolean;
}

// =========================================
// PRESET CONFIGURATIONS
// =========================================

/**
 * Highway driving configuration
 * More tolerant thresholds for high-speed, smooth roads
 */
export const HIGHWAY_CONFIG: NativeNavigationConfig = {
  // CoreLocation
  distanceFilter: 5,
  minUpdateIntervalMs: 200,
  maxStaleUpdateMs: 2000,
  
  // Kalman
  kalmanQ: 0.00001,
  kalmanR: 0.01,
  
  // Speed
  speedSmoothingSamples: 5,
  minSpeedThreshold: 0.5,
  maxReasonableSpeed: 45, // ~100 mph
  
  // Heading
  headingLerpFactor: 0.15,
  minSpeedForHeading: 2.0,
  
  // Snap
  snapThresholdMeters: 25,
  offRouteThresholdMeters: 50,
  offRouteDurationSeconds: 4,
  
  // Teleport
  maxPositionJumpMeters: 100,
  maxAccelerationMps2: 5,
  
  // Debug
  enableDebugLogging: true,
};

/**
 * City driving configuration
 * Tighter thresholds for low-speed, dense road networks
 */
export const CITY_CONFIG: NativeNavigationConfig = {
  ...HIGHWAY_CONFIG,
  
  // Tighter snap for city streets
  snapThresholdMeters: 15,
  offRouteThresholdMeters: 25,
  offRouteDurationSeconds: 3,
  
  // More responsive heading for turns
  headingLerpFactor: 0.20,
};

/**
 * High-precision configuration
 * For areas requiring maximum accuracy
 */
export const HIGH_PRECISION_CONFIG: NativeNavigationConfig = {
  ...HIGHWAY_CONFIG,
  
  // More frequent updates
  distanceFilter: 3,
  minUpdateIntervalMs: 100, // 10Hz
  
  // Trust GPS more
  kalmanQ: 0.0001,
  kalmanR: 0.005,
  
  // Tighter thresholds
  snapThresholdMeters: 10,
  offRouteThresholdMeters: 20,
};

// =========================================
// CURRENT ACTIVE CONFIG
// =========================================

// This is the config that will be used by default
// Modify these values to tune navigation behavior
let activeConfig: NativeNavigationConfig = { ...HIGHWAY_CONFIG };

export function getActiveConfig(): NativeNavigationConfig {
  return { ...activeConfig };
}

export function setActiveConfig(config: Partial<NativeNavigationConfig>): void {
  activeConfig = { ...activeConfig, ...config };
}

export function resetToHighway(): void {
  activeConfig = { ...HIGHWAY_CONFIG };
}

export function resetToCity(): void {
  activeConfig = { ...CITY_CONFIG };
}

export function resetToHighPrecision(): void {
  activeConfig = { ...HIGH_PRECISION_CONFIG };
}

// =========================================
// DIAGNOSTIC INFO
// =========================================

export interface NavigationDiagnostics {
  lastGpsUpdate: number; // timestamp
  rawLatLng: { lat: number; lng: number };
  snappedLatLng: { lat: number; lng: number } | null;
  snapOffsetM: number;
  speedRaw: number;
  speedSmoothed: number;
  headingCourse: number;
  distanceToRouteM: number;
  rerouteCount: number;
  updateFrequencyHz: number;
  isOnRoute: boolean;
  lastError: string | null;
}

export function createEmptyDiagnostics(): NavigationDiagnostics {
  return {
    lastGpsUpdate: 0,
    rawLatLng: { lat: 0, lng: 0 },
    snappedLatLng: null,
    snapOffsetM: 0,
    speedRaw: 0,
    speedSmoothed: 0,
    headingCourse: 0,
    distanceToRouteM: 0,
    rerouteCount: 0,
    updateFrequencyHz: 0,
    isOnRoute: true,
    lastError: null,
  };
}
