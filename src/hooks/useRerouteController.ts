import { useRef, useCallback } from 'react';

// === ULTRA-CONSERVATIVE ANTI-REROUTE CONFIGURATION ===
// Designed to prevent ALL false reroutes - match Trucker Path behavior

const REROUTE_COOLDOWN_MS = 30000; // 30 seconds between reroutes (INCREASED)
const OFF_ROUTE_THRESHOLD_M = 50; // Distance to consider off-route (INCREASED from 30)
const ON_ROUTE_THRESHOLD_M = 25; // Distance to consider back on route (INCREASED)

// At low speeds (parking, yards), use MUCH higher tolerance
const LOW_SPEED_THRESHOLD_MPS = 6.7; // ~15 mph (INCREASED)
const LOW_SPEED_OFF_ROUTE_M = 80; // Much more tolerance at low speed (INCREASED)

// Confirmation requires BOTH time AND count AND speed
const OFF_ROUTE_CONFIRM_COUNT = 8; // Consecutive readings (INCREASED from 5)
const OFF_ROUTE_CONFIRM_TIME_MS = 8000; // 8 seconds persistence (INCREASED from 7)
const MIN_SPEED_FOR_REROUTE_MPS = 6.7; // Must be > 15 mph to trigger reroute (NEW)
const VOICE_COOLDOWN_MS = 30000; // Longer voice cooldown (INCREASED)
const MAX_ACCURACY_FOR_REROUTE_M = 25; // Tighter accuracy requirement (DECREASED)

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
    
    // 1. Check cooldown FIRST - absolute block
    const timeSinceLastReroute = now - lastRerouteTimeRef.current;
    if (timeSinceLastReroute < REROUTE_COOLDOWN_MS) {
      // During cooldown, don't even update off-route state
      return {
        shouldReroute: false,
        isOffRoute: false, // Force false during cooldown
        reason: `Cooldown: ${Math.round((REROUTE_COOLDOWN_MS - timeSinceLastReroute) / 1000)}s`,
        canAnnounce: false,
      };
    }

    // 2. Check GPS accuracy - poor accuracy = don't trust
    if (accuracy !== null && accuracy > MAX_ACCURACY_FOR_REROUTE_M) {
      // Reset off-route counters when accuracy is poor
      offRouteStartTimeRef.current = null;
      offRouteCountRef.current = 0;
      return {
        shouldReroute: false,
        isOffRoute: false,
        reason: `Poor accuracy: ${Math.round(accuracy)}m (>${MAX_ACCURACY_FOR_REROUTE_M}m)`,
        canAnnounce: false,
      };
    }

    // 3. Check speed - MUST be moving fast enough to reroute
    const isSpeedTooLow = speedMps < MIN_SPEED_FOR_REROUTE_MPS;
    
    // 4. Adaptive thresholds based on speed
    const isLowSpeed = speedMps < LOW_SPEED_THRESHOLD_MPS;
    const baseOffThreshold = isLowSpeed ? LOW_SPEED_OFF_ROUTE_M : OFF_ROUTE_THRESHOLD_M;
    
    // If progressing along route, be MUCH more lenient
    const effectiveOffThreshold = isProgressing 
      ? baseOffThreshold * 2.0 
      : baseOffThreshold;
    
    const effectiveOnThreshold = isLowSpeed ? LOW_SPEED_OFF_ROUTE_M * 0.5 : ON_ROUTE_THRESHOLD_M;

    const isCurrentlyOff = distanceToRoute > effectiveOffThreshold;
    const isCurrentlyOn = distanceToRoute < effectiveOnThreshold;
    const canAnnounce = now - lastVoiceTimeRef.current > VOICE_COOLDOWN_MS;

    if (isCurrentlyOff) {
      // Start or continue off-route detection
      if (offRouteStartTimeRef.current === null) {
        offRouteStartTimeRef.current = now;
        offRouteCountRef.current = 1;
      } else {
        offRouteCountRef.current++;
      }
      onRouteCountRef.current = 0;

      const offRouteDuration = now - offRouteStartTimeRef.current;
      
      // ALL conditions must be true for reroute
      const confirmedOffRoute = 
        offRouteCountRef.current >= OFF_ROUTE_CONFIRM_COUNT &&
        offRouteDuration >= OFF_ROUTE_CONFIRM_TIME_MS &&
        !isSpeedTooLow; // Must be moving at highway speed

      if (confirmedOffRoute) {
        isOffRouteRef.current = true;
        return {
          shouldReroute: true,
          isOffRoute: true,
          reason: `Off-route: ${Math.round(distanceToRoute)}m for ${Math.round(offRouteDuration / 1000)}s @ ${(speedMps * 2.237).toFixed(1)} mph`,
          canAnnounce,
        };
      }

      // Not confirmed yet - show "warning" but don't trigger
      return {
        shouldReroute: false,
        isOffRoute: false, // Don't show off-route warning until confirmed
        reason: `Checking: ${offRouteCountRef.current}/${OFF_ROUTE_CONFIRM_COUNT}, ${Math.round(offRouteDuration / 1000)}s/${OFF_ROUTE_CONFIRM_TIME_MS / 1000}s`,
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
