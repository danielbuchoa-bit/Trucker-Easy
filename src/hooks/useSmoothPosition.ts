import { useRef, useCallback, useEffect, useState } from 'react';
import type { UserPosition } from '@/contexts/ActiveNavigationContext';

interface SmoothPositionConfig {
  alpha?: number; // Low-pass filter strength (0-1, higher = more responsive)
  minDistanceThreshold?: number; // Minimum meters to consider movement
  maxAge?: number; // Maximum age of position before reset (ms)
}

interface SmoothedPosition extends UserPosition {
  interpolatedLat: number;
  interpolatedLng: number;
  smoothedSpeed: number;
  smoothedHeading: number | null;
}

/**
 * Hook that provides smoothed GPS position to eliminate stuttering
 * Uses low-pass filter + requestAnimationFrame interpolation
 */
export function useSmoothPosition(
  rawPosition: UserPosition | null,
  config: SmoothPositionConfig = {}
) {
  const {
    alpha = 0.2, // Smoothing factor (higher = more responsive, lower = smoother)
    minDistanceThreshold = 2, // meters
    maxAge = 5000, // ms
  } = config;

  // Smoothed position state (for components that need reactive updates)
  const [smoothedPosition, setSmoothedPosition] = useState<SmoothedPosition | null>(null);
  
  // Internal refs for animation
  const prevSmoothedRef = useRef<{ lat: number; lng: number; heading: number | null } | null>(null);
  const targetPositionRef = useRef<{ lat: number; lng: number; heading: number | null } | null>(null);
  const lastRawTimeRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const interpolationProgressRef = useRef<number>(1); // 0 = at prev, 1 = at target
  
  // Speed smoothing
  const speedHistoryRef = useRef<number[]>([]);
  const MAX_SPEED_SAMPLES = 5;

  // Calculate distance between two points in meters
  const haversineDistance = useCallback((lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  // Linear interpolation
  const lerp = useCallback((a: number, b: number, t: number) => {
    return a + (b - a) * t;
  }, []);

  // Interpolate bearing (handles 360° wraparound)
  const lerpBearing = useCallback((a: number | null, b: number | null, t: number): number | null => {
    if (a === null || b === null) return b;
    
    let diff = b - a;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    
    return ((a + diff * t) + 360) % 360;
  }, []);

  // Smooth speed using moving average
  const smoothSpeed = useCallback((newSpeed: number | null): number => {
    if (newSpeed === null || newSpeed < 0) return 0;
    
    speedHistoryRef.current.push(newSpeed);
    if (speedHistoryRef.current.length > MAX_SPEED_SAMPLES) {
      speedHistoryRef.current.shift();
    }
    
    const sum = speedHistoryRef.current.reduce((a, b) => a + b, 0);
    return sum / speedHistoryRef.current.length;
  }, []);

  // Animation loop for smooth interpolation
  const animate = useCallback(() => {
    const prev = prevSmoothedRef.current;
    const target = targetPositionRef.current;
    
    if (!prev || !target || !rawPosition) {
      rafRef.current = null;
      return;
    }

    // Increment interpolation progress (complete in ~300ms at 60fps)
    interpolationProgressRef.current = Math.min(1, interpolationProgressRef.current + 0.08);
    const t = interpolationProgressRef.current;

    // Interpolate position
    const interpLat = lerp(prev.lat, target.lat, t);
    const interpLng = lerp(prev.lng, target.lng, t);
    const interpHeading = lerpBearing(prev.heading, target.heading, t);

    setSmoothedPosition({
      ...rawPosition,
      lat: target.lat,
      lng: target.lng,
      heading: target.heading,
      interpolatedLat: interpLat,
      interpolatedLng: interpLng,
      smoothedSpeed: smoothSpeed(rawPosition.speed),
      smoothedHeading: interpHeading,
    });

    // Continue animation if not complete
    if (t < 1) {
      rafRef.current = requestAnimationFrame(animate);
    } else {
      rafRef.current = null;
    }
  }, [rawPosition, lerp, lerpBearing, smoothSpeed]);

  // Process new raw position
  useEffect(() => {
    if (!rawPosition) {
      setSmoothedPosition(null);
      prevSmoothedRef.current = null;
      targetPositionRef.current = null;
      return;
    }

    const now = Date.now();
    const timeSinceLastRaw = now - lastRawTimeRef.current;
    lastRawTimeRef.current = now;

    // If too much time passed, reset smoothing
    if (timeSinceLastRaw > maxAge || !prevSmoothedRef.current) {
      prevSmoothedRef.current = { lat: rawPosition.lat, lng: rawPosition.lng, heading: rawPosition.heading };
      targetPositionRef.current = { lat: rawPosition.lat, lng: rawPosition.lng, heading: rawPosition.heading };
      interpolationProgressRef.current = 1;
      
      setSmoothedPosition({
        ...rawPosition,
        interpolatedLat: rawPosition.lat,
        interpolatedLng: rawPosition.lng,
        smoothedSpeed: smoothSpeed(rawPosition.speed),
        smoothedHeading: rawPosition.heading,
      });
      return;
    }

    const prev = prevSmoothedRef.current;
    const distance = haversineDistance(prev.lat, prev.lng, rawPosition.lat, rawPosition.lng);

    // Only update target if moved significantly
    if (distance >= minDistanceThreshold) {
      // Store current smoothed as previous
      if (targetPositionRef.current) {
        prevSmoothedRef.current = { ...targetPositionRef.current };
      }

      // Apply low-pass filter to new target
      const filteredLat = lerp(prev.lat, rawPosition.lat, alpha);
      const filteredLng = lerp(prev.lng, rawPosition.lng, alpha);
      const filteredHeading = lerpBearing(prev.heading, rawPosition.heading, alpha);

      targetPositionRef.current = {
        lat: filteredLat,
        lng: filteredLng,
        heading: filteredHeading,
      };

      // Reset interpolation progress
      interpolationProgressRef.current = 0;

      // Start animation if not running
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(animate);
      }
    }
  }, [rawPosition, alpha, minDistanceThreshold, maxAge, haversineDistance, lerp, lerpBearing, smoothSpeed, animate]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return smoothedPosition;
}
