/**
 * Route Diagnostics Hook
 * 
 * Wraps route calculation with full diagnostic logging
 */

import { useCallback } from 'react';
import { useNavigationDiagnosticsSafe } from '@/contexts/NavigationDiagnosticsContext';
import { NavigationEngine } from '@/services/NavigationEngine';
import { debugLog, debugError, DEBUG_NAV, TEST_ROUTES, type TestRoute } from '@/lib/debug/debugNavConfig';
import { validatePolyline, compareBoundingBoxes } from '@/lib/debug/polylineValidator';

interface RouteTestResult {
  testRoute: TestRoute;
  success: boolean;
  latencyMs: number;
  decodedPoints?: number;
  distanceKm?: number;
  errors: string[];
}

export function useRouteDiagnostics() {
  const diagnostics = useNavigationDiagnosticsSafe();

  const logMapboxUpdate = useCallback((data: {
    sourceId: string;
    layerId: string;
    pointCount: number;
    featureCount: number;
    styleLoaded: boolean;
    mapLoaded: boolean;
  }) => {
    if (!diagnostics || !DEBUG_NAV.enabled) return;

    diagnostics.logMapboxState({
      styleLoaded: data.styleLoaded,
      mapLoaded: data.mapLoaded,
      routeSourceExists: true,
      routeSourceId: data.sourceId,
      routeLayerExists: true,
      routeLayerId: data.layerId,
      featureCount: data.featureCount,
      pointCount: data.pointCount,
      lastUpdateMs: Date.now(),
    });

    diagnostics.logTimingEvent('route_rendered', {
      sourceId: data.sourceId,
      layerId: data.layerId,
      pointCount: data.pointCount,
    });

    debugLog('MAPBOX', `Route rendered: ${data.pointCount} points`);
  }, [diagnostics]);

  const runTestRoutes = useCallback(async (): Promise<RouteTestResult[]> => {
    const results: RouteTestResult[] = [];

    for (const testRoute of TEST_ROUTES) {
      const startTime = Date.now();
      const result: RouteTestResult = {
        testRoute,
        success: false,
        latencyMs: 0,
        errors: [],
      };

      try {
        const response = await NavigationEngine.calculateRoute({
          originLat: testRoute.origin.lat,
          originLng: testRoute.origin.lng,
          destLat: testRoute.destination.lat,
          destLng: testRoute.destination.lng,
          transportMode: 'truck',
        });
        
        result.latencyMs = Date.now() - startTime;

        if (response.polyline) {
          const validation = validatePolyline(response.polyline);
          result.decodedPoints = validation.decodedPoints;
          result.distanceKm = response.distance ? response.distance / 1000 : 0;

          if (validation.boundingBox) {
            const bboxCheck = compareBoundingBoxes(testRoute.expectedBbox, validation.boundingBox);
            if (!bboxCheck.matches) {
              result.errors.push(`BBox mismatch: ${bboxCheck.deviations.join(', ')}`);
            }
          }

          const distInRange = result.distanceKm >= testRoute.expectedDistanceKm.min && 
                             result.distanceKm <= testRoute.expectedDistanceKm.max;
          if (!distInRange) {
            result.errors.push(`Distance out of range`);
          }

          result.success = validation.isValid && result.errors.length === 0;
        }
      } catch (error) {
        result.latencyMs = Date.now() - startTime;
        result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      }

      results.push(result);
      debugLog('TEST', `${testRoute.id}: ${result.success ? 'PASS' : 'FAIL'}`);
    }

    return results;
  }, []);

  return { logMapboxUpdate, runTestRoutes };
}
