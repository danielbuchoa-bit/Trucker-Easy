/**
 * NextBillion Service - Geocoding, POIs, Reverse Geocoding
 * 
 * This service handles all location-based services using NextBillion.ai APIs:
 * - Forward Geocoding (address search)
 * - Reverse Geocoding (coordinates to address)
 * - POI/Places Search
 * 
 * Routing is handled by NavigationEngine.ts
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

// ============= GEOCODING TYPES =============

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

export interface ReverseGeocodeResult {
  road: string | null;
  city: string | null;
  state: string | null;
  stateCode: string | null;
  country: string | null;
  postalCode: string | null;
  label: string | null;
  speedLimit: string | null;
  houseNumber?: string | null;
  county?: string | null;
  distance?: number | null;
  position?: { lat: number; lng: number };
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

export interface POI {
  id: string;
  title: string;
  name: string;
  address: {
    label: string;
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  position: { lat: number; lng: number };
  lat: number;
  lng: number;
  distance: number;
  categories?: { name: string }[];
  rating?: number | null;
}

// ============= DIAGNOSTICS =============

type DiagnosticsCallback = (data: {
  service: string;
  endpoint: string;
  status: number | 'ok' | 'error';
  message?: string;
  resultCount?: number;
}) => void;

let diagnosticsCallbacks: DiagnosticsCallback[] = [];

export const subscribeToLocalDiagnostics = (callback: DiagnosticsCallback) => {
  diagnosticsCallbacks.push(callback);
  return () => {
    diagnosticsCallbacks = diagnosticsCallbacks.filter(cb => cb !== callback);
  };
};

// ============= NEXTBILLION SERVICE CLASS =============

class NextBillionServiceClass {
  private emitDiagnostic(data: Parameters<DiagnosticsCallback>[0]) {
    diagnosticsCallbacks.forEach(cb => cb(data));
  }

  private logApiResult(service: string, endpoint: string, status: 'success' | 'error', details?: any) {
    const prefix = status === 'success' ? '✅' : '❌';
    console.log(`[NextBillionService] ${prefix} ${service}`, {
      endpoint,
      status,
      ...(details && { details }),
    });
    
    this.emitDiagnostic({
      service,
      endpoint,
      status: details?.status || (status === 'success' ? 'ok' : 'error'),
      message: details?.message,
      resultCount: details?.results || details?.count,
    });
  }

  // ============= FORWARD GEOCODING =============

  async geocode(query: string): Promise<GeocodeResult[]> {
    console.log('[NextBillionService] Calling: Geocode API', { query });
    
    const { data, error } = await supabase.functions.invoke('nb_geocode', {
      body: { query, limit: 5 },
    });

    if (error) {
      this.logApiResult('Geocode', 'nb_geocode', 'error', { message: error.message, status: error.status });
      throw new Error(error.message || 'Failed to geocode address');
    }

    if (data.error) {
      this.logApiResult('Geocode', 'nb_geocode', 'error', { message: data.error, status: data.status });
      throw new Error(data.error);
    }

    this.logApiResult('Geocode', 'nb_geocode', 'success', { results: data.results?.length || 0 });
    return data.results as GeocodeResult[];
  }

  // ============= REVERSE GEOCODING =============

  async reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
    console.log('[NextBillionService] Calling: Reverse Geocode API', { lat, lng });
    
    const { data, error } = await supabase.functions.invoke('nb_reverse_geocode', {
      body: { lat, lng },
    });

    if (error) {
      this.logApiResult('Reverse Geocode', 'nb_reverse_geocode', 'error', { message: error.message });
      throw new Error(error.message || 'Failed to reverse geocode');
    }

    if (data.error) {
      this.logApiResult('Reverse Geocode', 'nb_reverse_geocode', 'error', { message: data.error });
      throw new Error(data.error);
    }

    this.logApiResult('Reverse Geocode', 'nb_reverse_geocode', 'success', { 
      result: data.label || data.road || 'unknown' 
    });
    return data as ReverseGeocodeResult;
  }

  // ============= POI SEARCH =============

  async browsePOIs(
    lat: number, 
    lng: number, 
    options?: {
      radius?: number;
      categories?: string[];
      limit?: number;
    }
  ): Promise<POI[]> {
    console.log('[NextBillionService] Calling: Browse POIs API', { lat, lng, options });
    
    const { data, error } = await supabase.functions.invoke('nb_browse_pois', {
      body: { 
        lat, 
        lng, 
        radius: options?.radius || 32000,
        categories: options?.categories,
        limit: options?.limit || 20,
      },
    });

    if (error) {
      this.logApiResult('Browse POIs', 'nb_browse_pois', 'error', { message: error.message });
      // Return empty array for graceful degradation
      return [];
    }

    if (data.error && !data.pois) {
      this.logApiResult('Browse POIs', 'nb_browse_pois', 'error', { message: data.error });
      return [];
    }

    const pois = data.pois || data.items || [];
    this.logApiResult('Browse POIs', 'nb_browse_pois', 'success', { count: pois.length });
    return pois as POI[];
  }

  // ============= WEATHER ALERTS =============

  /**
   * Get weather alerts along route
   * Note: NextBillion doesn't have a weather alerts API, so this returns a placeholder response.
   * Consider integrating with a dedicated weather API like OpenWeatherMap or NWS.
   */
  async getWeatherAlertsAlongRoute(
    routePolyline: string,
    language: string = 'en-US'
  ): Promise<WeatherAlertsResponse> {
    console.log('[NextBillionService] Weather alerts: No dedicated API available');
    
    // Return empty response - weather alerts would need a separate weather API integration
    return {
      alerts: [],
      available: false,
      message: 'Weather alerts not available (requires separate weather API integration)',
      count: 0,
      cached: false,
    };
  }

  // ============= ROUTING (DELEGATED TO NAVIGATION ENGINE) =============

  async calculateRoute(request: import('./NavigationEngine').RouteRequest): Promise<import('./NavigationEngine').RouteResponse> {
    console.log('[NextBillionService] Delegating to NavigationEngine');
    return NavigationEngine.calculateRoute(request);
  }

  // ============= HELPER METHODS =============

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

export const NextBillionService = new NextBillionServiceClass();

// Also export as HereService for backwards compatibility
export const HereService = NextBillionService;
