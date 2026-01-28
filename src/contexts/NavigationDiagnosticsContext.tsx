/**
 * Navigation Diagnostics Context
 * 
 * Provides comprehensive diagnostics for HERE ↔ Mapbox integration
 */

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { 
  DEBUG_NAV, 
  isDebugNavEnabled, 
  debugLog, 
  debugError, 
  debugWarn,
  DiagnosticErrorCodes,
  DiagnosticThresholds,
} from '@/lib/debug/debugNavConfig';
import {
  type NavigationDiagnosticState,
  type HereRoutingDiagnostic,
  type MapboxRenderDiagnostic,
  type GpsDiagnostic,
  type PolylineValidation,
  type TimingEvent,
  type TimingEventType,
  type DiagnosticEvent,
  type DiagnosticChecklist,
  type DiagnosticCheck,
  type ErrorCounters,
  initialDiagnosticState,
} from '@/lib/debug/diagnosticTypes';
import { validatePolyline } from '@/lib/debug/polylineValidator';

// === CONTEXT TYPE ===
interface NavigationDiagnosticsContextType extends NavigationDiagnosticState {
  // Toggle
  toggleDebugNav: () => void;
  
  // HERE logging
  logHereRequest: (data: {
    endpoint: string;
    apiVersion?: 'v7' | 'v8';
    startTime: number;
  }) => void;
  logHereResponse: (data: {
    endpoint: string;
    apiVersion?: 'v7' | 'v8';
    startTime: number;
    statusCode: number;
    responseSize: number;
    polyline?: string;
    polylinePath?: string;
    error?: string;
  }) => void;
  
  // Mapbox logging
  logMapboxState: (data: Partial<MapboxRenderDiagnostic>) => void;
  
  // GPS logging
  logGpsUpdate: (data: {
    lat: number;
    lng: number;
    speed: number;
    heading: number;
    accuracy: number;
    timestamp: number;
  }) => void;
  
  // Timing
  logTimingEvent: (type: TimingEventType, metadata?: Record<string, unknown>) => void;
  
  // Error tracking
  incrementError: (type: keyof ErrorCounters) => void;
  
  // Polyline validation
  validateAndLogPolyline: (encoded: string) => PolylineValidation;
  
  // Generate checklist
  generateChecklist: () => DiagnosticChecklist;
  
  // Export data
  exportDiagnostics: () => string;
  
  // Reset
  resetDiagnostics: () => void;
}

const NavigationDiagnosticsContext = createContext<NavigationDiagnosticsContextType | null>(null);

export const useNavigationDiagnostics = () => {
  const ctx = useContext(NavigationDiagnosticsContext);
  if (!ctx) {
    throw new Error('useNavigationDiagnostics must be used within NavigationDiagnosticsProvider');
  }
  return ctx;
};

// Safe hook that returns null if not in provider
export const useNavigationDiagnosticsSafe = () => {
  return useContext(NavigationDiagnosticsContext);
};

// === PROVIDER ===
export const NavigationDiagnosticsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<NavigationDiagnosticState>({
    ...initialDiagnosticState,
    isEnabled: DEBUG_NAV.enabled,
  });

  const gpsUpdateTimestamps = useRef<number[]>([]);
  const lastGpsTimestamp = useRef<number>(0);
  const eventIdCounter = useRef<number>(0);

  // === ADD EVENT TO LOG ===
  const addEvent = useCallback((event: Omit<DiagnosticEvent, 'id' | 'timestamp'>) => {
    const fullEvent: DiagnosticEvent = {
      ...event,
      id: `evt_${++eventIdCounter.current}`,
      timestamp: Date.now(),
    };
    
    setState(prev => ({
      ...prev,
      eventLog: [...prev.eventLog.slice(-49), fullEvent],
    }));
    
    // Also console log in debug mode
    if (event.severity === 'error') {
      debugError(event.category, `[${event.type}] ${event.message}`, event.data);
    } else if (event.severity === 'warning') {
      debugWarn(event.category, `[${event.type}] ${event.message}`, event.data);
    } else {
      debugLog(event.category, `[${event.type}] ${event.message}`, event.data);
    }
  }, []);

  // === TOGGLE ===
  const toggleDebugNav = useCallback(() => {
    setState(prev => ({
      ...prev,
      isEnabled: !prev.isEnabled,
    }));
  }, []);

  // === HERE LOGGING ===
  const logHereRequest = useCallback((data: {
    endpoint: string;
    apiVersion?: 'v7' | 'v8';
    startTime: number;
  }) => {
    addEvent({
      category: 'HERE',
      type: 'request_start',
      message: `Request to ${data.endpoint}`,
      severity: 'info',
      data: { apiVersion: data.apiVersion },
    });
  }, [addEvent]);

  const logHereResponse = useCallback((data: {
    endpoint: string;
    apiVersion?: 'v7' | 'v8';
    startTime: number;
    statusCode: number;
    responseSize: number;
    polyline?: string;
    polylinePath?: string;
    error?: string;
  }) => {
    const latencyMs = Date.now() - data.startTime;
    const hasPolyline = !!data.polyline && data.polyline.length > 0;
    
    // Decode polyline to count points
    let decodedPointCount = 0;
    if (hasPolyline) {
      try {
        const validation = validatePolyline(data.polyline!);
        decodedPointCount = validation.decodedPoints;
      } catch {
        decodedPointCount = 0;
      }
    }

    const diagnostic: HereRoutingDiagnostic = {
      timestamp: Date.now(),
      endpoint: data.endpoint,
      apiVersion: data.apiVersion || 'unknown',
      requestLatencyMs: latencyMs,
      statusCode: data.statusCode,
      responseSizeBytes: data.responseSize,
      hasPolyline,
      polylinePath: data.polylinePath || '',
      polylineFormat: hasPolyline ? (data.polyline!.startsWith('B') ? 'flexible' : 'google') : 'unknown',
      decodedPointCount,
      rawPolylinePreview: data.polyline?.slice(0, 50) || '',
      error: data.error,
    };

    setState(prev => ({
      ...prev,
      hereRouting: diagnostic,
    }));

    // Track errors
    if (data.statusCode === 401) {
      setState(prev => ({
        ...prev,
        errorCounters: { ...prev.errorCounters, auth401: prev.errorCounters.auth401 + 1 },
      }));
    } else if (data.statusCode === 403) {
      setState(prev => ({
        ...prev,
        errorCounters: { ...prev.errorCounters, auth403: prev.errorCounters.auth403 + 1 },
      }));
    } else if (data.statusCode === 429) {
      setState(prev => ({
        ...prev,
        errorCounters: { ...prev.errorCounters, rateLimit429: prev.errorCounters.rateLimit429 + 1 },
      }));
    } else if (data.statusCode >= 500) {
      setState(prev => ({
        ...prev,
        errorCounters: { ...prev.errorCounters, server5xx: prev.errorCounters.server5xx + 1 },
      }));
    }

    const severity = data.statusCode >= 400 ? 'error' : latencyMs > DiagnosticThresholds.slowRequestMs ? 'warning' : 'info';
    
    addEvent({
      category: 'HERE',
      type: 'response',
      message: `${data.statusCode} from ${data.endpoint} (${latencyMs}ms, ${decodedPointCount} pts)`,
      severity,
      data: { latencyMs, statusCode: data.statusCode, pointCount: decodedPointCount },
    });
  }, [addEvent]);

  // === MAPBOX LOGGING ===
  const logMapboxState = useCallback((data: Partial<MapboxRenderDiagnostic>) => {
    setState(prev => ({
      ...prev,
      mapboxRender: {
        ...prev.mapboxRender,
        ...data,
        timestamp: Date.now(),
      } as MapboxRenderDiagnostic,
    }));

    if (data.error) {
      addEvent({
        category: 'Mapbox',
        type: 'error',
        message: data.error,
        severity: 'error',
      });
    }
  }, [addEvent]);

  // === GPS LOGGING ===
  const logGpsUpdate = useCallback((data: {
    lat: number;
    lng: number;
    speed: number;
    heading: number;
    accuracy: number;
    timestamp: number;
  }) => {
    const now = Date.now();
    
    // Track update rate
    gpsUpdateTimestamps.current.push(now);
    gpsUpdateTimestamps.current = gpsUpdateTimestamps.current.filter(t => now - t < 1000);
    const updateRateHz = gpsUpdateTimestamps.current.length;
    
    const timeSinceLastUpdate = lastGpsTimestamp.current ? now - lastGpsTimestamp.current : 0;
    lastGpsTimestamp.current = now;
    
    const isStale = timeSinceLastUpdate > DiagnosticThresholds.gpsStaleMs;

    const diagnostic: GpsDiagnostic = {
      timestamp: now,
      updateRateHz,
      lastLat: data.lat,
      lastLng: data.lng,
      speed: data.speed,
      heading: data.heading,
      accuracy: data.accuracy,
      timeSinceLastUpdateMs: timeSinceLastUpdate,
      isStale,
      provider: 'unknown',
    };

    setState(prev => ({
      ...prev,
      gps: diagnostic,
    }));

    // Log if stale or low accuracy
    if (isStale) {
      addEvent({
        category: 'GPS',
        type: 'stale',
        message: `GPS stale: ${timeSinceLastUpdate}ms since last update`,
        severity: 'warning',
      });
    }

    if (data.accuracy > DiagnosticThresholds.gpsLowAccuracyM) {
      addEvent({
        category: 'GPS',
        type: 'low_accuracy',
        message: `Low GPS accuracy: ${data.accuracy.toFixed(1)}m`,
        severity: 'warning',
      });
    }
  }, [addEvent]);

  // === TIMING EVENTS ===
  const logTimingEvent = useCallback((type: TimingEventType, metadata?: Record<string, unknown>) => {
    const now = Date.now();
    
    setState(prev => {
      const lastEvent = prev.timingEvents[prev.timingEvents.length - 1];
      const durationFromPrevMs = lastEvent ? now - lastEvent.timestamp : undefined;
      
      const event: TimingEvent = {
        type,
        timestamp: now,
        durationFromPrevMs,
        metadata,
      };
      
      return {
        ...prev,
        timingEvents: [...prev.timingEvents.slice(-49), event],
      };
    });

    addEvent({
      category: 'Validation',
      type: 'timing',
      message: `${type}`,
      severity: 'info',
      data: metadata,
    });
  }, [addEvent]);

  // === ERROR INCREMENT ===
  const incrementError = useCallback((type: keyof ErrorCounters) => {
    setState(prev => ({
      ...prev,
      errorCounters: {
        ...prev.errorCounters,
        [type]: prev.errorCounters[type] + 1,
      },
    }));
  }, []);

  // === POLYLINE VALIDATION ===
  const validateAndLogPolyline = useCallback((encoded: string): PolylineValidation => {
    const validation = validatePolyline(encoded);
    
    setState(prev => ({
      ...prev,
      lastPolylineValidation: validation,
    }));

    if (!validation.isValid) {
      validation.errors.forEach(err => {
        addEvent({
          category: 'Polyline',
          type: err.errorCode,
          message: err.message,
          severity: 'error',
          data: { index: err.index, lat: err.lat, lng: err.lng },
        });
      });
      
      setState(prev => ({
        ...prev,
        errorCounters: {
          ...prev.errorCounters,
          polylineDecodeErrors: prev.errorCounters.polylineDecodeErrors + validation.errors.length,
        },
      }));
    }

    return validation;
  }, [addEvent]);

  // === GENERATE CHECKLIST ===
  const generateChecklist = useCallback((): DiagnosticChecklist => {
    const checks: DiagnosticCheck[] = [];

    // API Request OK?
    const apiOk = state.hereRouting?.statusCode === 200;
    checks.push({
      id: 'api_request',
      name: 'API Request OK?',
      status: state.hereRouting 
        ? (apiOk ? 'pass' : 'fail')
        : 'pending',
      details: state.hereRouting 
        ? `Status ${state.hereRouting.statusCode}, ${state.hereRouting.requestLatencyMs}ms latency`
        : 'No request yet',
      recommendation: !apiOk && state.hereRouting 
        ? `Check error: ${state.hereRouting.error || 'Unknown'}` 
        : undefined,
    });

    // Polyline present?
    const polylinePresent = state.hereRouting?.hasPolyline === true;
    checks.push({
      id: 'polyline_present',
      name: 'Polyline presente?',
      status: polylinePresent ? 'pass' : (state.hereRouting ? 'fail' : 'pending'),
      details: polylinePresent 
        ? `Path: ${state.hereRouting?.polylinePath}` 
        : 'No polyline found',
      recommendation: !polylinePresent ? 'Check NextBillion API response structure' : undefined,
    });

    // Decode OK?
    const decodeOk = state.lastPolylineValidation?.isValid === true;
    checks.push({
      id: 'decode_ok',
      name: 'Decode OK?',
      status: state.lastPolylineValidation 
        ? (decodeOk ? 'pass' : 'fail') 
        : 'pending',
      details: state.lastPolylineValidation 
        ? `${state.lastPolylineValidation.decodedPoints} points, format: ${state.lastPolylineValidation.format}` 
        : 'Not validated',
      recommendation: !decodeOk && state.lastPolylineValidation?.errors.length 
        ? `Errors: ${state.lastPolylineValidation.errors.map(e => e.errorCode).join(', ')}` 
        : undefined,
    });

    // Convert to GeoJSON OK?
    const geoJsonOk = state.mapboxRender?.featureCount && state.mapboxRender.featureCount > 0;
    checks.push({
      id: 'geojson_ok',
      name: 'Convert to GeoJSON OK?',
      status: geoJsonOk ? 'pass' : (state.mapboxRender ? 'fail' : 'pending'),
      details: state.mapboxRender 
        ? `${state.mapboxRender.featureCount || 0} features, ${state.mapboxRender.pointCount || 0} points`
        : 'No render data',
    });

    // Mapbox source OK?
    const sourceOk = state.mapboxRender?.routeSourceExists === true;
    checks.push({
      id: 'mapbox_source',
      name: 'Mapbox source OK?',
      status: sourceOk ? 'pass' : (state.mapboxRender?.styleLoaded ? 'fail' : 'pending'),
      details: state.mapboxRender?.routeSourceId || 'Unknown',
    });

    // Mapbox layer OK?
    const layerOk = state.mapboxRender?.routeLayerExists === true;
    checks.push({
      id: 'mapbox_layer',
      name: 'Mapbox layer OK?',
      status: layerOk ? 'pass' : (state.mapboxRender?.styleLoaded ? 'fail' : 'pending'),
      details: state.mapboxRender?.routeLayerId || 'Unknown',
    });

    // Route aligned?
    const aligned = state.lastPolylineValidation?.boundingBox != null && 
      state.lastPolylineValidation.isValid;
    checks.push({
      id: 'route_aligned',
      name: 'Rota aparece alinhada?',
      status: aligned ? 'pass' : 'warning',
      details: state.lastPolylineValidation?.boundingBox 
        ? `BBox: [${state.lastPolylineValidation.boundingBox.minLat.toFixed(2)}, ${state.lastPolylineValidation.boundingBox.maxLat.toFixed(2)}]`
        : 'No bbox',
    });

    // Errors 401/403/429?
    const authErrors = state.errorCounters.auth401 + state.errorCounters.auth403;
    const rateErrors = state.errorCounters.rateLimit429;
    checks.push({
      id: 'auth_rate_errors',
      name: 'Erros 401/403/429?',
      status: authErrors > 0 || rateErrors > 0 ? 'fail' : 'pass',
      details: `Auth: ${authErrors}, Rate: ${rateErrors}`,
      recommendation: authErrors > 0 
        ? DiagnosticErrorCodes.API_AUTH_FAIL 
        : rateErrors > 0 
          ? DiagnosticErrorCodes.API_RATE_LIMIT 
          : undefined,
    });

    // Average latency
    const avgLatency = state.hereRouting?.requestLatencyMs || 0;
    checks.push({
      id: 'latency',
      name: 'Latência média',
      status: avgLatency > DiagnosticThresholds.slowRequestMs 
        ? 'warning' 
        : avgLatency > 0 ? 'pass' : 'pending',
      details: `${avgLatency}ms`,
    });

    const passedCount = checks.filter(c => c.status === 'pass').length;
    const failedCount = checks.filter(c => c.status === 'fail').length;

    const checklist: DiagnosticChecklist = {
      timestamp: Date.now(),
      checks,
      overallStatus: failedCount > 0 ? 'fail' : passedCount === checks.length ? 'pass' : 'partial',
      passedCount,
      failedCount,
    };

    setState(prev => ({ ...prev, checklist }));

    return checklist;
  }, [state]);

  // === EXPORT ===
  const exportDiagnostics = useCallback((): string => {
    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      state,
      checklist: generateChecklist(),
    }, null, 2);
  }, [state, generateChecklist]);

  // === RESET ===
  const resetDiagnostics = useCallback(() => {
    setState({
      ...initialDiagnosticState,
      isEnabled: state.isEnabled,
      sessionStartTime: Date.now(),
    });
    gpsUpdateTimestamps.current = [];
    lastGpsTimestamp.current = 0;
    eventIdCounter.current = 0;
  }, [state.isEnabled]);

  // === AUTO-ENABLE based on DEBUG_NAV config ===
  useEffect(() => {
    if (DEBUG_NAV.enabled && !state.isEnabled) {
      setState(prev => ({ ...prev, isEnabled: true }));
    }
  }, [state.isEnabled]);

  const value: NavigationDiagnosticsContextType = {
    ...state,
    toggleDebugNav,
    logHereRequest,
    logHereResponse,
    logMapboxState,
    logGpsUpdate,
    logTimingEvent,
    incrementError,
    validateAndLogPolyline,
    generateChecklist,
    exportDiagnostics,
    resetDiagnostics,
  };

  return (
    <NavigationDiagnosticsContext.Provider value={value}>
      {children}
    </NavigationDiagnosticsContext.Provider>
  );
};
