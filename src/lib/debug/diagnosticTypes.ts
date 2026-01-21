/**
 * Diagnostic Types for HERE ↔ Mapbox Integration
 */

import type { DiagnosticErrorCode } from './debugNavConfig';

// === HERE ROUTING DIAGNOSTIC ===
export interface HereRoutingDiagnostic {
  timestamp: number;
  endpoint: string;
  apiVersion: 'v7' | 'v8' | 'unknown';
  requestLatencyMs: number;
  statusCode: number;
  responseSizeBytes: number;
  hasPolyline: boolean;
  polylinePath: string; // e.g., "routes[0].sections[0].polyline"
  polylineFormat: 'flexible' | 'google' | 'unknown';
  decodedPointCount: number;
  rawPolylinePreview: string; // First 50 chars
  error?: string;
}

// === MAPBOX RENDER DIAGNOSTIC ===
export interface MapboxRenderDiagnostic {
  timestamp: number;
  styleLoaded: boolean;
  mapLoaded: boolean;
  routeSourceExists: boolean;
  routeSourceId: string;
  routeLayerExists: boolean;
  routeLayerId: string;
  featureCount: number;
  pointCount: number;
  lastUpdateMs: number;
  error?: string;
}

// === GPS DIAGNOSTIC ===
export interface GpsDiagnostic {
  timestamp: number;
  updateRateHz: number;
  lastLat: number;
  lastLng: number;
  speed: number;
  heading: number;
  accuracy: number;
  timeSinceLastUpdateMs: number;
  isStale: boolean;
  provider: 'gps' | 'network' | 'fused' | 'unknown';
}

// === POLYLINE VALIDATION ===
export interface PolylineValidation {
  timestamp: number;
  inputLength: number;
  decodedPoints: number;
  isValid: boolean;
  format: 'flexible' | 'google' | 'unknown';
  errors: PolylineError[];
  boundingBox: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  } | null;
}

export interface PolylineError {
  index: number;
  lat: number;
  lng: number;
  errorCode: DiagnosticErrorCode;
  message: string;
}

// === COORDINATE CHECK ===
export interface CoordinateCheck {
  isValid: boolean;
  lat: number;
  lng: number;
  issues: DiagnosticErrorCode[];
  possibleSwap: boolean;
}

// === ERROR COUNTERS ===
export interface ErrorCounters {
  auth401: number;
  auth403: number;
  rateLimit429: number;
  server5xx: number;
  parseErrors: number;
  polylineDecodeErrors: number;
  coordSwapErrors: number;
  timeouts: number;
  networkErrors: number;
}

// === TIMING EVENTS ===
export type TimingEventType = 
  | 'map_init_start'
  | 'map_init_complete'
  | 'style_loaded'
  | 'map_loaded'
  | 'route_request_start'
  | 'route_response_received'
  | 'polyline_decode_start'
  | 'polyline_decode_complete'
  | 'geojson_created'
  | 'source_added'
  | 'layer_added'
  | 'route_rendered';

export interface TimingEvent {
  type: TimingEventType;
  timestamp: number;
  durationFromPrevMs?: number;
  metadata?: Record<string, unknown>;
}

// === PASS/FAIL CHECKLIST ===
export interface DiagnosticChecklist {
  timestamp: number;
  checks: DiagnosticCheck[];
  overallStatus: 'pass' | 'fail' | 'partial';
  failedCount: number;
  passedCount: number;
}

export interface DiagnosticCheck {
  id: string;
  name: string;
  status: 'pass' | 'fail' | 'warning' | 'pending';
  details?: string;
  recommendation?: string;
}

// === FULL DIAGNOSTIC STATE ===
export interface NavigationDiagnosticState {
  isEnabled: boolean;
  sessionStartTime: number;
  
  // Latest snapshots
  hereRouting: HereRoutingDiagnostic | null;
  mapboxRender: MapboxRenderDiagnostic | null;
  gps: GpsDiagnostic | null;
  
  // Validation
  lastPolylineValidation: PolylineValidation | null;
  
  // Error tracking
  errorCounters: ErrorCounters;
  
  // Timing
  timingEvents: TimingEvent[];
  
  // History (last 50 events)
  eventLog: DiagnosticEvent[];
  
  // Checklist
  checklist: DiagnosticChecklist | null;
}

export interface DiagnosticEvent {
  id: string;
  timestamp: number;
  category: 'HERE' | 'Mapbox' | 'GPS' | 'Polyline' | 'Validation' | 'Error';
  type: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  data?: Record<string, unknown>;
}

// === INITIAL STATE ===
export const initialDiagnosticState: NavigationDiagnosticState = {
  isEnabled: false,
  sessionStartTime: Date.now(),
  hereRouting: null,
  mapboxRender: null,
  gps: null,
  lastPolylineValidation: null,
  errorCounters: {
    auth401: 0,
    auth403: 0,
    rateLimit429: 0,
    server5xx: 0,
    parseErrors: 0,
    polylineDecodeErrors: 0,
    coordSwapErrors: 0,
    timeouts: 0,
    networkErrors: 0,
  },
  timingEvents: [],
  eventLog: [],
  checklist: null,
};
