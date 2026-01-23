/**
 * Unified Navigation Engine - NextBillion ONLY
 * 
 * Architecture:
 * - NextBillion is the ONLY engine for ALL truck navigation (routing, turn-by-turn, reroute, ETA)
 * - No HERE fallback - all routing via NextBillion
 * - Local snap-to-route for cursor tracking
 */

import { supabase } from "@/integrations/supabase/client";

// ============= TYPES =============

export type ActiveEngine = 'nextbillion';

export interface TruckProfile {
  trailerLengthFt: number;
  heightFt: number;
  widthFt?: number;
  weightLbs: number;
  axles: number;
  hazmatType?: string;
}

export interface RouteRequest {
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  transportMode?: 'truck' | 'car';
  avoidTolls?: boolean;
  avoidFerries?: boolean;
  avoidHighways?: boolean;
  truckProfile?: TruckProfile;
  waypoints?: Array<{ lat: number; lng: number }>;
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
  maneuverType?: string;
  modifier?: string;
  geometry?: string;
  voiceInstruction?: string;
}

export interface RouteResponse {
  polyline: string;
  distance: number; // meters
  duration: number; // seconds
  instructions: RouteInstruction[];
  transportMode: string;
  notices?: any[];
  engine?: ActiveEngine;
  alternatives?: Array<{
    polyline: string;
    distance: number;
    duration: number;
  }>;
}

export interface NavigationEngineState {
  activeEngine: ActiveEngine;
  routePolyline: string | null;
  maneuvers: RouteInstruction[];
  eta: number | null;
  lastSuccessfulTimestamp: number;
  lastError: string | null;
}

// ============= CONFIGURATION =============

const ENGINE_TIMEOUT_MS = 8000; // 8 second timeout
const STATE_KEY = 'navigationEngineState';

// ============= DIAGNOSTICS =============

type DiagnosticsCallback = (data: {
  service: string;
  endpoint: string;
  status: number | 'ok' | 'error';
  message?: string;
  resultCount?: number;
  engine?: ActiveEngine;
}) => void;

let diagnosticsCallbacks: DiagnosticsCallback[] = [];

export const subscribeToDiagnostics = (callback: DiagnosticsCallback) => {
  diagnosticsCallbacks.push(callback);
  return () => {
    diagnosticsCallbacks = diagnosticsCallbacks.filter(cb => cb !== callback);
  };
};

// ============= ENGINE CLASS =============

class NavigationEngineClass {
  private state: NavigationEngineState;

  constructor() {
    this.state = this.loadState();
  }

  private loadState(): NavigationEngineState {
    try {
      const saved = localStorage.getItem(STATE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('[NAV_ENGINE] Failed to load state:', e);
    }
    return this.getDefaultState();
  }

  private getDefaultState(): NavigationEngineState {
    return {
      activeEngine: 'nextbillion',
      routePolyline: null,
      maneuvers: [],
      eta: null,
      lastSuccessfulTimestamp: Date.now(),
      lastError: null,
    };
  }

  private saveState(): void {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.error('[NAV_ENGINE] Failed to save state:', e);
    }
  }

  private emitDiagnostic(data: Parameters<DiagnosticsCallback>[0]) {
    diagnosticsCallbacks.forEach(cb => cb(data));
  }

  getActiveEngine(): ActiveEngine {
    return 'nextbillion';
  }

  getState(): NavigationEngineState {
    return { ...this.state };
  }

  // ============= ROUTE CALCULATION =============

  async calculateRoute(request: RouteRequest): Promise<RouteResponse> {
    console.log(`[NAV_ENGINE] Calculating route with NextBillion`, {
      origin: `${request.originLat.toFixed(4)},${request.originLng.toFixed(4)}`,
      dest: `${request.destLat.toFixed(4)},${request.destLng.toFixed(4)}`,
      mode: request.transportMode,
    });

    try {
      const result = await this.calculateWithNextBillion(request);

      // Validate response
      if (!result.polyline || result.polyline.length < 10) {
        throw new Error('Invalid or empty polyline from NextBillion');
      }

      // Success - update state
      this.state.lastSuccessfulTimestamp = Date.now();
      this.state.routePolyline = result.polyline;
      this.state.maneuvers = result.instructions;
      this.state.eta = result.duration;
      this.state.lastError = null;
      this.saveState();

      result.engine = 'nextbillion';
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[NAV_ENGINE] NextBillion failed:`, error);
      this.state.lastError = errorMessage;
      this.saveState();
      throw error;
    }
  }

  private async calculateWithNextBillion(request: RouteRequest): Promise<RouteResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ENGINE_TIMEOUT_MS);

    try {
      const { data, error } = await supabase.functions.invoke('nextbillion_route', {
        body: {
          originLat: request.originLat,
          originLng: request.originLng,
          destLat: request.destLat,
          destLng: request.destLng,
          avoidTolls: request.avoidTolls,
          avoidHighways: request.avoidHighways,
          avoidFerries: request.avoidFerries,
          truckProfile: request.truckProfile ? {
            trailerLengthFt: request.truckProfile.trailerLengthFt,
            heightFt: request.truckProfile.heightFt,
            widthFt: request.truckProfile.widthFt || 8.5,
            weightLbs: request.truckProfile.weightLbs,
            axles: request.truckProfile.axles,
            hazmatType: request.truckProfile.hazmatType,
          } : undefined,
          waypoints: request.waypoints,
        },
      });

      clearTimeout(timeoutId);

      if (error) {
        this.emitDiagnostic({
          service: 'NextBillion',
          endpoint: 'nextbillion_route',
          status: 'error',
          message: error.message,
          engine: 'nextbillion',
        });
        throw new Error(error.message || 'NextBillion routing failed');
      }

      if (data.error) {
        throw new Error(data.error);
      }

      // Map response to standard format
      const instructions: RouteInstruction[] = (data.instructions || []).map((inst: any, index: number) => ({
        instruction: inst.instruction || '',
        duration: inst.duration || 0,
        length: inst.distance || inst.length || 0,
        direction: inst.modifier || '',
        action: inst.maneuverType || '',
        roadName: inst.roadName || '',
        exitInfo: inst.exitInfo || undefined,
        offset: index,
        maneuverType: inst.maneuverType || '',
        modifier: inst.modifier || '',
        geometry: inst.geometry || '',
        voiceInstruction: inst.voiceInstruction || inst.instruction || '',
      }));

      this.emitDiagnostic({
        service: 'NextBillion',
        endpoint: 'nextbillion_route',
        status: 'ok',
        message: `Route: ${(data.distance / 1609.34).toFixed(1)} mi, ${Math.round(data.duration / 60)} min`,
        resultCount: instructions.length,
        engine: 'nextbillion',
      });

      return {
        polyline: data.polyline,
        distance: data.distance,
        duration: data.duration,
        instructions,
        transportMode: 'truck',
        alternatives: data.alternatives,
        engine: 'nextbillion',
      };

    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Timeout: request exceeded ${ENGINE_TIMEOUT_MS}ms`);
      }
      throw error;
    }
  }

  // ============= REROUTE =============

  async reroute(
    currentLat: number,
    currentLng: number,
    destLat: number,
    destLng: number,
    truckProfile?: TruckProfile
  ): Promise<RouteResponse> {
    return this.calculateRoute({
      originLat: currentLat,
      originLng: currentLng,
      destLat,
      destLng,
      transportMode: 'truck',
      truckProfile,
    });
  }

  // ============= RESET =============

  reset(): void {
    this.state = this.getDefaultState();
    this.saveState();
    console.log('[NAV_ENGINE] Reset to default state');
  }
}

// Export singleton
export const NavigationEngine = new NavigationEngineClass();

// ============= DEFAULT TRUCK PROFILE =============

export const DEFAULT_TRUCK_PROFILE: TruckProfile = {
  trailerLengthFt: 53,
  heightFt: 13.6,
  widthFt: 8.5,
  weightLbs: 80000,
  axles: 5,
};

// ============= HELPER FUNCTIONS =============

export function formatDistance(meters: number, useImperial: boolean = true): string {
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

export function formatDistanceForVoice(meters: number): string {
  const miles = meters * 0.000621371;
  
  if (miles >= 1) {
    return `${miles.toFixed(1)} miles`;
  } else if (miles >= 0.25) {
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

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }
  return `${minutes} min`;
}

export function buildVoicePrompt(instruction: RouteInstruction, distanceToManeuver: number): string {
  const distanceText = formatDistanceForVoice(distanceToManeuver);
  const action = instruction.action?.toLowerCase() || '';
  const roadName = instruction.roadName || '';
  const exitInfo = instruction.exitInfo || '';

  let prompt = '';

  if (distanceToManeuver > 50) {
    prompt = `In ${distanceText}, `;
  }

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
    const cleanInstruction = instruction.instruction
      .replace(/\d+\.\d+°?\s*(N|S|E|W|north|south|east|west)/gi, '')
      .replace(/heading\s+\w+/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    prompt = distanceToManeuver > 50 
      ? `In ${distanceText}, ${cleanInstruction.toLowerCase()}`
      : cleanInstruction;
  }

  if (roadName && !prompt.includes(roadName)) {
    prompt += ` onto ${roadName}`;
  }

  return prompt.charAt(0).toUpperCase() + prompt.slice(1) + '.';
}
