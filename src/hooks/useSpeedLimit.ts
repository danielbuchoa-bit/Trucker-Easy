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
}

const speedLimitCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30000; // 30 seconds
const MIN_DISTANCE_FOR_REFETCH = 200; // 200 meters - refetch more frequently for accuracy
const FETCH_THROTTLE_MS = 5000; // 5 seconds between API calls

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + 
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getCacheKey(lat: number, lng: number): string {
  // Round to ~100m precision for cache key
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

export function useSpeedLimit({
  lat,
  lng,
  heading,
  enabled = true,
}: UseSpeedLimitProps): SpeedLimitResult {
  const [speedLimitMph, setSpeedLimitMph] = useState<number | null>(null);
  const [speedLimitKmh, setSpeedLimitKmh] = useState<number | null>(null);
  const [roadName, setRoadName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<'api' | 'estimated' | 'fallback' | null>(null);
  
  const lastFetchRef = useRef<{ lat: number; lng: number; time: number } | null>(null);

  const fetchSpeedLimit = useCallback(async (userLat: number, userLng: number, userHeading?: number | null) => {
    // Check cache first
    const cacheKey = getCacheKey(userLat, userLng);
    const cached = speedLimitCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      console.log('[SPEED_LIMIT_HOOK] Using cached data:', cached.speedLimitMph, 'mph');
      setSpeedLimitMph(cached.speedLimitMph);
      setSpeedLimitKmh(Math.round(cached.speedLimitMph * 1.60934));
      setRoadName(cached.roadName);
      setSource(cached.source as any);
      return;
    }

    // Check throttle - don't fetch too frequently
    if (lastFetchRef.current) {
      const timeSinceLastFetch = Date.now() - lastFetchRef.current.time;
      const distanceMoved = haversineDistance(
        userLat, userLng,
        lastFetchRef.current.lat, lastFetchRef.current.lng
      );
      
      if (timeSinceLastFetch < FETCH_THROTTLE_MS && distanceMoved < MIN_DISTANCE_FOR_REFETCH) {
        console.log('[SPEED_LIMIT_HOOK] Throttled');
        return;
      }
    }

    setLoading(true);

    try {
      console.log('[SPEED_LIMIT_HOOK] Fetching speed limit...');
      
      const { data, error } = await supabase.functions.invoke('here_speed_limit', {
        body: {
          lat: userLat,
          lng: userLng,
          heading: userHeading ?? undefined,
        },
      });

      if (error) {
        console.error('[SPEED_LIMIT_HOOK] API error:', error);
        return;
      }

      if (data) {
        console.log('[SPEED_LIMIT_HOOK] Got speed limit:', data.speedLimitMph, 'mph', data.source);
        
        setSpeedLimitMph(data.speedLimitMph);
        setSpeedLimitKmh(data.speedLimitKmh);
        setRoadName(data.roadName);
        setSource(data.source === 'fallback' ? 'fallback' : data.source === 'estimated' ? 'estimated' : 'api');
        
        // Cache the result
        speedLimitCache.set(cacheKey, {
          speedLimitMph: data.speedLimitMph,
          roadName: data.roadName,
          source: data.source,
          timestamp: Date.now(),
        });
        
        lastFetchRef.current = { lat: userLat, lng: userLng, time: Date.now() };
      }
    } catch (err) {
      console.error('[SPEED_LIMIT_HOOK] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled || lat === null || lng === null) {
      return;
    }

    fetchSpeedLimit(lat, lng, heading);
  }, [lat, lng, heading, enabled, fetchSpeedLimit]);

  return {
    speedLimitMph,
    speedLimitKmh,
    roadName,
    loading,
    source,
  };
}
