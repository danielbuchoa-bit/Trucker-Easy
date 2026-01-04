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
  predictedLat: number; // Dead reckoning prediction
  predictedLng: number;
}

// Constants for dead reckoning
const PREDICTION_INTERVAL_MS = 16; // ~60fps
const MAX_PREDICTION_TIME_MS = 2000; // Don't predict beyond 2 seconds

/**
 * Hook that provides smoothed GPS position to eliminate stuttering
 * Uses low-pass filter + requestAnimationFrame interpolation + dead reckoning
 */
export function useSmoothPosition(
  rawPosition: UserPosition | null,
  config: SmoothPositionConfig = {}
) {
  const {
    alpha = 0.3, // Smoothing factor (higher = more responsive, lower = smoother)
    minDistanceThreshold = 1, // meters (reduced for more responsive updates)
    maxAge = 3000, // ms
  } = config;

  // Smoothed position state (for components that need reactive updates)
  const [smoothedPosition, setSmoothedPosition] = useState<SmoothedPosition | null>(null);
  
  // Internal refs for animation
  const prevSmoothedRef = useRef<{ lat: number; lng: number; heading: number | null } | null>(null);
  const targetPositionRef = useRef<{ lat: number; lng: number; heading: number | null } | null>(null);
  const lastRawTimeRef = useRef<number>(0);
  const lastRawPositionRef = useRef<UserPosition | null>(null);
  const rafRef = useRef<number | null>(null);
  const interpolationStartTimeRef = useRef<number>(0);
  const interpolationDurationRef = useRef<number>(300); // ms to interpolate
  
  // Speed smoothing with EMA
  const smoothedSpeedRef = useRef<number>(0);
  const smoothedHeadingRef = useRef<number | null>(null);

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
    return a + (b - a) * Math.min(1, Math.max(0, t));
  }, []);

  // Interpolate bearing (handles 360° wraparound)
  const lerpBearing = useCallback((a: number | null, b: number | null, t: number): number | null => {
    if (a === null || b === null) return b;
    
    let diff = b - a;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    
    return ((a + diff * Math.min(1, Math.max(0, t))) + 360) % 360;
  }, []);

  // Dead reckoning: predict position based on speed and heading
  const predictPosition = useCallback((
    baseLat: number,
    baseLng: number,
    speed: number, // m/s
    heading: number | null,
    deltaTimeMs: number
  ): { lat: number; lng: number } => {
    if (speed < 0.5 || heading === null || deltaTimeMs <= 0 || deltaTimeMs > MAX_PREDICTION_TIME_MS) {
      return { lat: baseLat, lng: baseLng };
    }

    const distanceMeters = speed * (deltaTimeMs / 1000);
    const headingRad = (heading * Math.PI) / 180;
    
    // Convert meters to degrees (approximate)
    const latOffset = (distanceMeters * Math.cos(headingRad)) / 111000;
    const lngOffset = (distanceMeters * Math.sin(headingRad)) / (111000 * Math.cos(baseLat * Math.PI / 180));

    return {
      lat: baseLat + latOffset,
      lng: baseLng + lngOffset,
    };
  }, []);

  // Smooth speed using EMA
  const smoothSpeed = useCallback((newSpeed: number | null): number => {
    if (newSpeed === null || newSpeed < 0) {
      // Decay speed when no reading
      smoothedSpeedRef.current = smoothedSpeedRef.current * 0.9;
      return smoothedSpeedRef.current;
    }
    
    // EMA smoothing
    const emaAlpha = 0.3;
    smoothedSpeedRef.current = emaAlpha * newSpeed + (1 - emaAlpha) * smoothedSpeedRef.current;
    return smoothedSpeedRef.current;
  }, []);

  // Smooth heading using EMA with wraparound handling
  const smoothHeading = useCallback((newHeading: number | null): number | null => {
    if (newHeading === null) {
      return smoothedHeadingRef.current;
    }
    
    if (smoothedHeadingRef.current === null) {
      smoothedHeadingRef.current = newHeading;
      return newHeading;
    }

    const emaAlpha = 0.25;
    const result = lerpBearing(smoothedHeadingRef.current, newHeading, emaAlpha);
    smoothedHeadingRef.current = result;
    return result;
  }, [lerpBearing]);

  // Animation loop for smooth interpolation (only runs when needed)
  const animate = useCallback(() => {
    const prev = prevSmoothedRef.current;
    const target = targetPositionRef.current;
    const lastRaw = lastRawPositionRef.current;
    
    if (!prev || !target || !lastRaw) {
      rafRef.current = null;
      return;
    }

    const now = performance.now();
    const timeSinceStart = now - interpolationStartTimeRef.current;
    const duration = interpolationDurationRef.current;
    const timeSinceLastGps = now - lastRawTimeRef.current;
    
    // Calculate interpolation progress (0 to 1)
    const t = Math.min(1, timeSinceStart / duration);
    
    // Ease-out function for smoother motion
    const easeOut = 1 - Math.pow(1 - t, 3);

    // Interpolate position
    const interpLat = lerp(prev.lat, target.lat, easeOut);
    const interpLng = lerp(prev.lng, target.lng, easeOut);
    const interpHeading = lerpBearing(prev.heading, target.heading, easeOut);

    // Dead reckoning: predict ahead based on current speed and heading
    const currentSpeed = smoothedSpeedRef.current;
    const currentHeading = smoothedHeadingRef.current;
    
    // Only apply dead reckoning if we have valid data and interpolation is complete
    const predictTime = t >= 1 ? Math.min(timeSinceLastGps - duration, 500) : 0;
    const predicted = predictPosition(
      t >= 1 ? target.lat : interpLat,
      t >= 1 ? target.lng : interpLng,
      currentSpeed,
      currentHeading,
      predictTime > 0 ? predictTime : 0
    );

    setSmoothedPosition({
      ...lastRaw,
      lat: target.lat,
      lng: target.lng,
      heading: target.heading,
      interpolatedLat: interpLat,
      interpolatedLng: interpLng,
      smoothedSpeed: currentSpeed,
      smoothedHeading: interpHeading,
      predictedLat: predicted.lat,
      predictedLng: predicted.lng,
    });

    // Continue animation while interpolating OR if we need dead reckoning (up to 2 seconds)
    if (t < 1 || (currentSpeed > 0.5 && timeSinceLastGps < 2000)) {
      rafRef.current = requestAnimationFrame(animate);
    } else {
      rafRef.current = null;
    }
  }, [lerp, lerpBearing, predictPosition]);

  // Process new raw position
  useEffect(() => {
    if (!rawPosition) {
      setSmoothedPosition(null);
      prevSmoothedRef.current = null;
      targetPositionRef.current = null;
      lastRawPositionRef.current = null;
      return;
    }

    const now = performance.now();
    const timeSinceLastRaw = now - lastRawTimeRef.current;
    
    // Store raw position for reference
    lastRawPositionRef.current = rawPosition;

    // Update smoothed speed and heading
    const currentSpeed = smoothSpeed(rawPosition.speed);
    const currentHeading = smoothHeading(rawPosition.heading);

    // If too much time passed or first update, reset smoothing
    if (timeSinceLastRaw > maxAge || !prevSmoothedRef.current) {
      prevSmoothedRef.current = { lat: rawPosition.lat, lng: rawPosition.lng, heading: rawPosition.heading };
      targetPositionRef.current = { lat: rawPosition.lat, lng: rawPosition.lng, heading: rawPosition.heading };
      lastRawTimeRef.current = now;
      
      setSmoothedPosition({
        ...rawPosition,
        interpolatedLat: rawPosition.lat,
        interpolatedLng: rawPosition.lng,
        smoothedSpeed: currentSpeed,
        smoothedHeading: currentHeading,
        predictedLat: rawPosition.lat,
        predictedLng: rawPosition.lng,
      });
      
      // Start animation loop if not running
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(animate);
      }
      return;
    }

    const prev = targetPositionRef.current || prevSmoothedRef.current;
    const distance = haversineDistance(prev.lat, prev.lng, rawPosition.lat, rawPosition.lng);

    // Always update target, apply stronger smoothing for small movements
    const effectiveAlpha = distance < minDistanceThreshold ? alpha * 0.5 : alpha;
    
    // Store current target as previous
    if (targetPositionRef.current) {
      prevSmoothedRef.current = { ...targetPositionRef.current };
    }

    // Apply low-pass filter to new target
    const filteredLat = lerp(prev.lat, rawPosition.lat, effectiveAlpha);
    const filteredLng = lerp(prev.lng, rawPosition.lng, effectiveAlpha);
    const filteredHeading = lerpBearing(prev.heading, rawPosition.heading, effectiveAlpha);

    targetPositionRef.current = {
      lat: filteredLat,
      lng: filteredLng,
      heading: filteredHeading,
    };

    // Set interpolation duration based on expected update rate (~1 second between GPS updates)
    interpolationDurationRef.current = Math.min(timeSinceLastRaw * 0.8, 1000);
    interpolationStartTimeRef.current = now;
    lastRawTimeRef.current = now;

    // Start animation if not running
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(animate);
    }
  }, [rawPosition, alpha, minDistanceThreshold, maxAge, haversineDistance, lerp, lerpBearing, smoothSpeed, smoothHeading, animate]);

  // Cleanup only
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  return smoothedPosition;
}
