import { supabase } from "@/integrations/supabase/client";

export interface TruckProfile {
  trailerLengthFt: number;
  heightFt: number;
  weightLbs: number;
  axles: number;
}

export interface RouteRequest {
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  transportMode?: 'truck' | 'car';
  avoidTolls?: boolean;
  avoidFerries?: boolean;
  truckProfile?: TruckProfile;
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
  notices?: any[];
}

export interface RouteInstruction {
  instruction: string;
  duration: number;
  length: number;
  direction?: string;
  action?: string;
  roadName?: string;
  exitInfo?: string;
  offset?: number;
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

// Default truck profile for 53' trailer
export const DEFAULT_TRUCK_PROFILE: TruckProfile = {
  trailerLengthFt: 53,
  heightFt: 13.6,
  weightLbs: 80000,
  axles: 5,
};

class HereServiceClass {
  // Diagnostic: log API call results
  private logApiResult(service: string, endpoint: string, status: 'success' | 'error', details?: any) {
    const prefix = status === 'success' ? '✅' : '❌';
    console.log(`[HereService] ${prefix} ${service}`, {
      endpoint,
      status,
      ...(details && { details }),
    });
    
    // Check for auth issues
    if (details?.status === 401 || details?.status === 403) {
      console.error(`[HereService] 🔐 AUTH ERROR: ${service} service may not be enabled in HERE project`);
      console.error(`[HereService] Check HERE Developer Portal: https://developer.here.com/`);
    }
  }

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

  async calculateRoute(request: RouteRequest): Promise<RouteResponse> {
    console.log('[HereService] Calling: Routing API', { 
      origin: `${request.originLat},${request.originLng}`,
      dest: `${request.destLat},${request.destLng}`,
      mode: request.transportMode,
    });
    
    const { data, error } = await supabase.functions.invoke('here_route', {
      body: {
        ...request,
        truckProfile: request.transportMode === 'truck' 
          ? (request.truckProfile || DEFAULT_TRUCK_PROFILE)
          : undefined,
      },
    });

    if (error) {
      this.logApiResult('Routing', 'here_route', 'error', { message: error.message, status: error.status });
      throw new Error(error.message || 'Failed to calculate route');
    }

    if (data.error) {
      this.logApiResult('Routing', 'here_route', 'error', { message: data.error, status: data.status });
      throw new Error(data.error);
    }

    this.logApiResult('Routing', 'here_route', 'success', { 
      distance: data.distance, 
      duration: data.duration,
      instructions: data.instructions?.length || 0,
    });
    return data as RouteResponse;
  }

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

  // Helper to format distance in miles/feet (US units)
  formatDistance(meters: number, useImperial: boolean = true): string {
    if (useImperial) {
      const feet = meters * 3.28084;
      const miles = meters * 0.000621371;
      
      if (miles >= 0.1) {
        return `${miles.toFixed(1)} mi`;
      }
      return `${Math.round(feet)} ft`;
    }
    
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} km`;
    }
    return `${Math.round(meters)} m`;
  }

  // Helper to format distance for voice (more natural)
  formatDistanceForVoice(meters: number): string {
    const miles = meters * 0.000621371;
    
    if (miles >= 1) {
      return `${miles.toFixed(1)} miles`;
    } else if (miles >= 0.25) {
      // Use fractions for common distances
      if (miles >= 0.45 && miles <= 0.55) return 'half a mile';
      if (miles >= 0.20 && miles <= 0.30) return 'a quarter mile';
      return `${miles.toFixed(1)} miles`;
    } else {
      const feet = meters * 3.28084;
      if (feet >= 100) {
        return `${Math.round(feet / 100) * 100} feet`;
      }
      return `${Math.round(feet)} feet`;
    }
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

  // Build voice prompt for instruction (Google Maps style)
  buildVoicePrompt(instruction: RouteInstruction, distanceToManeuver: number): string {
    const distanceText = this.formatDistanceForVoice(distanceToManeuver);
    const action = instruction.action?.toLowerCase() || '';
    const roadName = instruction.roadName || '';
    const exitInfo = instruction.exitInfo || '';

    // Build natural voice prompt
    let prompt = '';

    if (distanceToManeuver > 50) {
      prompt = `In ${distanceText}, `;
    }

    // Determine action type
    if (action.includes('arrive') || action.includes('destination')) {
      return distanceToManeuver < 100 
        ? 'You have arrived at your destination.'
        : `In ${distanceText}, you will arrive at your destination.`;
    }

    if (action.includes('turn') && action.includes('left')) {
      prompt += 'turn left';
    } else if (action.includes('turn') && action.includes('right')) {
      prompt += 'turn right';
    } else if (action.includes('slight') && action.includes('left')) {
      prompt += 'keep left';
    } else if (action.includes('slight') && action.includes('right')) {
      prompt += 'keep right';
    } else if (action.includes('uturn') || action.includes('u-turn')) {
      prompt += 'make a U-turn';
    } else if (action.includes('merge')) {
      prompt += 'merge';
    } else if (action.includes('exit') || action.includes('ramp')) {
      prompt += exitInfo ? `take exit ${exitInfo}` : 'take the exit';
    } else if (action.includes('roundabout') || action.includes('rotary')) {
      prompt += 'enter the roundabout';
    } else if (action.includes('continue') || action.includes('straight')) {
      prompt += 'continue straight';
    } else {
      // Fallback - use instruction text but clean it
      const cleanInstruction = instruction.instruction
        .replace(/\d+\.\d+°?\s*(N|S|E|W|north|south|east|west)/gi, '')
        .replace(/heading\s+\w+/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
      prompt = distanceToManeuver > 50 
        ? `In ${distanceText}, ${cleanInstruction.toLowerCase()}`
        : cleanInstruction;
    }

    // Add road name if available
    if (roadName && !prompt.includes(roadName)) {
      prompt += ` onto ${roadName}`;
    }

    return prompt.charAt(0).toUpperCase() + prompt.slice(1) + '.';
  }
}

export const HereService = new HereServiceClass();
