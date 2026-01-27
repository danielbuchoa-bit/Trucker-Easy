/**
 * POI Search Hook - P0-1 Fix
 * 
 * Implements:
 * - Debounced searches (800-1200ms)
 * - Cache-first with stale-while-revalidate
 * - Circuit breaker integration
 * - Retry with exponential backoff
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { poiCache } from '@/services/PoiCacheService';
import { apiDiagnostics } from '@/services/ApiDiagnosticsService';

export interface PoiSearchResult {
  pois: any[];
  provider: string;
  searchRadius: number;
  fromCache: boolean;
  debug?: any;
}

export interface UsePoiSearchOptions {
  debounceMs?: number;
  maxRetries?: number;
  defaultRadiusM?: number;
}

const DEFAULT_OPTIONS: UsePoiSearchOptions = {
  debounceMs: 1000,
  maxRetries: 3,
  defaultRadiusM: 48280, // 30 miles
};

export function usePoiSearch(options: UsePoiSearchOptions = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options };
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PoiSearchResult | null>(null);
  
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSearchRef = useRef<{ lat: number; lng: number; filter: string; time: number } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Cancel pending searches
   */
  const cancel = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  /**
   * Execute the actual API call with retries
   */
  const executeSearch = useCallback(async (
    lat: number,
    lng: number,
    filterType: string,
    radiusM: number,
    attempt: number = 0
  ): Promise<PoiSearchResult> => {
    // Check circuit breaker
    const canProceed = apiDiagnostics.canMakeRequest();
    if (!canProceed.allowed) {
      console.warn(`[usePoiSearch] Blocked by circuit breaker: ${canProceed.reason}`);
      throw new Error(`Rate limited. Please wait ${Math.ceil((canProceed.waitMs || 0) / 1000)} seconds.`);
    }

    const startTime = Date.now();
    
    try {
      const { data, error: apiError } = await supabase.functions.invoke('nb_browse_pois', {
        body: {
          lat,
          lng,
          radiusMeters: radiusM,
          filterType,
          progressiveRadius: true,
          limit: 30,
        },
      });

      const latencyMs = Date.now() - startTime;

      // Log the request
      apiDiagnostics.logRequest({
        endpoint: 'nb_browse_pois',
        timestamp: Date.now(),
        latencyMs,
        statusCode: apiError ? 500 : 200,
        payloadSize: JSON.stringify({ lat, lng, radiusMeters: radiusM, filterType }).length,
        responseSize: JSON.stringify(data || {}).length,
        success: !apiError,
        error: apiError?.message,
        provider: data?.provider || 'unknown',
        cached: false,
      });

      if (apiError) {
        // Check if rate limited
        if (apiError.message?.includes('429')) {
          // Retry with backoff
          if (attempt < config.maxRetries!) {
            const backoffMs = apiDiagnostics.getBackoffDelay(attempt);
            console.log(`[usePoiSearch] 429 error, retrying in ${backoffMs}ms (attempt ${attempt + 1}/${config.maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, backoffMs));
            return executeSearch(lat, lng, filterType, radiusM, attempt + 1);
          }
        }
        throw apiError;
      }

      const searchResult: PoiSearchResult = {
        pois: data?.pois || [],
        provider: data?.provider || 'unknown',
        searchRadius: data?.searchRadius || radiusM,
        fromCache: false,
        debug: data?.debug,
      };

      // Cache the result
      poiCache.set(lat, lng, filterType, radiusM, data);

      return searchResult;
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      
      apiDiagnostics.logRequest({
        endpoint: 'nb_browse_pois',
        timestamp: Date.now(),
        latencyMs,
        statusCode: err?.message?.includes('429') ? 429 : 500,
        payloadSize: 0,
        responseSize: 0,
        success: false,
        error: err?.message || 'Unknown error',
        provider: 'unknown',
        cached: false,
      });

      throw err;
    }
  }, [config.maxRetries]);

  /**
   * Search for POIs with debouncing and caching
   */
  const search = useCallback(async (
    lat: number,
    lng: number,
    filterType: string = 'nearMe',
    radiusM: number = config.defaultRadiusM!
  ): Promise<PoiSearchResult | null> => {
    // Cancel previous search
    cancel();

    return new Promise((resolve) => {
      debounceRef.current = setTimeout(async () => {
        setLoading(true);
        setError(null);

        try {
          // Check cache first
          const cached = poiCache.get(lat, lng, filterType, radiusM);
          
          if (cached && !cached.isStale) {
            // Fresh cache hit - return immediately
            const cacheResult: PoiSearchResult = {
              pois: cached.data?.pois || [],
              provider: cached.data?.provider || 'cache',
              searchRadius: cached.data?.searchRadius || radiusM,
              fromCache: true,
            };
            
          apiDiagnostics.logRequest({
            endpoint: 'nb_browse_pois',
            timestamp: Date.now(),
            latencyMs: 0,
            statusCode: 200,
            payloadSize: 0,
            responseSize: 0,
            success: true,
            cached: true,
            provider: 'unknown',
          });
          
            setResult(cacheResult);
            setLoading(false);
            resolve(cacheResult);
            return;
          }

          if (cached && cached.isStale) {
            // Stale cache - return immediately but refresh in background
            const staleResult: PoiSearchResult = {
              pois: cached.data?.pois || [],
              provider: 'cache (stale)',
              searchRadius: cached.data?.searchRadius || radiusM,
              fromCache: true,
            };
            
            setResult(staleResult);
            
            // Background refresh
            executeSearch(lat, lng, filterType, radiusM)
              .then((freshResult) => {
                setResult(freshResult);
              })
              .catch((err) => {
                console.warn('[usePoiSearch] Background refresh failed:', err);
                // Keep stale data
              });
            
            setLoading(false);
            resolve(staleResult);
            return;
          }

          // No cache - fetch fresh
          const freshResult = await executeSearch(lat, lng, filterType, radiusM);
          
          lastSearchRef.current = { lat, lng, filter: filterType, time: Date.now() };
          setResult(freshResult);
          setLoading(false);
          resolve(freshResult);

        } catch (err: any) {
          console.error('[usePoiSearch] Search failed:', err);
          setError(err?.message || 'Failed to search POIs');
          setLoading(false);
          resolve(null);
        }
      }, config.debounceMs);
    });
  }, [cancel, executeSearch, config.debounceMs, config.defaultRadiusM]);

  /**
   * Check if we should refetch based on movement
   */
  const shouldRefetch = useCallback((currentLat: number, currentLng: number): boolean => {
    if (!lastSearchRef.current) return true;
    
    return poiCache.shouldRefetch(
      currentLat,
      currentLng,
      lastSearchRef.current.lat,
      lastSearchRef.current.lng
    );
  }, []);

  /**
   * Clear cache and state
   */
  const clearCache = useCallback(() => {
    poiCache.clear();
    setResult(null);
    lastSearchRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  return {
    search,
    loading,
    error,
    result,
    shouldRefetch,
    clearCache,
    cancel,
    getCacheStats: poiCache.getStats.bind(poiCache),
  };
}

export default usePoiSearch;
