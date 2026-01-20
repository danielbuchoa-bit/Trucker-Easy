import { useRef, useCallback, useEffect, useState } from 'react';
import type { NavigationOutput } from '@/hooks/useGpsNavigationEngine';
import { DEAD_RECKONING, SPIKE } from '@/lib/gps';
import { projectPosition } from '@/lib/gps/geometry';

// === CONFIGURATION ===
const TARGET_FPS = 60;
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS; // ~16.67ms

// === [A] FIX: Reduced interpolation for lower latency ===
const INTERPOLATION_DURATION_MS = 350; // Reduced from 600ms for lower latency
const DEAD_RECKONING_MAX_MS = DEAD_RECKONING.MAX_DURATION_MS;
const MIN_SPEED_FOR_DR_MPS = DEAD_RECKONING.MIN_SPEED_MPS;

// === [D] FIX: Increased LERP speeds for faster response ===
const POSITION_LERP_SPEED = 0.28; // Increased from 0.18 (faster response)
const HEADING_LERP_SPEED = 0.30; // Increased from 0.2 (faster response)

// === [A] SPIKE REJECTION CONFIG - tuned for trucks ===
// Max implied speed: 35 m/s = 126 km/h (from constants.ts SPIKE.MAX_SPEED_MPS)
// Consecutive rejects before freeze: 3
const SPIKE_CONFIG = {
  MAX_SPEED_MPS: SPIKE.MAX_SPEED_MPS, // 35 m/s = 126 km/h
  MAX_CONSECUTIVE_REJECTS: 3, // Don't freeze until 3 consecutive spikes
  MIN_TIME_DELTA_S: 0.1, // Ignore if time delta too small
  RECOVERY_AFTER_REJECT: true, // Use interpolation after reject instead of freeze
};

export interface CursorPosition {
  lat: number;
  lng: number;
  heading: number;
  speed: number;
  timestamp: number;
  // Enhanced data from GPS engine
  snappedLat?: number;
  snappedLng?: number;
  isOnRoute?: boolean;
  matchConfidence?: number;
}

export interface RenderCursor {
  lat: number;
  lng: number;
  heading: number;
  isAnimating: boolean;
  isDeadReckoning: boolean;
  frameCount: number;
  // Enhanced rendering data
  isOnRoute: boolean;
  matchConfidence: number;
  // Debug info
  spikeRejectCount: number;
  lastSpikeRejected: { distance: number; speed: string; reason: string } | null;
  consecutiveRejects: number;
}

// Ease function for smooth deceleration
function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 4);
}

// Linear interpolation
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Angle interpolation with wraparound
function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return ((a + diff * t) + 360) % 360;
}

/**
 * High-performance cursor animation hook
 * 
 * [A] FIX: Improved spike rejection - doesn't freeze on single reject
 * [D] FIX: Reduced latency with faster LERP and shorter interpolation
 * 
 * Takes snapped position from engine and provides silky-smooth 60fps animation.
 */
export function useSmoothCursor(
  matchedPosition: CursorPosition | null,
  enabled: boolean = true
) {
  const [renderCursor, setRenderCursor] = useState<RenderCursor | null>(null);
  
  // Animation state (refs to avoid re-renders during animation)
  const rafRef = useRef<number | null>(null);
  const isRunningRef = useRef(false);
  const frameCountRef = useRef(0);
  
  // Position tracking
  const prevPosRef = useRef<CursorPosition | null>(null);
  const currPosRef = useRef<CursorPosition | null>(null);
  const lastFixTimeRef = useRef<number>(0);
  
  // Current render state (updated every frame)
  const renderStateRef = useRef<RenderCursor>({
    lat: 0,
    lng: 0,
    heading: 0,
    isAnimating: false,
    isDeadReckoning: false,
    frameCount: 0,
    isOnRoute: false,
    matchConfidence: 0,
    spikeRejectCount: 0,
    lastSpikeRejected: null,
    consecutiveRejects: 0,
  });
  
  // Throttle React state updates to ~30fps
  const lastStateUpdateRef = useRef<number>(0);
  const STATE_UPDATE_INTERVAL = 33; // ~30fps
  
  // === [A] FIX: Spike tracking with consecutive count ===
  const spikeRejectCountRef = useRef<number>(0);
  const consecutiveRejectsRef = useRef<number>(0);
  const lastSpikeRejectedRef = useRef<{ distance: number; speed: string; reason: string } | null>(null);
  const lastGoodPositionRef = useRef<CursorPosition | null>(null);

  // Animation loop - runs at 60fps
  const animationLoop = useCallback(() => {
    if (!isRunningRef.current) {
      rafRef.current = null;
      return;
    }

    const now = performance.now();
    frameCountRef.current++;
    
    const prev = prevPosRef.current;
    const curr = currPosRef.current;

    if (!curr) {
      rafRef.current = requestAnimationFrame(animationLoop);
      return;
    }

    const timeSinceLastFix = now - lastFixTimeRef.current;
    
    let targetLat: number;
    let targetLng: number;
    let targetHeading: number;
    let isDeadReckoning = false;

    // Use snapped position from GPS engine if available
    const currLat = curr.snappedLat ?? curr.lat;
    const currLng = curr.snappedLng ?? curr.lng;
    const prevLat = prev?.snappedLat ?? prev?.lat ?? currLat;
    const prevLng = prev?.snappedLng ?? prev?.lng ?? currLng;

    if (prev && timeSinceLastFix < INTERPOLATION_DURATION_MS) {
      // INTERPOLATION: Smooth animation between previous and current fix
      const fixInterval = curr.timestamp - prev.timestamp;
      const progress = fixInterval > 0 
        ? Math.min(1, timeSinceLastFix / Math.max(fixInterval, 100))
        : 1;
      
      const easedProgress = easeOutQuart(progress);
      
      targetLat = lerp(prevLat, currLat, easedProgress);
      targetLng = lerp(prevLng, currLng, easedProgress);
      targetHeading = lerpAngle(prev.heading, curr.heading, easedProgress);
      
      // Continue with dead reckoning if interpolation complete
      if (progress >= 1 && curr.speed >= MIN_SPEED_FOR_DR_MPS) {
        const drTime = timeSinceLastFix - fixInterval;
        if (drTime > 0 && drTime < DEAD_RECKONING_MAX_MS) {
          const projected = projectPosition(currLat, currLng, curr.speed, curr.heading, drTime);
          targetLat = projected.lat;
          targetLng = projected.lng;
          isDeadReckoning = true;
        }
      }
    } else if (curr) {
      // DEAD RECKONING: No previous fix or interpolation expired
      if (curr.speed >= MIN_SPEED_FOR_DR_MPS && timeSinceLastFix < DEAD_RECKONING_MAX_MS) {
        const projected = projectPosition(currLat, currLng, curr.speed, curr.heading, timeSinceLastFix);
        targetLat = projected.lat;
        targetLng = projected.lng;
        isDeadReckoning = true;
      } else {
        targetLat = currLat;
        targetLng = currLng;
      }
      targetHeading = curr.heading;
    } else {
      rafRef.current = requestAnimationFrame(animationLoop);
      return;
    }

    // Smooth per-frame interpolation for extra fluidity
    const state = renderStateRef.current;
    state.lat = lerp(state.lat, targetLat, POSITION_LERP_SPEED);
    state.lng = lerp(state.lng, targetLng, POSITION_LERP_SPEED);
    state.heading = lerpAngle(state.heading, targetHeading, HEADING_LERP_SPEED);
    state.isAnimating = true;
    state.isDeadReckoning = isDeadReckoning;
    state.frameCount = frameCountRef.current;
    state.isOnRoute = curr.isOnRoute ?? false;
    state.matchConfidence = curr.matchConfidence ?? 0;
    state.spikeRejectCount = spikeRejectCountRef.current;
    state.lastSpikeRejected = lastSpikeRejectedRef.current;

    // Throttle React state updates
    if (now - lastStateUpdateRef.current >= STATE_UPDATE_INTERVAL) {
      lastStateUpdateRef.current = now;
      setRenderCursor({ ...state });
    }

    rafRef.current = requestAnimationFrame(animationLoop);
  }, []);

  // Start animation
  const startAnimation = useCallback(() => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    rafRef.current = requestAnimationFrame(animationLoop);
  }, [animationLoop]);

  // Stop animation
  const stopAnimation = useCallback(() => {
    isRunningRef.current = false;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // === [A] FIX: Process new matched position with improved spike handling ===
  useEffect(() => {
    if (!enabled || !matchedPosition) {
      stopAnimation();
      setRenderCursor(null);
      prevPosRef.current = null;
      currPosRef.current = null;
      consecutiveRejectsRef.current = 0;
      return;
    }

    const now = performance.now();
    let shouldAccept = true;
    let rejectReason = '';

    // === [A] FIX: Improved spike rejection with consecutive count ===
    if (currPosRef.current) {
      const timeDelta = (now - lastFixTimeRef.current) / 1000;
      
      // Only check if time delta is reasonable
      if (timeDelta > SPIKE_CONFIG.MIN_TIME_DELTA_S && timeDelta < 30) {
        const currLat = currPosRef.current.snappedLat ?? currPosRef.current.lat;
        const currLng = currPosRef.current.snappedLng ?? currPosRef.current.lng;
        const newLat = matchedPosition.snappedLat ?? matchedPosition.lat;
        const newLng = matchedPosition.snappedLng ?? matchedPosition.lng;
        
        // Haversine distance
        const R = 6371e3;
        const dLat = (newLat - currLat) * Math.PI / 180;
        const dLng = (newLng - currLng) * Math.PI / 180;
        const a = Math.sin(dLat/2) ** 2 + 
                  Math.cos(currLat * Math.PI / 180) * 
                  Math.cos(newLat * Math.PI / 180) * 
                  Math.sin(dLng/2) ** 2;
        const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const impliedSpeed = distance / timeDelta;
        
        // Check against truck-realistic threshold (35 m/s = 126 km/h)
        if (impliedSpeed > SPIKE_CONFIG.MAX_SPEED_MPS) {
          consecutiveRejectsRef.current++;
          spikeRejectCountRef.current++;
          rejectReason = `impliedSpeed=${Math.round(impliedSpeed * 3.6)}km/h > ${Math.round(SPIKE_CONFIG.MAX_SPEED_MPS * 3.6)}km/h`;
          
          lastSpikeRejectedRef.current = { 
            distance: Math.round(distance), 
            speed: Math.round(impliedSpeed * 3.6) + ' km/h',
            reason: rejectReason,
          };
          
          console.log('[CURSOR] Spike detected:', {
            ...lastSpikeRejectedRef.current,
            consecutiveRejects: consecutiveRejectsRef.current,
            timeDelta: timeDelta.toFixed(2) + 's',
          });
          
          // === [A] FIX: Only freeze if MAX_CONSECUTIVE_REJECTS reached ===
          if (consecutiveRejectsRef.current >= SPIKE_CONFIG.MAX_CONSECUTIVE_REJECTS) {
            shouldAccept = false;
            console.log('[CURSOR] ❌ Frozen: too many consecutive spikes');
          } else if (SPIKE_CONFIG.RECOVERY_AFTER_REJECT && lastGoodPositionRef.current) {
            // Use dead reckoning from last good position instead of freezing
            const drTime = now - lastFixTimeRef.current;
            if (drTime < DEAD_RECKONING_MAX_MS && lastGoodPositionRef.current.speed > MIN_SPEED_FOR_DR_MPS) {
              const projected = projectPosition(
                lastGoodPositionRef.current.snappedLat ?? lastGoodPositionRef.current.lat,
                lastGoodPositionRef.current.snappedLng ?? lastGoodPositionRef.current.lng,
                lastGoodPositionRef.current.speed,
                lastGoodPositionRef.current.heading,
                drTime
              );
              // Accept with interpolated position
              currPosRef.current = {
                ...matchedPosition,
                lat: projected.lat,
                lng: projected.lng,
                snappedLat: projected.lat,
                snappedLng: projected.lng,
              };
              console.log('[CURSOR] 🔄 Using dead reckoning after spike reject');
            }
          }
        } else {
          // Good position - reset consecutive counter
          consecutiveRejectsRef.current = 0;
        }
      }
    }

    // Update render state with spike info
    renderStateRef.current.spikeRejectCount = spikeRejectCountRef.current;
    renderStateRef.current.lastSpikeRejected = lastSpikeRejectedRef.current;
    renderStateRef.current.consecutiveRejects = consecutiveRejectsRef.current;

    if (!shouldAccept) {
      return; // Skip this position but don't stop animation
    }

    // Store previous position for interpolation
    if (currPosRef.current) {
      prevPosRef.current = { ...currPosRef.current };
    }

    // Update current position and save as last good
    currPosRef.current = { ...matchedPosition };
    lastGoodPositionRef.current = { ...matchedPosition };
    lastFixTimeRef.current = now;

    // Initialize render state if needed
    const initLat = matchedPosition.snappedLat ?? matchedPosition.lat;
    const initLng = matchedPosition.snappedLng ?? matchedPosition.lng;
    
    if (renderStateRef.current.lat === 0 && renderStateRef.current.lng === 0) {
      renderStateRef.current.lat = initLat;
      renderStateRef.current.lng = initLng;
      renderStateRef.current.heading = matchedPosition.heading;
      renderStateRef.current.isOnRoute = matchedPosition.isOnRoute ?? false;
      renderStateRef.current.matchConfidence = matchedPosition.matchConfidence ?? 0;
    }

    // Start animation
    startAnimation();
  }, [matchedPosition, enabled, startAnimation, stopAnimation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAnimation();
    };
  }, [stopAnimation]);

  return renderCursor;
}

/**
 * Helper to convert UserPosition from context to CursorPosition for useSmoothCursor
 */
export function toCursorPosition(
  userPosition: {
    lat: number;
    lng: number;
    heading: number | null;
    speed: number | null;
    snappedLat?: number;
    snappedLng?: number;
    isOnRoute?: boolean;
    matchConfidence?: number;
  } | null
): CursorPosition | null {
  if (!userPosition) return null;
  
  return {
    lat: userPosition.lat,
    lng: userPosition.lng,
    heading: userPosition.heading ?? 0,
    speed: userPosition.speed ?? 0,
    timestamp: Date.now(),
    snappedLat: userPosition.snappedLat,
    snappedLng: userPosition.snappedLng,
    isOnRoute: userPosition.isOnRoute,
    matchConfidence: userPosition.matchConfidence,
  };
}
