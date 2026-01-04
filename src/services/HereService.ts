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
      body: {
        ...request,
        truckProfile: request.transportMode === 'truck' 
          ? (request.truckProfile || DEFAULT_TRUCK_PROFILE)
          : undefined,
      },
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
