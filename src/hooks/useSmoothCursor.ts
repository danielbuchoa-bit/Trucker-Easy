import { useRef, useCallback, useEffect, useState } from 'react';

// === CONFIGURATION ===
const TARGET_FPS = 60;
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS; // ~16.67ms

// Interpolation settings
const INTERPOLATION_DURATION_MS = 800; // How long to interpolate between fixes
const DEAD_RECKONING_MAX_MS = 2000; // Max time to project forward
const MIN_SPEED_FOR_DR_MPS = 0.5; // ~1.8 km/h minimum for dead reckoning

// Smoothing
const POSITION_LERP_SPEED = 0.12; // Per-frame position lerp (lower = smoother)
const HEADING_LERP_SPEED = 0.15; // Per-frame heading lerp

export interface CursorPosition {
  lat: number;
  lng: number;
  heading: number;
  speed: number;
  timestamp: number;
}

export interface RenderCursor {
  lat: number;
  lng: number;
  heading: number;
  isAnimating: boolean;
  isDeadReckoning: boolean;
  frameCount: number;
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

// Project position forward
function projectPosition(
  lat: number,
  lng: number,
  speedMps: number,
  headingDeg: number,
  deltaMs: number
): { lat: number; lng: number } {
  if (speedMps < MIN_SPEED_FOR_DR_MPS || deltaMs <= 0) {
    return { lat, lng };
  }

  const distanceM = speedMps * (deltaMs / 1000);
  const headingRad = (headingDeg * Math.PI) / 180;
  
  // Approximate conversion from meters to degrees
  const latOffset = (distanceM * Math.cos(headingRad)) / 111000;
  const lngOffset = (distanceM * Math.sin(headingRad)) / (111000 * Math.cos(lat * Math.PI / 180));

  return {
    lat: lat + latOffset,
    lng: lng + lngOffset,
  };
}

/**
 * High-performance cursor animation hook
 * 
 * Takes snapped position from map matching and provides
 * silky-smooth 60fps cursor animation using requestAnimationFrame
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
  });
  
  // Throttle React state updates to ~30fps
  const lastStateUpdateRef = useRef<number>(0);
  const STATE_UPDATE_INTERVAL = 33; // ~30fps

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

    if (prev && timeSinceLastFix < INTERPOLATION_DURATION_MS) {
      // INTERPOLATION: Smooth animation between previous and current fix
      const fixInterval = curr.timestamp - prev.timestamp;
      const progress = fixInterval > 0 
        ? Math.min(1, timeSinceLastFix / Math.max(fixInterval, 100))
        : 1;
      
      const easedProgress = easeOutQuart(progress);
      
      targetLat = lerp(prev.lat, curr.lat, easedProgress);
      targetLng = lerp(prev.lng, curr.lng, easedProgress);
      targetHeading = lerpAngle(prev.heading, curr.heading, easedProgress);
      
      // Continue with dead reckoning if interpolation complete
      if (progress >= 1 && curr.speed >= MIN_SPEED_FOR_DR_MPS) {
        const drTime = timeSinceLastFix - fixInterval;
        if (drTime > 0 && drTime < DEAD_RECKONING_MAX_MS) {
          const projected = projectPosition(curr.lat, curr.lng, curr.speed, curr.heading, drTime);
          targetLat = projected.lat;
          targetLng = projected.lng;
          isDeadReckoning = true;
        }
      }
    } else if (curr) {
      // DEAD RECKONING: No previous fix or interpolation expired
      if (curr.speed >= MIN_SPEED_FOR_DR_MPS && timeSinceLastFix < DEAD_RECKONING_MAX_MS) {
        const projected = projectPosition(curr.lat, curr.lng, curr.speed, curr.heading, timeSinceLastFix);
        targetLat = projected.lat;
        targetLng = projected.lng;
        isDeadReckoning = true;
      } else {
        targetLat = curr.lat;
        targetLng = curr.lng;
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

  // Process new matched position
  useEffect(() => {
    if (!enabled || !matchedPosition) {
      stopAnimation();
      setRenderCursor(null);
      prevPosRef.current = null;
      currPosRef.current = null;
      return;
    }

    const now = performance.now();

    // Spike rejection - ignore if position jumps too far too fast
    if (currPosRef.current) {
      const timeDelta = (now - lastFixTimeRef.current) / 1000;
      if (timeDelta > 0.05 && timeDelta < 30) {
        const R = 6371e3;
        const dLat = (matchedPosition.lat - currPosRef.current.lat) * Math.PI / 180;
        const dLng = (matchedPosition.lng - currPosRef.current.lng) * Math.PI / 180;
        const a = Math.sin(dLat/2) ** 2 + 
                  Math.cos(currPosRef.current.lat * Math.PI / 180) * 
                  Math.cos(matchedPosition.lat * Math.PI / 180) * 
                  Math.sin(dLng/2) ** 2;
        const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const impliedSpeed = distance / timeDelta;
        
        // Reject if implied speed > 200 km/h (~55 m/s)
        if (impliedSpeed > 55) {
          console.log('[CURSOR] Spike rejected:', { 
            distance: Math.round(distance), 
            speed: Math.round(impliedSpeed * 3.6) + ' km/h' 
          });
          return;
        }
      }
    }

    // Store previous position for interpolation
    if (currPosRef.current) {
      prevPosRef.current = { ...currPosRef.current };
    }

    // Update current position
    currPosRef.current = { ...matchedPosition };
    lastFixTimeRef.current = now;

    // Initialize render state if needed
    if (renderStateRef.current.lat === 0 && renderStateRef.current.lng === 0) {
      renderStateRef.current.lat = matchedPosition.lat;
      renderStateRef.current.lng = matchedPosition.lng;
      renderStateRef.current.heading = matchedPosition.heading;
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
