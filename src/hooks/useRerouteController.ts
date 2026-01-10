import { useRef, useCallback } from 'react';

// === CONFIGURATION ===
const REROUTE_COOLDOWN_MS = 30000; // 30 seconds between reroutes
const OFF_ROUTE_THRESHOLD_M = 80; // Distance to consider off-route
const ON_ROUTE_THRESHOLD_M = 40; // Distance to consider back on route (hysteresis)
const OFF_ROUTE_CONFIRM_COUNT = 4; // Consecutive readings to confirm off-route
const OFF_ROUTE_CONFIRM_TIME_MS = 6000; // Time to confirm off-route
const VOICE_COOLDOWN_MS = 15000; // Don't spam voice announcements
const MAX_ACCURACY_FOR_REROUTE_M = 100; // Don't reroute with poor accuracy

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
    isProgressing: boolean
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

    // Hysteresis: use different thresholds for detecting off-route vs on-route
    const isCurrentlyOff = distanceToRoute > OFF_ROUTE_THRESHOLD_M;
    const isCurrentlyOn = distanceToRoute < ON_ROUTE_THRESHOLD_M;
    const canAnnounce = now - lastVoiceTimeRef.current > VOICE_COOLDOWN_MS;

    // If progressing along route, be more lenient
    const effectiveOffThreshold = isProgressing 
      ? OFF_ROUTE_THRESHOLD_M * 1.5 
      : OFF_ROUTE_THRESHOLD_M;
    const isActuallyOff = distanceToRoute > effectiveOffThreshold;

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
