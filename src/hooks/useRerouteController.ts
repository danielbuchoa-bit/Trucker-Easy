import { useRef, useCallback } from 'react';

// === CONSERVATIVE ANTI-REROUTE CONFIGURATION ===
// Designed to prevent false reroutes from GPS jitter

const REROUTE_COOLDOWN_MS = 25000; // 25 seconds between reroutes
const OFF_ROUTE_THRESHOLD_M = 30; // Distance to consider off-route (meters)
const ON_ROUTE_THRESHOLD_M = 15; // Distance to consider back on route (hysteresis)

// At low speeds (parking, yards), use higher tolerance
const LOW_SPEED_THRESHOLD_MPS = 4.5; // ~10 mph
const LOW_SPEED_OFF_ROUTE_M = 50; // More tolerance at low speed

const OFF_ROUTE_CONFIRM_COUNT = 5; // Consecutive readings to confirm off-route
const OFF_ROUTE_CONFIRM_TIME_MS = 7000; // Must stay off-route for 7 seconds
const VOICE_COOLDOWN_MS = 20000; // Don't spam voice announcements
const MAX_ACCURACY_FOR_REROUTE_M = 40; // Don't reroute with poor accuracy

interface RerouteState {
  shouldReroute: boolean;
  isOffRoute: boolean;
  reason: string | null;
  canAnnounce: boolean;
}

/**
 * Controller for stable rerouting decisions
 * Prevents spam, implements hysteresis, respects cooldowns
 */
export function useRerouteController() {
  // Timing refs
  const lastRerouteTimeRef = useRef<number>(0);
  const lastVoiceTimeRef = useRef<number>(0);
  
  // Off-route detection state
  const offRouteStartTimeRef = useRef<number | null>(null);
  const offRouteCountRef = useRef<number>(0);
  const onRouteCountRef = useRef<number>(0);
  const isOffRouteRef = useRef<boolean>(false);

  /**
   * Check if reroute conditions are met
   */
  const checkReroute = useCallback((
    distanceToRoute: number,
    accuracy: number | null,
    isProgressing: boolean,
    speedMps: number = 0
  ): RerouteState => {
    const now = Date.now();
    
    // Check cooldown
    const timeSinceLastReroute = now - lastRerouteTimeRef.current;
    if (timeSinceLastReroute < REROUTE_COOLDOWN_MS) {
      return {
        shouldReroute: false,
        isOffRoute: isOffRouteRef.current,
        reason: `Cooldown: ${Math.round((REROUTE_COOLDOWN_MS - timeSinceLastReroute) / 1000)}s`,
        canAnnounce: false,
      };
    }

    // Check accuracy
    if (accuracy !== null && accuracy > MAX_ACCURACY_FOR_REROUTE_M) {
      return {
        shouldReroute: false,
        isOffRoute: isOffRouteRef.current,
        reason: `Poor accuracy: ${Math.round(accuracy)}m`,
        canAnnounce: false,
      };
    }

    // Adaptive thresholds based on speed
    const isLowSpeed = speedMps < LOW_SPEED_THRESHOLD_MPS;
    const baseOffThreshold = isLowSpeed ? LOW_SPEED_OFF_ROUTE_M : OFF_ROUTE_THRESHOLD_M;
    
    // If progressing along route, be more lenient
    const effectiveOffThreshold = isProgressing 
      ? baseOffThreshold * 1.5 
      : baseOffThreshold;
    
    const effectiveOnThreshold = isLowSpeed ? LOW_SPEED_OFF_ROUTE_M * 0.5 : ON_ROUTE_THRESHOLD_M;

    const isCurrentlyOff = distanceToRoute > effectiveOffThreshold;
    const isCurrentlyOn = distanceToRoute < effectiveOnThreshold;
    const canAnnounce = now - lastVoiceTimeRef.current > VOICE_COOLDOWN_MS;

    const isActuallyOff = isCurrentlyOff;

    if (isActuallyOff) {
      // Off-route detection
      if (offRouteStartTimeRef.current === null) {
        offRouteStartTimeRef.current = now;
        offRouteCountRef.current = 1;
      } else {
        offRouteCountRef.current++;
      }
      onRouteCountRef.current = 0;

      const offRouteDuration = now - offRouteStartTimeRef.current;
      const confirmedOffRoute = 
        offRouteCountRef.current >= OFF_ROUTE_CONFIRM_COUNT &&
        offRouteDuration >= OFF_ROUTE_CONFIRM_TIME_MS;

      if (confirmedOffRoute) {
        isOffRouteRef.current = true;
        return {
          shouldReroute: true,
          isOffRoute: true,
          reason: `Off-route: ${Math.round(distanceToRoute)}m for ${Math.round(offRouteDuration / 1000)}s`,
          canAnnounce,
        };
      }

      return {
        shouldReroute: false,
        isOffRoute: true,
        reason: `Confirming off-route: ${offRouteCountRef.current}/${OFF_ROUTE_CONFIRM_COUNT}`,
        canAnnounce: false,
      };
    } else if (isCurrentlyOn) {
      // Back on route
      onRouteCountRef.current++;
      
      if (onRouteCountRef.current >= 2) {
        offRouteStartTimeRef.current = null;
        offRouteCountRef.current = 0;
        isOffRouteRef.current = false;
      }

      return {
        shouldReroute: false,
        isOffRoute: false,
        reason: null,
        canAnnounce: false,
      };
    }

    // In between thresholds - maintain current state (hysteresis)
    return {
      shouldReroute: false,
      isOffRoute: isOffRouteRef.current,
      reason: isOffRouteRef.current ? `Near route: ${Math.round(distanceToRoute)}m` : null,
      canAnnounce: false,
    };
  }, []);

  /**
   * Record that a reroute was performed
   */
  const recordReroute = useCallback(() => {
    const now = Date.now();
    lastRerouteTimeRef.current = now;
    offRouteStartTimeRef.current = null;
    offRouteCountRef.current = 0;
    onRouteCountRef.current = 0;
    isOffRouteRef.current = false;
  }, []);

  /**
   * Record that a voice announcement was made
   */
  const recordVoiceAnnouncement = useCallback(() => {
    lastVoiceTimeRef.current = Date.now();
  }, []);

  /**
   * Reset controller state (e.g., new route)
   */
  const reset = useCallback(() => {
    lastRerouteTimeRef.current = 0;
    lastVoiceTimeRef.current = 0;
    offRouteStartTimeRef.current = null;
    offRouteCountRef.current = 0;
    onRouteCountRef.current = 0;
    isOffRouteRef.current = false;
  }, []);

  /**
   * Get time until next reroute is allowed
   */
  const getCooldownRemaining = useCallback((): number => {
    const elapsed = Date.now() - lastRerouteTimeRef.current;
    return Math.max(0, REROUTE_COOLDOWN_MS - elapsed);
  }, []);

  return {
    checkReroute,
    recordReroute,
    recordVoiceAnnouncement,
    reset,
    getCooldownRemaining,
  };
}
