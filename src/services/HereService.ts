/**
 * HERE Service - Geocoding, POIs, Weather Alerts
 * 
 * IMPORTANT: This service now delegates ROUTING to NavigationEngine.
 * 
 * NavigationEngine handles:
 * - NextBillion as PRIMARY engine for truck routing
 * - HERE as FALLBACK only when NextBillion fails
 * 
 * This service handles:
 * - Geocoding (address search)
 * - Weather alerts along route
 * - Reverse geocoding
 * 
 * @see src/services/NavigationEngine.ts for routing
 */
import { supabase } from "@/integrations/supabase/client";
import {
  NavigationEngine,
  formatDistance,
  formatDistanceForVoice,
  formatDuration,
  buildVoicePrompt,
  subscribeToDiagnostics,
} from './NavigationEngine';

// Re-export everything from NavigationEngine for backwards compatibility
export {
  NavigationEngine,
  formatDistance,
  formatDistanceForVoice,
  formatDuration,
  buildVoicePrompt,
  subscribeToDiagnostics,
  DEFAULT_TRUCK_PROFILE,
} from './NavigationEngine';

export type {
  RouteRequest,
  RouteResponse,
  RouteInstruction,
  TruckProfile,
  ActiveEngine,
  NavigationEngineState,
} from './NavigationEngine';

// ============= HERE-SPECIFIC TYPES =============

export interface GeocodeResult {
  id: string;
  title: string;
  address: string;
  lat: number;
  lng: number;
  city?: string;
  state?: string;
  country?: string;
}

export interface WeatherAlert {
  type: string;
  severity: string;
  headline: string;
  description: string;
  affectedAreas: string[];
  validFrom: string | null;
  validTo: string | null;
  geometry: any | null;
}

export interface WeatherAlertsResponse {
  alerts: WeatherAlert[];
  available: boolean;
  message?: string;
  count?: number;
  cached?: boolean;
}

// ============= DIAGNOSTICS =============

type DiagnosticsCallback = (data: {
  service: string;
  endpoint: string;
  status: number | 'ok' | 'error';
  message?: string;
  resultCount?: number;
}) => void;

let localDiagnosticsCallbacks: DiagnosticsCallback[] = [];

export const subscribeToLocalDiagnostics = (callback: DiagnosticsCallback) => {
  localDiagnosticsCallbacks.push(callback);
  return () => {
    localDiagnosticsCallbacks = localDiagnosticsCallbacks.filter(cb => cb !== callback);
  };
};

// ============= HERE SERVICE CLASS =============

class HereServiceClass {
  private emitDiagnostic(data: Parameters<DiagnosticsCallback>[0]) {
    localDiagnosticsCallbacks.forEach(cb => cb(data));
  }

  private logApiResult(service: string, endpoint: string, status: 'success' | 'error', details?: any) {
    const prefix = status === 'success' ? '✅' : '❌';
    console.log(`[HereService] ${prefix} ${service}`, {
      endpoint,
      status,
      ...(details && { details }),
    });
    
    this.emitDiagnostic({
      service,
      endpoint,
      status: details?.status || (status === 'success' ? 'ok' : 'error'),
      message: details?.message,
      resultCount: details?.results || details?.alertCount,
    });
    
    if (details?.status === 401 || details?.status === 403) {
      console.error(`[HereService] 🔐 AUTH ERROR: ${service} service may not be enabled in HERE project`);
    }
  }

  // ============= GEOCODING =============

  async geocode(query: string): Promise<GeocodeResult[]> {
    console.log('[HereService] Calling: Geocode API', { query });
    
    const { data, error } = await supabase.functions.invoke('here_geocode', {
      body: { query, limit: 5 },
    });

    if (error) {
      this.logApiResult('Geocode', 'here_geocode', 'error', { message: error.message, status: error.status });
      throw new Error(error.message || 'Failed to geocode address');
    }

    if (data.error) {
      this.logApiResult('Geocode', 'here_geocode', 'error', { message: data.error, status: data.status });
      throw new Error(data.error);
    }

    this.logApiResult('Geocode', 'here_geocode', 'success', { results: data.results?.length || 0 });
    return data.results as GeocodeResult[];
  }

  // ============= ROUTING (DELEGATED TO NAVIGATION ENGINE) =============

  /**
   * Calculate route using NavigationEngine (NextBillion primary, HERE fallback)
   * This method is maintained for backwards compatibility
   */
  async calculateRoute(request: import('./NavigationEngine').RouteRequest): Promise<import('./NavigationEngine').RouteResponse> {
    console.log('[HereService] Delegating to NavigationEngine');
    return NavigationEngine.calculateRoute(request);
  }

  // ============= WEATHER ALERTS =============

  async getWeatherAlertsAlongRoute(
    routePolyline: string,
    language: string = 'en-US'
  ): Promise<WeatherAlertsResponse> {
    console.log('[HereService] Calling: Weather Alerts API');
    
    const { data, error } = await supabase.functions.invoke('here_weather_alerts_along_route', {
      body: {
        routePolyline,
        language,
      },
    });

    if (error) {
      this.logApiResult('Weather Alerts', 'here_weather_alerts_along_route', 'error', { 
        message: error.message, 
        status: error.status 
      });
      throw new Error(error.message || 'Failed to get weather alerts');
    }

    this.logApiResult('Weather Alerts', 'here_weather_alerts_along_route', 'success', { 
      alertCount: data?.alerts?.length || 0 
    });
    return data as WeatherAlertsResponse;
  }

  // ============= HELPER METHODS (DELEGATED) =============

  formatDistance(meters: number, useImperial: boolean = true): string {
    return formatDistance(meters, useImperial);
  }

  formatDistanceForVoice(meters: number): string {
    return formatDistanceForVoice(meters);
  }

  formatDuration(seconds: number): string {
    return formatDuration(seconds);
  }

  buildVoicePrompt(instruction: import('./NavigationEngine').RouteInstruction, distanceToManeuver: number): string {
    return buildVoicePrompt(instruction, distanceToManeuver);
  }
}

export const HereService = new HereServiceClass();
