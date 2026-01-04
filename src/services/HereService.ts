import { supabase } from "@/integrations/supabase/client";

export interface RouteRequest {
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  transportMode?: 'truck' | 'car';
  avoidTolls?: boolean;
  avoidFerries?: boolean;
}

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

export interface RouteResponse {
  polyline: string;
  distance: number; // meters
  duration: number; // seconds
  instructions: RouteInstruction[];
  transportMode: string;
}

export interface RouteInstruction {
  instruction: string;
  duration: number;
  length: number;
  direction?: string;
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

class HereServiceClass {
  async geocode(query: string): Promise<GeocodeResult[]> {
    const { data, error } = await supabase.functions.invoke('here_geocode', {
      body: { query, limit: 5 },
    });

    if (error) {
      console.error('Error calling here_geocode:', error);
      throw new Error(error.message || 'Failed to geocode address');
    }

    if (data.error) {
      throw new Error(data.error);
    }

    return data.results as GeocodeResult[];
  }

  async calculateRoute(request: RouteRequest): Promise<RouteResponse> {
    const { data, error } = await supabase.functions.invoke('here_route', {
      body: request,
    });

    if (error) {
      console.error('Error calling here_route:', error);
      throw new Error(error.message || 'Failed to calculate route');
    }

    if (data.error) {
      throw new Error(data.error);
    }

    return data as RouteResponse;
  }

  async getWeatherAlertsAlongRoute(
    routePolyline: string,
    language: string = 'en-US'
  ): Promise<WeatherAlertsResponse> {
    const { data, error } = await supabase.functions.invoke('here_weather_alerts_along_route', {
      body: {
        routePolyline,
        language,
      },
    });

    if (error) {
      console.error('Error calling here_weather_alerts:', error);
      throw new Error(error.message || 'Failed to get weather alerts');
    }

    return data as WeatherAlertsResponse;
  }

  // Helper to format distance
  formatDistance(meters: number): string {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} km`;
    }
    return `${meters} m`;
  }

  // Helper to format duration
  formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    }
    return `${minutes} min`;
  }
}

export const HereService = new HereServiceClass();
