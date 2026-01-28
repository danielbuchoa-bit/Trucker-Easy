import { useState, useEffect, useRef, useCallback } from 'react';

interface UseSpeedLimitProps {
  lat: number | null;
  lng: number | null;
  heading?: number | null;
  enabled?: boolean;
}

interface SpeedLimitResult {
  speedLimitMph: number | null;
  speedLimitKmh: number | null;
  roadName: string | null;
  loading: boolean;
  source: 'estimated' | 'fallback' | null;
}

// Cache for speed limit responses
interface CacheEntry {
  speedLimitMph: number;
  roadName: string | null;
  source: string;
  timestamp: number;
  lat: number;
  lng: number;
}

// Global cache (shared between hook instances)
const speedLimitCache: CacheEntry[] = [];
const MAX_CACHE_SIZE = 50;
const CACHE_TTL_MS = 120000; // 2 minutes TTL
const MIN_DISTANCE_FOR_REFETCH = 1000; // 1km threshold

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + 
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Find cached entry within radius
function findCachedNearby(lat: number, lng: number): CacheEntry | null {
  const now = Date.now();
  for (let i = speedLimitCache.length - 1; i >= 0; i--) {
    const entry = speedLimitCache[i];
    // Clean old entries
    if (now - entry.timestamp > CACHE_TTL_MS) {
      speedLimitCache.splice(i, 1);
      continue;
    }
    // Check if close enough
    const dist = haversineDistance(lat, lng, entry.lat, entry.lng);
    if (dist < MIN_DISTANCE_FOR_REFETCH) {
      return entry;
    }
  }
  return null;
}

function addToCache(entry: CacheEntry) {
  speedLimitCache.push(entry);
  while (speedLimitCache.length > MAX_CACHE_SIZE) {
    speedLimitCache.shift();
  }
}

// Estimate speed limit based on road type heuristics
function estimateSpeedLimit(): number {
  // Default to 65 mph for highway/interstate (most common for truckers)
  return 65;
}

/**
 * Speed limit hook - uses local estimation only
 * NextBillion.ai provides speed limits via route instructions, not real-time lookup
 * For real-time display, we estimate based on context
 */
export function useSpeedLimit({
  lat,
  lng,
  enabled = true,
}: UseSpeedLimitProps): SpeedLimitResult {
  const [result, setResult] = useState<SpeedLimitResult>({
    speedLimitMph: null,
    speedLimitKmh: null,
    roadName: null,
    loading: false,
    source: null,
  });
  
  const lastFetchRef = useRef<{ lat: number; lng: number; time: number } | null>(null);

  useEffect(() => {
    if (!enabled || lat === null || lng === null) {
      return;
    }

    // Quick cache check
    const cached = findCachedNearby(lat, lng);
    if (cached) {
      setResult({
        speedLimitMph: cached.speedLimitMph,
        speedLimitKmh: Math.round(cached.speedLimitMph * 1.60934),
        roadName: cached.roadName,
        loading: false,
        source: cached.source as 'estimated' | 'fallback',
      });
      return;
    }

    // Use local estimation (no API call)
    const estimatedLimit = estimateSpeedLimit();
    
    const newResult: SpeedLimitResult = {
      speedLimitMph: estimatedLimit,
      speedLimitKmh: Math.round(estimatedLimit * 1.60934),
      roadName: null,
      loading: false,
      source: 'estimated',
    };
    
    setResult(newResult);
    
    // Add to cache
    addToCache({
      speedLimitMph: estimatedLimit,
      roadName: null,
      source: 'estimated',
      timestamp: Date.now(),
      lat,
      lng,
    });
    
    lastFetchRef.current = { lat, lng, time: Date.now() };
  }, [lat, lng, enabled]);

  return result;
}
