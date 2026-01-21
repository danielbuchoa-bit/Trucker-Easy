/**
 * DEBUG_NAV Configuration
 * 
 * Comprehensive navigation diagnostics for HERE ↔ Mapbox integration
 */

// === DEBUG MODE TOGGLE ===
// Set this to true to enable full diagnostic logging and overlay panel
export const DEBUG_NAV = {
  // Master toggle - enables all debugging features
  enabled: true, // Set to false in production
  
  // Individual feature toggles
  features: {
    // Log all HERE API requests/responses
    logHereRequests: true,
    // Log Mapbox source/layer operations
    logMapboxRender: true,
    // Log GPS updates and positioning
    logGpsUpdates: true,
    // Log polyline decode operations
    logPolylineDecode: true,
    // Show overlay panel with real-time stats
    showOverlayPanel: true,
    // Run automated validation checks
    runValidationChecks: true,
    // Log detailed timing information
    logTiming: true,
    // Log coordinate validation (lat/lng order checks)
    logCoordinateValidation: true,
  },
  
  // Rate limiting for logs (prevent console spam)
  logRateLimits: {
    gpsUpdatesPerSecond: 2,
    mapboxUpdatesPerSecond: 5,
  },
};

// === ERROR CODES ===
export const DiagnosticErrorCodes = {
  // HERE API Errors
  HERE_AUTH_FAIL: 'HERE_AUTH_401_403',
  HERE_RATE_LIMIT: 'HERE_RATE_LIMIT_429',
  HERE_SERVER_ERROR: 'HERE_SERVER_5XX',
  HERE_PARSE_FAIL: 'HERE_PARSE_FAIL',
  HERE_TIMEOUT: 'HERE_TIMEOUT',
  HERE_NO_ROUTE: 'HERE_NO_ROUTE',
  
  // Polyline Errors
  POLYLINE_DECODE_FAIL: 'POLYLINE_DECODE_FAIL',
  POLYLINE_EMPTY: 'POLYLINE_EMPTY',
  POLYLINE_TOO_FEW_POINTS: 'POLYLINE_TOO_FEW_POINTS',
  
  // Coordinate Errors
  COORD_INVALID_LAT: 'COORD_INVALID_LAT',
  COORD_INVALID_LNG: 'COORD_INVALID_LNG',
  COORD_SWAPPED: 'COORD_LAT_LNG_SWAPPED',
  
  // Mapbox Errors
  MAPBOX_SOURCE_FAIL: 'MAPBOX_SOURCE_FAIL',
  MAPBOX_LAYER_FAIL: 'MAPBOX_LAYER_FAIL',
  MAPBOX_STYLE_NOT_LOADED: 'MAPBOX_STYLE_NOT_LOADED',
  
  // GPS Errors
  GPS_STALE: 'GPS_STALE_LOCATION',
  GPS_LOW_ACCURACY: 'GPS_LOW_ACCURACY',
  GPS_NO_UPDATE: 'GPS_NO_UPDATE',
} as const;

export type DiagnosticErrorCode = typeof DiagnosticErrorCodes[keyof typeof DiagnosticErrorCodes];

// === TEST ROUTES FOR REPRODUCIBLE TESTING ===
export interface TestRoute {
  id: string;
  name: string;
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  expectedBbox: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
  expectedDistanceKm: { min: number; max: number };
}

export const TEST_ROUTES: TestRoute[] = [
  {
    id: 'route_1_sf_la',
    name: 'San Francisco → Los Angeles',
    origin: { lat: 37.7749, lng: -122.4194 },
    destination: { lat: 34.0522, lng: -118.2437 },
    expectedBbox: {
      minLat: 34.0,
      maxLat: 37.8,
      minLng: -122.5,
      maxLng: -118.0,
    },
    expectedDistanceKm: { min: 550, max: 650 },
  },
  {
    id: 'route_2_dallas_houston',
    name: 'Dallas → Houston',
    origin: { lat: 32.7767, lng: -96.7970 },
    destination: { lat: 29.7604, lng: -95.3698 },
    expectedBbox: {
      minLat: 29.5,
      maxLat: 33.0,
      minLng: -97.0,
      maxLng: -95.0,
    },
    expectedDistanceKm: { min: 360, max: 420 },
  },
  {
    id: 'route_3_chicago_detroit',
    name: 'Chicago → Detroit',
    origin: { lat: 41.8781, lng: -87.6298 },
    destination: { lat: 42.3314, lng: -83.0458 },
    expectedBbox: {
      minLat: 41.8,
      maxLat: 42.5,
      minLng: -87.7,
      maxLng: -82.9,
    },
    expectedDistanceKm: { min: 380, max: 460 },
  },
];

// === DIAGNOSTIC THRESHOLDS ===
export const DiagnosticThresholds = {
  // GPS
  gpsStaleMs: 5000, // 5 seconds without update = stale
  gpsLowAccuracyM: 50, // Accuracy worse than 50m is low
  
  // Network
  requestTimeoutMs: 30000, // 30 seconds
  slowRequestMs: 5000, // Log warning if > 5s
  
  // Rate limits
  maxHereCallsPerMinute: 30,
  maxReroutesPerMinute: 10,
  
  // Validation
  minPolylinePoints: 2,
  maxCoordDeviation: 0.001, // ~100m tolerance for bbox comparison
};

// === HELPER: Check if DEBUG mode is enabled ===
export function isDebugNavEnabled(): boolean {
  return DEBUG_NAV.enabled;
}

// === HELPER: Safely log (with rate limiting) ===
const lastLogTimes: Record<string, number> = {};

export function debugLog(category: string, message: string, data?: unknown): void {
  if (!DEBUG_NAV.enabled) return;
  
  const now = Date.now();
  const lastLog = lastLogTimes[category] || 0;
  const minInterval = 100; // 100ms between same-category logs
  
  if (now - lastLog < minInterval) return;
  lastLogTimes[category] = now;
  
  const timestamp = new Date().toISOString().slice(11, 23);
  console.log(`[DEBUG_NAV:${timestamp}] [${category}]`, message, data !== undefined ? data : '');
}

export function debugError(category: string, message: string, error?: unknown): void {
  if (!DEBUG_NAV.enabled) return;
  
  const timestamp = new Date().toISOString().slice(11, 23);
  console.error(`[DEBUG_NAV:${timestamp}] [${category}] ❌`, message, error || '');
}

export function debugWarn(category: string, message: string, data?: unknown): void {
  if (!DEBUG_NAV.enabled) return;
  
  const timestamp = new Date().toISOString().slice(11, 23);
  console.warn(`[DEBUG_NAV:${timestamp}] [${category}] ⚠️`, message, data !== undefined ? data : '');
}
