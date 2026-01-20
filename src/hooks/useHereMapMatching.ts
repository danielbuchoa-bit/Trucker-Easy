/**
 * HERE Map Matching Hook
 * 
 * Provides server-side snap-to-road using HERE Route Matching API.
 * Designed for complex junctions, bifurcations, and parallel roads.
 */

import { useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TracePoint {
  lat: number;
  lng: number;
  timestamp?: number;
  heading?: number;
  speed?: number;
}

interface MatchedPoint {
  lat: number;
  lng: number;
  originalLat: number;
  originalLng: number;
  confidence: number;
  linkId?: string;
  roadName?: string;
  bearing?: number;
  distanceFromOriginal: number;
  functionalClass?: number;
  speedLimitKmh?: number;
}

interface MapMatchResult {
  success: boolean;
  matchedPoints: MatchedPoint[];
  warnings?: string[];
  error?: string;
}

interface MapMatchingConfig {
  minBatchSize: number;
  maxBatchSize: number;
  batchIntervalMs: number;
  maxDistanceToAcceptM: number;
  minConfidenceThreshold: number;
  enabled: boolean;
}

const DEFAULT_CONFIG: MapMatchingConfig = {
  minBatchSize: 3,        // Minimum points before sending batch
  maxBatchSize: 15,       // Maximum points per batch
  batchIntervalMs: 2000,  // Maximum time between batches
  maxDistanceToAcceptM: 50, // Max snap distance to accept result
  minConfidenceThreshold: 0.3, // Minimum confidence to use matched position
  enabled: true,
};

export function useHereMapMatching(config: Partial<MapMatchingConfig> = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  // Buffer for accumulating trace points
  const traceBufferRef = useRef<TracePoint[]>([]);
  
  // Last batch timestamp
  const lastBatchTimeRef = useRef<number>(0);
  
  // Cache of recent matched results
  const matchCacheRef = useRef<Map<string, MatchedPoint>>(new Map());
  
  // Pending request flag
  const pendingRequestRef = useRef<boolean>(false);
  
  // Rate limit tracking
  const rateLimitRef = useRef<{ count: number; resetTime: number }>({ count: 0, resetTime: 0 });

  /**
   * Generate cache key for a point
   */
  const getCacheKey = useCallback((lat: number, lng: number): string => {
    // Round to ~11m precision for caching
    return `${lat.toFixed(4)},${lng.toFixed(4)}`;
  }, []);

  /**
   * Check cache for nearby matched point
   */
  const checkCache = useCallback((lat: number, lng: number): MatchedPoint | null => {
    const key = getCacheKey(lat, lng);
    return matchCacheRef.current.get(key) || null;
  }, [getCacheKey]);

  /**
   * Add points to cache
   */
  const addToCache = useCallback((points: MatchedPoint[]) => {
    points.forEach(point => {
      if (point.confidence > cfg.minConfidenceThreshold) {
        const key = getCacheKey(point.originalLat, point.originalLng);
        matchCacheRef.current.set(key, point);
      }
    });
    
    // Limit cache size (keep last 1000 entries)
    if (matchCacheRef.current.size > 1000) {
      const entries = Array.from(matchCacheRef.current.entries());
      matchCacheRef.current = new Map(entries.slice(-500));
    }
  }, [cfg.minConfidenceThreshold, getCacheKey]);

  /**
   * Send batch to HERE Map Matching API
   */
  const sendBatch = useCallback(async (trace: TracePoint[]): Promise<MapMatchResult> => {
    if (trace.length < 2) {
      return { success: false, matchedPoints: [], error: 'Need at least 2 points' };
    }

    // Rate limit check (max 10 requests per minute)
    const now = Date.now();
    if (now < rateLimitRef.current.resetTime) {
      if (rateLimitRef.current.count >= 10) {
        console.log('[HERE_MATCH] Rate limited, skipping batch');
        return { success: false, matchedPoints: [], error: 'Rate limited' };
      }
    } else {
      rateLimitRef.current = { count: 0, resetTime: now + 60000 };
    }

    try {
      pendingRequestRef.current = true;
      rateLimitRef.current.count++;

      console.log('[HERE_MATCH] Sending batch of', trace.length, 'points');

      const { data, error } = await supabase.functions.invoke('here_map_matching', {
        body: { trace, routeMode: 'truck' },
      });

      if (error) {
        console.error('[HERE_MATCH] Supabase error:', error);
        return { success: false, matchedPoints: [], error: error.message };
      }

      const result = data as MapMatchResult;
      
      if (result.success && result.matchedPoints.length > 0) {
        // Filter by confidence and distance
        const validPoints = result.matchedPoints.filter(
          p => p.confidence >= cfg.minConfidenceThreshold && 
               p.distanceFromOriginal <= cfg.maxDistanceToAcceptM
        );
        
        addToCache(validPoints);
        console.log('[HERE_MATCH] Got', validPoints.length, 'valid matched points');
        
        return { ...result, matchedPoints: validPoints };
      }

      return result;
    } catch (err) {
      console.error('[HERE_MATCH] Error:', err);
      return { success: false, matchedPoints: [], error: String(err) };
    } finally {
      pendingRequestRef.current = false;
    }
  }, [cfg.maxDistanceToAcceptM, cfg.minConfidenceThreshold, addToCache]);

  /**
   * Add a point to the trace buffer and potentially trigger batch
   */
  const addPoint = useCallback((point: TracePoint): MatchedPoint | null => {
    if (!cfg.enabled) return null;

    // Check cache first
    const cached = checkCache(point.lat, point.lng);
    if (cached) {
      return cached;
    }

    // Add to buffer
    traceBufferRef.current.push(point);
    const now = Date.now();

    // Check if we should send batch
    const shouldBatch = 
      traceBufferRef.current.length >= cfg.maxBatchSize ||
      (traceBufferRef.current.length >= cfg.minBatchSize && 
       now - lastBatchTimeRef.current >= cfg.batchIntervalMs);

    if (shouldBatch && !pendingRequestRef.current) {
      const trace = [...traceBufferRef.current];
      traceBufferRef.current = [];
      lastBatchTimeRef.current = now;
      
      // Fire and forget - results will be cached for next queries
      sendBatch(trace).catch(console.error);
    }

    return null; // No immediate result, will be cached for future
  }, [cfg.enabled, cfg.maxBatchSize, cfg.minBatchSize, cfg.batchIntervalMs, checkCache, sendBatch]);

  /**
   * Match a single point immediately (blocking)
   */
  const matchSinglePoint = useCallback(async (
    lat: number, 
    lng: number, 
    heading?: number
  ): Promise<MatchedPoint | null> => {
    if (!cfg.enabled) return null;

    // Check cache
    const cached = checkCache(lat, lng);
    if (cached) return cached;

    // Need at least 2 points for HERE API
    // Create a synthetic second point slightly ahead
    const headingRad = ((heading ?? 0) * Math.PI) / 180;
    const offsetM = 50; // 50m ahead
    const R = 6371000;
    
    const lat2 = lat + (offsetM / R) * Math.cos(headingRad) * (180 / Math.PI);
    const lng2 = lng + (offsetM / R) * Math.sin(headingRad) * (180 / Math.PI) / Math.cos(lat * Math.PI / 180);

    const trace: TracePoint[] = [
      { lat, lng, heading },
      { lat: lat2, lng: lng2, heading }
    ];

    const result = await sendBatch(trace);
    
    if (result.success && result.matchedPoints.length > 0) {
      return result.matchedPoints[0];
    }

    return null;
  }, [cfg.enabled, checkCache, sendBatch]);

  /**
   * Get best available position (cached or original)
   */
  const getMatchedPosition = useCallback((
    lat: number, 
    lng: number
  ): { lat: number; lng: number; confidence: number; fromCache: boolean } => {
    const cached = checkCache(lat, lng);
    
    if (cached && cached.confidence >= cfg.minConfidenceThreshold) {
      return {
        lat: cached.lat,
        lng: cached.lng,
        confidence: cached.confidence,
        fromCache: true,
      };
    }

    return {
      lat,
      lng,
      confidence: 0,
      fromCache: false,
    };
  }, [cfg.minConfidenceThreshold, checkCache]);

  /**
   * Reset all state
   */
  const reset = useCallback(() => {
    traceBufferRef.current = [];
    lastBatchTimeRef.current = 0;
    matchCacheRef.current.clear();
    pendingRequestRef.current = false;
  }, []);

  /**
   * Get current buffer size
   */
  const getBufferSize = useCallback(() => traceBufferRef.current.length, []);

  /**
   * Get cache stats
   */
  const getCacheStats = useCallback(() => ({
    size: matchCacheRef.current.size,
    pending: pendingRequestRef.current,
    bufferSize: traceBufferRef.current.length,
  }), []);

  return {
    addPoint,
    matchSinglePoint,
    getMatchedPosition,
    reset,
    getBufferSize,
    getCacheStats,
    enabled: cfg.enabled,
  };
}
