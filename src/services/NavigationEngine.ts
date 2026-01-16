/**
 * Unified Navigation Engine - NextBillion Primary + HERE Fallback
 * 
 * Architecture:
 * - NextBillion: Primary engine for ALL truck navigation (routing, turn-by-turn, reroute, ETA)
 * - HERE: Fallback ONLY when NextBillion fails
 * - Only ONE engine active at a time
 * 
 * Fallback triggers:
 * - HTTP error (>=400)
 * - Timeout (>5 seconds)
 * - Rate limit (429)
 * - Empty/invalid polyline
 * - Two reroute failures within 30 seconds
 * - Quality degradation (cursor >60m off route for >8s with divergent heading)
 */

import { supabase } from "@/integrations/supabase/client";

// ============= TYPES =============

export type ActiveEngine = 'nextbillion' | 'here';

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
  // Engine metadata
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
  eta: number | null; // seconds remaining
  lastSuccessfulPrimaryTimestamp: number;
  fallbackReason: string | null;
  fallbackActivatedAt: number | null;
}

// ============= CONFIGURATION =============

// Fallback triggers
const ENGINE_TIMEOUT_MS = 5000; // 5 second timeout
const FALLBACK_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes before trying NextBillion again
const REROUTE_FAILURE_WINDOW_MS = 30000; // 2 failures within 30s triggers fallback
const MAX_REROUTE_FAILURES = 2;

// Quality degradation thresholds
const QUALITY_DISTANCE_THRESHOLD_M = 60; // 60m off route
const QUALITY_TIME_THRESHOLD_MS = 8000; // for 8 seconds
const HEADING_DIVERGENCE_THRESHOLD_DEG = 45; // with 45° heading difference

// State storage key
const ENGINE_STATE_KEY = 'navigationEngineState';

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

// ============= ENGINE STATE =============

class NavigationEngineClass {
  private state: NavigationEngineState;
  private rerouteFailures: number[] = [];
  private qualityDegradationStart: number | null = null;

  constructor() {
    this.state = this.loadState();
  }

  private loadState(): NavigationEngineState {
    try {
      const saved = localStorage.getItem(ENGINE_STATE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Check if fallback cooldown has expired
        if (parsed.fallbackActivatedAt && 
            Date.now() - parsed.fallbackActivatedAt >= FALLBACK_COOLDOWN_MS) {
          // Reset to primary engine
          console.log('[NAV_ENGINE] Fallback cooldown expired, resetting to NextBillion');
          return this.getDefaultState();
        }
        return parsed;
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
      lastSuccessfulPrimaryTimestamp: Date.now(),
      fallbackReason: null,
      fallbackActivatedAt: null,
    };
  }

  private saveState(): void {
    try {
      localStorage.setItem(ENGINE_STATE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.error('[NAV_ENGINE] Failed to save state:', e);
    }
  }

  private emitDiagnostic(data: Parameters<DiagnosticsCallback>[0]) {
    diagnosticsCallbacks.forEach(cb => cb(data));
  }

  // ============= ENGINE SELECTION =============

  getActiveEngine(): ActiveEngine {
    // Check if fallback cooldown has expired
    if (this.state.fallbackActivatedAt && 
        Date.now() - this.state.fallbackActivatedAt >= FALLBACK_COOLDOWN_MS) {
      console.log('[NAV_ENGINE] Trying to recover to NextBillion');
      this.state.activeEngine = 'nextbillion';
      this.state.fallbackActivatedAt = null;
      this.state.fallbackReason = null;
      this.saveState();
    }
    return this.state.activeEngine;
  }

  getState(): NavigationEngineState {
    return { ...this.state };
  }

  private activateFallback(reason: string): void {
    console.warn('[NAV_ENGINE] Activating HERE fallback:', reason);
    this.state.activeEngine = 'here';
    this.state.fallbackReason = reason;
    this.state.fallbackActivatedAt = Date.now();
    this.saveState();

    this.emitDiagnostic({
      service: 'NavigationEngine',
      endpoint: 'fallback',
      status: 'error',
      message: `Fallback activated: ${reason}`,
      engine: 'here',
    });
  }

  private recordRerouteFailure(): void {
    const now = Date.now();
    this.rerouteFailures.push(now);
    
    // Clean old failures
    this.rerouteFailures = this.rerouteFailures.filter(
      t => now - t < REROUTE_FAILURE_WINDOW_MS
    );

    if (this.rerouteFailures.length >= MAX_REROUTE_FAILURES) {
      this.activateFallback(`${MAX_REROUTE_FAILURES} reroute failures within ${REROUTE_FAILURE_WINDOW_MS / 1000}s`);
      this.rerouteFailures = [];
    }
  }

  // ============= QUALITY MONITORING =============

  checkQualityDegradation(
    distanceToRouteM: number,
    userHeading: number | null,
    routeHeading: number | null
  ): void {
    if (this.state.activeEngine !== 'nextbillion') return;

    const now = Date.now();

    // Check distance threshold
    if (distanceToRouteM < QUALITY_DISTANCE_THRESHOLD_M) {
      this.qualityDegradationStart = null;
      return;
    }

    // Check heading divergence
    if (userHeading !== null && routeHeading !== null) {
      let headingDiff = Math.abs(userHeading - routeHeading);
      if (headingDiff > 180) headingDiff = 360 - headingDiff;
      
      if (headingDiff < HEADING_DIVERGENCE_THRESHOLD_DEG) {
        this.qualityDegradationStart = null;
        return;
      }
    }

    // Quality is degraded
    if (this.qualityDegradationStart === null) {
      this.qualityDegradationStart = now;
      console.log('[NAV_ENGINE] Quality degradation detected:', {
        distance: Math.round(distanceToRouteM),
        userHeading,
        routeHeading,
      });
    } else if (now - this.qualityDegradationStart >= QUALITY_TIME_THRESHOLD_MS) {
      this.activateFallback(
        `Quality degradation: ${Math.round(distanceToRouteM)}m off route for ${Math.round((now - this.qualityDegradationStart) / 1000)}s`
      );
      this.qualityDegradationStart = null;
    }
  }

  // ============= ROUTE CALCULATION =============

  async calculateRoute(request: RouteRequest): Promise<RouteResponse> {
    const engine = this.getActiveEngine();
    const isTruck = request.transportMode !== 'car';

    console.log(`[NAV_ENGINE] Calculating route with ${engine}`, {
      origin: `${request.originLat.toFixed(4)},${request.originLng.toFixed(4)}`,
      dest: `${request.destLat.toFixed(4)},${request.destLng.toFixed(4)}`,
      mode: request.transportMode,
    });

    try {
      let result: RouteResponse;

      if (engine === 'nextbillion' && isTruck) {
        result = await this.calculateWithNextBillion(request);
      } else {
        result = await this.calculateWithHere(request);
      }

      // Validate response
      if (!result.polyline || result.polyline.length < 10) {
        throw new Error('Invalid or empty polyline');
      }

      // Success - update state
      if (engine === 'nextbillion') {
        this.state.lastSuccessfulPrimaryTimestamp = Date.now();
      }
      
      this.state.routePolyline = result.polyline;
      this.state.maneuvers = result.instructions;
      this.state.eta = result.duration;
      this.saveState();

      result.engine = engine;
      return result;

    } catch (error) {
      console.error(`[NAV_ENGINE] ${engine} failed:`, error);

      // If NextBillion failed, try HERE as fallback
      if (engine === 'nextbillion') {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.activateFallback(errorMessage);
        
        // Retry with HERE
        return this.calculateRoute(request);
      }

      // HERE also failed - propagate error
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
        // Check for rate limit
        if (data.status === 429) {
          throw new Error('Rate limit exceeded (429)');
        }
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

  private async calculateWithHere(request: RouteRequest): Promise<RouteResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ENGINE_TIMEOUT_MS);

    try {
      const { data, error } = await supabase.functions.invoke('here_route', {
        body: {
          originLat: request.originLat,
          originLng: request.originLng,
          destLat: request.destLat,
          destLng: request.destLng,
          transportMode: request.transportMode || 'truck',
          avoidTolls: request.avoidTolls,
          avoidHighways: request.avoidHighways,
          avoidFerries: request.avoidFerries,
          truckProfile: request.truckProfile,
          waypoints: request.waypoints,
        },
      });

      clearTimeout(timeoutId);

      if (error) {
        this.emitDiagnostic({
          service: 'HERE',
          endpoint: 'here_route',
          status: 'error',
          message: error.message,
          engine: 'here',
        });
        throw new Error(error.message || 'HERE routing failed');
      }

      if (data.error) {
        throw new Error(data.error);
      }

      this.emitDiagnostic({
        service: 'HERE',
        endpoint: 'here_route',
        status: 'ok',
        message: `Route: ${(data.distance / 1609.34).toFixed(1)} mi, ${Math.round(data.duration / 60)} min`,
        resultCount: data.instructions?.length || 0,
        engine: 'here',
      });

      return {
        ...data,
        engine: 'here',
      } as RouteResponse;

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
    try {
      const result = await this.calculateRoute({
        originLat: currentLat,
        originLng: currentLng,
        destLat,
        destLng,
        transportMode: 'truck',
        truckProfile,
      });

      return result;
    } catch (error) {
      this.recordRerouteFailure();
      throw error;
    }
  }

  // ============= RESET =============

  reset(): void {
    this.state = this.getDefaultState();
    this.rerouteFailures = [];
    this.qualityDegradationStart = null;
    this.saveState();
    console.log('[NAV_ENGINE] Reset to default state');
  }

  // Force switch to primary (NextBillion)
  forcePrimary(): void {
    this.state.activeEngine = 'nextbillion';
    this.state.fallbackReason = null;
    this.state.fallbackActivatedAt = null;
    this.rerouteFailures = [];
    this.qualityDegradationStart = null;
    this.saveState();
    console.log('[NAV_ENGINE] Forced to primary (NextBillion)');
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

// Format distance in miles/feet (US units)
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

// Format distance for voice (more natural)
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

// Format duration
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }
  return `${minutes} min`;
}

// Build voice prompt for instruction (Google Maps style)
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
