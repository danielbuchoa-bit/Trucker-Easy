import { useRef, useCallback, useEffect, useState } from 'react';
import type { UserPosition } from '@/contexts/ActiveNavigationContext';

// === CONFIGURATION ===
const TARGET_FPS = 60;
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS; // ~16.67ms
const MAX_INTERPOLATION_TIME_MS = 1500; // Maximum time to interpolate before dead-reckoning
const DEAD_RECKONING_MAX_MS = 3000; // Maximum dead-reckoning duration
const MIN_SPEED_FOR_DR_MPS = 1; // ~3.6 km/h minimum for dead reckoning

export interface InterpolatedPosition {
  // Original filtered position
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  accuracy: number | null;
  
  // Interpolated render position (use this for marker/camera)
  renderLat: number;
  renderLng: number;
  renderHeading: number;
  
  // Debug info
  interpolationProgress: number;
  isDeadReckoning: boolean;
  timeSinceLastFix: number;
}

// Haversine distance in meters
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Linear interpolation
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(1, Math.max(0, t));
}

// Interpolate angle with wraparound
function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return ((a + diff * Math.min(1, Math.max(0, t))) + 360) % 360;
}

// Ease-out cubic for smooth deceleration
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// Project position forward based on speed/heading (dead reckoning)
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

  // Convert meters to degrees
  const latOffset = (distanceM * Math.cos(headingRad)) / 111000;
  const lngOffset = (distanceM * Math.sin(headingRad)) / (111000 * Math.cos(lat * Math.PI / 180));

  return {
    lat: lat + latOffset,
    lng: lng + lngOffset,
  };
}

/**
 * High-performance position interpolator for 60fps smooth cursor movement
 * 
 * Separates "logical position" (filtered GPS fix) from "render position" (animated cursor)
 * Uses requestAnimationFrame for continuous updates between GPS fixes
 */
export function usePositionInterpolator(
  filteredPosition: UserPosition | null,
  options: {
    enabled?: boolean;
    adaptiveAlpha?: boolean; // Adjust smoothing based on speed
  } = {}
) {
  const { enabled = true, adaptiveAlpha = true } = options;

  const [interpolated, setInterpolated] = useState<InterpolatedPosition | null>(null);

  // Animation state refs (avoid re-renders during animation loop)
  const rafRef = useRef<number | null>(null);
  const isRunningRef = useRef(false);

  // Position tracking refs
  const prevFixRef = useRef<{ lat: number; lng: number; heading: number; time: number } | null>(null);
  const currFixRef = useRef<{ lat: number; lng: number; heading: number; time: number } | null>(null);
  const lastFixTimeRef = useRef<number>(0);

  // Smoothed values (adaptive EMA)
  const smoothedSpeedRef = useRef<number>(0);
  const smoothedHeadingRef = useRef<number>(0);

  // Animation loop - runs continuously at 60fps when active
  const animationLoop = useCallback(() => {
    if (!isRunningRef.current) {
      rafRef.current = null;
      return;
    }

    const now = performance.now();
    const prev = prevFixRef.current;
    const curr = currFixRef.current;

    if (!curr) {
      rafRef.current = requestAnimationFrame(animationLoop);
      return;
    }

    const timeSinceLastFix = now - lastFixTimeRef.current;
    
    // Determine if we're interpolating or dead-reckoning
    let renderLat: number;
    let renderLng: number;
    let renderHeading: number;
    let interpolationProgress: number;
    let isDeadReckoning = false;

    if (prev && timeSinceLastFix < MAX_INTERPOLATION_TIME_MS) {
      // INTERPOLATION MODE: Smoothly animate between previous and current fix
      const fixDuration = curr.time - prev.time;
      const rawProgress = fixDuration > 0 ? timeSinceLastFix / fixDuration : 1;
      interpolationProgress = Math.min(rawProgress, 1);
      
      const easedProgress = easeOutCubic(interpolationProgress);

      renderLat = lerp(prev.lat, curr.lat, easedProgress);
      renderLng = lerp(prev.lng, curr.lng, easedProgress);
      renderHeading = lerpAngle(prev.heading, curr.heading, easedProgress);

      // If interpolation is complete, continue with dead reckoning
      if (interpolationProgress >= 1 && smoothedSpeedRef.current >= MIN_SPEED_FOR_DR_MPS) {
        const drTime = timeSinceLastFix - fixDuration;
        if (drTime > 0 && drTime < DEAD_RECKONING_MAX_MS) {
          const projected = projectPosition(
            curr.lat,
            curr.lng,
            smoothedSpeedRef.current,
            smoothedHeadingRef.current,
            drTime
          );
          renderLat = projected.lat;
          renderLng = projected.lng;
          isDeadReckoning = true;
        }
      }
    } else if (curr) {
      // DEAD RECKONING MODE: No previous fix, project forward
      interpolationProgress = 1;
      
      if (smoothedSpeedRef.current >= MIN_SPEED_FOR_DR_MPS && timeSinceLastFix < DEAD_RECKONING_MAX_MS) {
        const projected = projectPosition(
          curr.lat,
          curr.lng,
          smoothedSpeedRef.current,
          smoothedHeadingRef.current,
          timeSinceLastFix
        );
        renderLat = projected.lat;
        renderLng = projected.lng;
        isDeadReckoning = true;
      } else {
        renderLat = curr.lat;
        renderLng = curr.lng;
      }
      renderHeading = curr.heading;
    } else {
      rafRef.current = requestAnimationFrame(animationLoop);
      return;
    }

    // Update interpolated state (triggers re-render)
    setInterpolated({
      lat: curr.lat,
      lng: curr.lng,
      heading: curr.heading,
      speed: smoothedSpeedRef.current,
      accuracy: null,
      renderLat,
      renderLng,
      renderHeading,
      interpolationProgress,
      isDeadReckoning,
      timeSinceLastFix,
    });

    rafRef.current = requestAnimationFrame(animationLoop);
  }, []);

  // Start/stop animation loop
  const startAnimation = useCallback(() => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    rafRef.current = requestAnimationFrame(animationLoop);
  }, [animationLoop]);

  const stopAnimation = useCallback(() => {
    isRunningRef.current = false;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // Process new filtered position
  useEffect(() => {
    if (!enabled || !filteredPosition) {
      stopAnimation();
      setInterpolated(null);
      prevFixRef.current = null;
      currFixRef.current = null;
      return;
    }

    const now = performance.now();
    const { lat, lng, heading, speed, accuracy } = filteredPosition;

    // Calculate adaptive smoothing based on speed
    const speedMps = speed ?? 0;
    let speedAlpha = adaptiveAlpha
      ? Math.min(0.5, 0.1 + speedMps * 0.02) // Faster = more responsive
      : 0.25;

    // Smooth speed (EMA)
    smoothedSpeedRef.current = lerp(smoothedSpeedRef.current, speedMps, speedAlpha);

    // Smooth heading (only update if we have valid heading and are moving)
    if (heading !== null && speedMps > 0.5) {
      const headingAlpha = speedMps > 5 ? 0.4 : 0.15; // Faster = more responsive heading
      smoothedHeadingRef.current = lerpAngle(smoothedHeadingRef.current, heading, headingAlpha);
    } else if (currFixRef.current) {
      // Keep last heading when stationary
      smoothedHeadingRef.current = currFixRef.current.heading;
    }

    // Validate position (reject spikes)
    if (currFixRef.current) {
      const timeDelta = (now - lastFixTimeRef.current) / 1000;
      if (timeDelta > 0.1 && timeDelta < 30) {
        const distance = haversineDistance(currFixRef.current.lat, currFixRef.current.lng, lat, lng);
        const impliedSpeed = distance / timeDelta;
        
        // Reject if implied speed > 200 km/h (~55 m/s)
        if (impliedSpeed > 55) {
          console.log('[INTERPOLATOR] Spike rejected:', { distance: Math.round(distance), speed: Math.round(impliedSpeed) });
          return;
        }
      }
    }

    // Store previous fix for interpolation
    if (currFixRef.current) {
      prevFixRef.current = { ...currFixRef.current };
    }

    // Update current fix
    currFixRef.current = {
      lat,
      lng,
      heading: heading ?? smoothedHeadingRef.current,
      time: now,
    };
    lastFixTimeRef.current = now;

    // Ensure animation is running
    startAnimation();
  }, [filteredPosition, enabled, adaptiveAlpha, startAnimation, stopAnimation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAnimation();
    };
  }, [stopAnimation]);

  return interpolated;
}
