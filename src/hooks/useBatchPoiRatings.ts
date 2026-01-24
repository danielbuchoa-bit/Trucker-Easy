import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PoiRatingSummary {
  avgRating: number;
  totalReviews: number;
  ratingType: 'poi' | 'facility';
}

interface CacheEntry {
  data: PoiRatingSummary;
  timestamp: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

export const useBatchPoiRatings = () => {
  const [ratings, setRatings] = useState<Map<string, PoiRatingSummary>>(new Map());
  const [loading, setLoading] = useState(false);
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const pendingRequestRef = useRef<Set<string>>(new Set());

  // Generate a stable key for POI matching
  const generatePoiKey = useCallback((poi: { id: string; name: string; lat: number; lng: number }): string => {
    // Use ID as primary key, fallback to normalized name + location
    if (poi.id && !poi.id.startsWith('temp-')) {
      return poi.id;
    }
    const normalizedName = poi.name.toLowerCase().replace(/[^\w]/g, '').substring(0, 20);
    const latKey = Math.round(poi.lat * 1000) / 1000;
    const lngKey = Math.round(poi.lng * 1000) / 1000;
    return `${normalizedName}_${latKey}_${lngKey}`;
  }, []);

  // Check if cache entry is still valid
  const isCacheValid = useCallback((entry: CacheEntry): boolean => {
    return Date.now() - entry.timestamp < CACHE_TTL_MS;
  }, []);

  // Fetch ratings for multiple POIs in batch
  const fetchBatchRatings = useCallback(async (
    pois: Array<{ id: string; name: string; lat: number; lng: number; type?: string }>
  ) => {
    if (pois.length === 0) return;

    // Filter out POIs that are cached or already being fetched
    const poisToFetch: typeof pois = [];
    const cachedResults = new Map<string, PoiRatingSummary>();

    for (const poi of pois) {
      const key = generatePoiKey(poi);
      const cached = cacheRef.current.get(key);
      
      if (cached && isCacheValid(cached)) {
        cachedResults.set(key, cached.data);
      } else if (!pendingRequestRef.current.has(key)) {
        poisToFetch.push(poi);
        pendingRequestRef.current.add(key);
      }
    }

    // Update state with cached results immediately
    if (cachedResults.size > 0) {
      setRatings(prev => {
        const newMap = new Map(prev);
        cachedResults.forEach((value, key) => newMap.set(key, value));
        return newMap;
      });
    }

    if (poisToFetch.length === 0) return;

    setLoading(true);
    console.log('[BatchPoiRatings] Fetching ratings for', poisToFetch.length, 'POIs');

    try {
      // Collect all POI IDs and location bounds
      const poiIds = poisToFetch.map(p => p.id).filter(id => id && !id.startsWith('temp-'));
      const lats = poisToFetch.map(p => p.lat);
      const lngs = poisToFetch.map(p => p.lng);
      
      const minLat = Math.min(...lats) - 0.005;
      const maxLat = Math.max(...lats) + 0.005;
      const minLng = Math.min(...lngs) - 0.005;
      const maxLng = Math.max(...lngs) + 0.005;

      // Fetch from poi_feedback table (for POIs like truck stops, gas stations)
      const { data: poiFeedback } = await supabase
        .from('poi_feedback')
        .select('poi_id, poi_name, friendliness_rating, cleanliness_rating, structure_rating, recommendation_rating')
        .in('poi_id', poiIds.length > 0 ? poiIds : ['__none__']);

      // Fetch from facility_ratings table (for facilities by location)
      const { data: facilityRatings } = await supabase
        .from('facility_ratings')
        .select('id, facility_name, lat, lng, overall_rating')
        .gte('lat', minLat)
        .lte('lat', maxLat)
        .gte('lng', minLng)
        .lte('lng', maxLng);

      // Process POI feedback
      const poiFeedbackMap = new Map<string, { total: number; count: number }>();
      if (poiFeedback) {
        for (const fb of poiFeedback) {
          const existing = poiFeedbackMap.get(fb.poi_id) || { total: 0, count: 0 };
          // Calculate average of the 4 ratings
          const avgRating = (
            fb.friendliness_rating + 
            fb.cleanliness_rating + 
            (fb.structure_rating || 3) + 
            fb.recommendation_rating
          ) / 4;
          existing.total += avgRating;
          existing.count += 1;
          poiFeedbackMap.set(fb.poi_id, existing);
        }
      }

      // Process facility ratings by location
      const facilityRatingsMap = new Map<string, { total: number; count: number }>();
      if (facilityRatings) {
        for (const rating of facilityRatings) {
          // Find matching POI by location
          for (const poi of poisToFetch) {
            if (rating.lat && rating.lng) {
              const latDiff = Math.abs(poi.lat - rating.lat);
              const lngDiff = Math.abs(poi.lng - rating.lng);
              if (latDiff < 0.002 && lngDiff < 0.002) {
                const key = generatePoiKey(poi);
                const existing = facilityRatingsMap.get(key) || { total: 0, count: 0 };
                existing.total += rating.overall_rating;
                existing.count += 1;
                facilityRatingsMap.set(key, existing);
              }
            }
          }
        }
      }

      // Merge results and update state
      const newResults = new Map<string, PoiRatingSummary>();

      for (const poi of poisToFetch) {
        const key = generatePoiKey(poi);
        
        // Check POI feedback first
        const poiData = poiFeedbackMap.get(poi.id);
        if (poiData && poiData.count > 0) {
          const summary: PoiRatingSummary = {
            avgRating: Math.round((poiData.total / poiData.count) * 10) / 10,
            totalReviews: poiData.count,
            ratingType: 'poi',
          };
          newResults.set(key, summary);
          cacheRef.current.set(key, { data: summary, timestamp: Date.now() });
          continue;
        }

        // Check facility ratings
        const facilityData = facilityRatingsMap.get(key);
        if (facilityData && facilityData.count > 0) {
          const summary: PoiRatingSummary = {
            avgRating: Math.round((facilityData.total / facilityData.count) * 10) / 10,
            totalReviews: facilityData.count,
            ratingType: 'facility',
          };
          newResults.set(key, summary);
          cacheRef.current.set(key, { data: summary, timestamp: Date.now() });
        }

        // Mark as fetched (even if no results)
        pendingRequestRef.current.delete(key);
      }

      if (newResults.size > 0) {
        console.log('[BatchPoiRatings] Found ratings for', newResults.size, 'POIs');
        setRatings(prev => {
          const newMap = new Map(prev);
          newResults.forEach((value, key) => newMap.set(key, value));
          return newMap;
        });
      }

    } catch (err) {
      console.error('[BatchPoiRatings] Error fetching batch ratings:', err);
      // Clear pending on error
      poisToFetch.forEach(poi => {
        pendingRequestRef.current.delete(generatePoiKey(poi));
      });
    } finally {
      setLoading(false);
    }
  }, [generatePoiKey, isCacheValid]);

  // Get rating for a specific POI
  const getRating = useCallback((poi: { id: string; name: string; lat: number; lng: number }): PoiRatingSummary | null => {
    const key = generatePoiKey(poi);
    return ratings.get(key) || null;
  }, [ratings, generatePoiKey]);

  // Clear cache (useful for forcing refresh)
  const clearCache = useCallback(() => {
    cacheRef.current.clear();
    setRatings(new Map());
  }, []);

  return {
    ratings,
    loading,
    fetchBatchRatings,
    getRating,
    generatePoiKey,
    clearCache,
  };
};
