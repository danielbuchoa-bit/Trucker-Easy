import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
  source: 'api' | 'estimated' | 'fallback' | null;
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
const CACHE_TTL_MS = 60000; // 60 seconds - longer TTL to reduce API calls
const MIN_DISTANCE_FOR_REFETCH = 500; // 500 meters - much higher threshold
const FETCH_THROTTLE_MS = 10000; // 10 seconds between API calls

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
  // Add to cache
  speedLimitCache.push(entry);
  // Limit cache size
  while (speedLimitCache.length > MAX_CACHE_SIZE) {
    speedLimitCache.shift();
  }
}

export function useSpeedLimit({
  lat,
  lng,
  heading,
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
  const pendingRef = useRef(false);

  const fetchSpeedLimit = useCallback(async (userLat: number, userLng: number, userHeading?: number | null) => {
    // Check proximity cache first
    const cached = findCachedNearby(userLat, userLng);
    
    if (cached) {
      setResult({
        speedLimitMph: cached.speedLimitMph,
        speedLimitKmh: Math.round(cached.speedLimitMph * 1.60934),
        roadName: cached.roadName,
        loading: false,
        source: cached.source as 'api' | 'estimated' | 'fallback',
      });
      return;
    }

    // Check throttle - don't fetch too frequently
    if (lastFetchRef.current) {
      const timeSinceLastFetch = Date.now() - lastFetchRef.current.time;
      const distanceMoved = haversineDistance(
        userLat, userLng,
        lastFetchRef.current.lat, lastFetchRef.current.lng
      );
      
      // Strong throttle: only refetch if moved significantly AND enough time passed
      if (timeSinceLastFetch < FETCH_THROTTLE_MS || distanceMoved < MIN_DISTANCE_FOR_REFETCH) {
        return;
      }
    }

    // Prevent concurrent fetches
    if (pendingRef.current) return;
    pendingRef.current = true;

    setResult(prev => ({ ...prev, loading: true }));

    try {
      const { data, error } = await supabase.functions.invoke('here_speed_limit', {
        body: {
          lat: userLat,
          lng: userLng,
          heading: userHeading ?? undefined,
        },
      });

      if (error) {
        console.error('[SPEED_LIMIT] API error:', error);
        return;
      }

      if (data) {
        const newResult: SpeedLimitResult = {
          speedLimitMph: data.speedLimitMph,
          speedLimitKmh: data.speedLimitKmh,
          roadName: data.roadName,
          loading: false,
          source: data.source === 'fallback' ? 'fallback' : data.source === 'estimated' ? 'estimated' : 'api',
        };
        
        setResult(newResult);
        
        // Add to cache
        addToCache({
          speedLimitMph: data.speedLimitMph,
          roadName: data.roadName,
          source: data.source,
          timestamp: Date.now(),
          lat: userLat,
          lng: userLng,
        });
        
        lastFetchRef.current = { lat: userLat, lng: userLng, time: Date.now() };
      }
    } catch (err) {
      console.error('[SPEED_LIMIT] Fetch error:', err);
    } finally {
      pendingRef.current = false;
      setResult(prev => ({ ...prev, loading: false }));
    }
  }, []);

  // Debounced effect - only trigger when position changes significantly
  useEffect(() => {
    if (!enabled || lat === null || lng === null) {
      return;
    }

    // Quick cache check before any fetch
    const cached = findCachedNearby(lat, lng);
    if (cached) {
      setResult({
        speedLimitMph: cached.speedLimitMph,
        speedLimitKmh: Math.round(cached.speedLimitMph * 1.60934),
        roadName: cached.roadName,
        loading: false,
        source: cached.source as 'api' | 'estimated' | 'fallback',
      });
      return;
    }

    // Debounce the API call
    const timeoutId = setTimeout(() => {
      fetchSpeedLimit(lat, lng, heading);
    }, 1000); // 1 second debounce

    return () => clearTimeout(timeoutId);
  }, [lat, lng, heading, enabled, fetchSpeedLimit]);

  return result;
}
