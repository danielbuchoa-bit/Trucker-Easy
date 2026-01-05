import { useState, useEffect, useRef, useCallback } from 'react';

export interface DetectedPoi {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  distance: number;
  address?: string;
}

export interface ArrivalState {
  isArrived: boolean;
  poi: DetectedPoi | null;
  triggeredAt: number | null;
  cooldownUntil: number | null;
}

export interface ArrivalDebug {
  nearestPoi: string | null;
  distanceToPoi: number | null;
  speed: number;
  accuracy: number | null;
  arrivalTriggered: boolean;
  cooldownRemaining: number;
  dwellTime: number;
  reason: string;
}

interface UseArrivalDetectionProps {
  lat: number | null;
  lng: number | null;
  speed?: number | null;
  accuracy?: number | null;
  pois: DetectedPoi[];
  enabled?: boolean;
}

// Constants - INCREASED for truck stop detection
const ARRIVAL_RADIUS_M = 300; // 300 meters to trigger arrival (truck stops are large)
const SPEED_THRESHOLD_MPS = 3.5; // ~8 mph = 3.5 m/s (parking speed)
const DWELL_TIME_MS = 15000; // 15 seconds of slow/stopped
const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes cooldown per POI

const COOLDOWN_STORAGE_KEY = 'arrival_cooldowns';

// Get cooldowns from localStorage
function getCooldowns(): Record<string, number> {
  try {
    const stored = localStorage.getItem(COOLDOWN_STORAGE_KEY);
    if (stored) {
      const cooldowns = JSON.parse(stored);
      // Clean expired cooldowns
      const now = Date.now();
      const cleaned: Record<string, number> = {};
      for (const [id, until] of Object.entries(cooldowns)) {
        if ((until as number) > now) {
          cleaned[id] = until as number;
        }
      }
      return cleaned;
    }
  } catch (e) {
    console.error('Error reading cooldowns:', e);
  }
  return {};
}

// Save cooldown for a POI
function setCooldown(poiId: string): void {
  try {
    const cooldowns = getCooldowns();
    cooldowns[poiId] = Date.now() + COOLDOWN_MS;
    localStorage.setItem(COOLDOWN_STORAGE_KEY, JSON.stringify(cooldowns));
  } catch (e) {
    console.error('Error saving cooldown:', e);
  }
}

// Calculate distance using Haversine formula
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function useArrivalDetection({
  lat,
  lng,
  speed = null,
  accuracy = null,
  pois,
  enabled = true,
}: UseArrivalDetectionProps) {
  const [arrivalState, setArrivalState] = useState<ArrivalState>({
    isArrived: false,
    poi: null,
    triggeredAt: null,
    cooldownUntil: null,
  });

  const [debugInfo, setDebugInfo] = useState<ArrivalDebug>({
    nearestPoi: null,
    distanceToPoi: null,
    speed: 0,
    accuracy: null,
    arrivalTriggered: false,
    cooldownRemaining: 0,
    dwellTime: 0,
    reason: 'initializing',
  });

  // Track dwell time (time spent slow/stopped near POI)
  const dwellStartRef = useRef<number | null>(null);
  const currentPoiRef = useRef<string | null>(null);
  const lastCheckRef = useRef<number>(0);

  // Dismiss arrival (user action)
  const dismissArrival = useCallback((snooze: boolean = false) => {
    if (arrivalState.poi && snooze) {
      setCooldown(arrivalState.poi.id);
    }
    setArrivalState({
      isArrived: false,
      poi: null,
      triggeredAt: null,
      cooldownUntil: snooze ? Date.now() + COOLDOWN_MS : null,
    });
    dwellStartRef.current = null;
    currentPoiRef.current = null;
  }, [arrivalState.poi]);

  // Mark arrival as handled (for flow completion)
  const markHandled = useCallback(() => {
    if (arrivalState.poi) {
      setCooldown(arrivalState.poi.id);
    }
    setArrivalState(prev => ({
      ...prev,
      isArrived: false,
    }));
  }, [arrivalState.poi]);

  // Main detection logic
  useEffect(() => {
    if (!enabled || lat === null || lng === null) {
      setDebugInfo(prev => ({ ...prev, reason: 'disabled or no location' }));
      return;
    }

    const now = Date.now();
    
    // Throttle checks (every 2 seconds)
    if (now - lastCheckRef.current < 2000) return;
    lastCheckRef.current = now;

    const currentSpeed = speed ?? 0;
    const cooldowns = getCooldowns();

    // Find nearest truck-related POI
    let nearestPoi: DetectedPoi | null = null;
    let nearestDistance = Infinity;

    for (const poi of pois) {
      // Filter to truck stops and fuel stations
      if (!['truck_stop', 'fuel', 'rest_area'].includes(poi.category)) continue;
      
      const dist = haversineDistance(lat, lng, poi.lat, poi.lng);
      if (dist < nearestDistance) {
        nearestDistance = dist;
        nearestPoi = { ...poi, distance: dist };
      }
    }

    // Calculate cooldown remaining for nearest POI
    const cooldownUntil = nearestPoi ? cooldowns[nearestPoi.id] || 0 : 0;
    const cooldownRemaining = Math.max(0, cooldownUntil - now);
    const isOnCooldown = cooldownRemaining > 0;

    // Update debug info
    const debug: ArrivalDebug = {
      nearestPoi: nearestPoi?.name || null,
      distanceToPoi: nearestPoi ? Math.round(nearestDistance) : null,
      speed: currentSpeed,
      accuracy,
      arrivalTriggered: arrivalState.isArrived,
      cooldownRemaining: Math.round(cooldownRemaining / 1000),
      dwellTime: dwellStartRef.current ? Math.round((now - dwellStartRef.current) / 1000) : 0,
      reason: '',
    };

    // Check arrival conditions
    if (!nearestPoi || nearestDistance > ARRIVAL_RADIUS_M) {
      // Outside arrival zone
      debug.reason = nearestPoi 
        ? `too far: ${Math.round(nearestDistance)}m > ${ARRIVAL_RADIUS_M}m` 
        : 'no POIs nearby';
      dwellStartRef.current = null;
      currentPoiRef.current = null;
      setDebugInfo(debug);
      return;
    }

    if (isOnCooldown) {
      debug.reason = `cooldown: ${Math.round(cooldownRemaining / 60000)}min remaining`;
      setDebugInfo(debug);
      return;
    }

    if (currentSpeed > SPEED_THRESHOLD_MPS) {
      // Moving too fast - passing by
      debug.reason = `too fast: ${(currentSpeed * 2.237).toFixed(1)} mph`;
      dwellStartRef.current = null;
      currentPoiRef.current = null;
      setDebugInfo(debug);
      return;
    }

    // Inside zone, slow/stopped - track dwell time
    if (currentPoiRef.current !== nearestPoi.id) {
      // Entered new POI zone
      currentPoiRef.current = nearestPoi.id;
      dwellStartRef.current = now;
      debug.reason = 'entered zone, counting dwell time';
      setDebugInfo(debug);
      return;
    }

    // Check dwell time
    const dwellTime = dwellStartRef.current ? now - dwellStartRef.current : 0;
    debug.dwellTime = Math.round(dwellTime / 1000);

    if (dwellTime < DWELL_TIME_MS) {
      debug.reason = `waiting: ${Math.round(dwellTime / 1000)}s / ${DWELL_TIME_MS / 1000}s`;
      setDebugInfo(debug);
      return;
    }

    // All conditions met - trigger arrival!
    if (!arrivalState.isArrived) {
      debug.reason = 'ARRIVAL TRIGGERED!';
      debug.arrivalTriggered = true;
      setDebugInfo(debug);
      
      setArrivalState({
        isArrived: true,
        poi: nearestPoi,
        triggeredAt: now,
        cooldownUntil: null,
      });
    } else {
      debug.reason = 'already showing arrival prompt';
      setDebugInfo(debug);
    }
  }, [lat, lng, speed, accuracy, pois, enabled, arrivalState.isArrived]);

  return {
    arrivalState,
    debugInfo,
    dismissArrival,
    markHandled,
  };
}
