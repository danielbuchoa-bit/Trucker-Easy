import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  TRUCK_STOP_BRANDS, 
  TRUCK_STOP_ATTACHED_RESTAURANTS,
} from '@/lib/truckFriendlyFilter';
import {
  type StopOfferings,
  type TruckStopBrand,
  detectTruckStopBrand,
  networkToOfferings,
  resolveFoodOfferings,
  TRUCK_STOP_NETWORKS,
  GENERIC_OFFERINGS,
  FOOD_DISCLAIMER,
  RESTAURANT_CHAINS,
} from '@/lib/foodSuggestionEngine';

// ============ TYPES ============
interface Restaurant {
  id: string;
  name: string;
  lat: number;
  lng: number;
  distance: number;
  category: string;
  address?: string;
}

interface FallbackSuggestions {
  brand: string;
  offerings: StopOfferings;
}

interface NearbyRestaurantsResult {
  restaurants: Restaurant[];
  fallback: FallbackSuggestions | null;
  source: 'api' | 'fallback';
  truckFriendlyFiltered?: boolean;
}

// ============ CONSTANTS ============
const SEARCH_RADII = [150, 300];
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_VERSION = 'v5-engine';

// Known food brands commonly inside truck stops
const KNOWN_FOOD_BRANDS = [
  "iron skillet", "country pride",
  "denny", "huddle house", "waffle house",
  "wendy", "subway", "taco bell", "mcdonald", "burger king", "arby",
  "popeyes", "chester", "godfather", "hot stuff",
  "dunkin", "starbucks", "tim horton",
  "pizza hut", "domino", "papa john", "little caesar", "hunt brothers",
  "cracker barrel", "golden corral", "shoney",
  "naf naf", "chipotle", "naf naf grill",
];

// ============ UTILITY FUNCTIONS ============
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

function dedupeByName(restaurants: Restaurant[]): Restaurant[] {
  const seen = new Set<string>();
  return restaurants.filter((r) => {
    const normalized = normalizeName(r.name);
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

/**
 * STRICT TRUCK-FRIENDLY FOOD FILTER
 */
function isTruckFriendlyFood(item: any, stopName: string): boolean {
  const itemName = normalizeName(item.name || item.title || '');
  const chainName = normalizeName(item.chainName || item.chains?.[0]?.name || '');
  const searchText = itemName + ' ' + chainName;
  const distance = item.distance || 0;

  const isAtTruckStop = TRUCK_STOP_BRANDS.some(brand =>
    normalizeName(stopName).includes(normalizeName(brand))
  );

  if (isAtTruckStop && distance < 150) {
    const isKnownFood = KNOWN_FOOD_BRANDS.some(brand =>
      searchText.includes(normalizeName(brand))
    );
    if (isKnownFood) return true;
  }

  const isAttachedChain = TRUCK_STOP_ATTACHED_RESTAURANTS.some(brand =>
    searchText.includes(normalizeName(brand))
  );
  if (isAttachedChain && distance < 200) return true;

  if (searchText.includes('crackerbarrel') || searchText.includes('cracker barrel')) return true;

  return false;
}

function getOfferingsForBrand(stopName: string): StopOfferings {
  const brand = detectTruckStopBrand(stopName);
  if (brand) {
    return networkToOfferings(TRUCK_STOP_NETWORKS[brand]);
  }
  return GENERIC_OFFERINGS;
}

function getCacheKey(lat: number, lng: number): string {
  const roundedLat = Math.round(lat * 1000) / 1000;
  const roundedLng = Math.round(lng * 1000) / 1000;
  return `restaurants_${CACHE_VERSION}_${roundedLat}_${roundedLng}`;
}

// ============ CACHE ============
interface CacheEntry {
  data: NearbyRestaurantsResult;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

function getFromCache(key: string): NearbyRestaurantsResult | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: NearbyRestaurantsResult): void {
  cache.set(key, { data, timestamp: Date.now() });
}

// ============ MAIN HOOK ============
export function useNearbyRestaurants() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NearbyRestaurantsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef(false);

  const fetchNearbyRestaurants = useCallback(async (
    stopLat: number,
    stopLng: number,
    stopName: string
  ): Promise<NearbyRestaurantsResult> => {
    // Check cache first
    const cacheKey = getCacheKey(stopLat, stopLng);
    const cached = getFromCache(cacheKey);
    if (cached) {
      console.log('[useNearbyRestaurants] Using cached result');
      setResult(cached);
      return cached;
    }

    // Prevent duplicate fetches
    if (fetchingRef.current) {
      console.log('[useNearbyRestaurants] Already fetching, skipping');
      return result || { restaurants: [], fallback: null, source: 'fallback' };
    }

    fetchingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      let restaurants: Restaurant[] = [];

      // Try each radius until we find results
      for (const radius of SEARCH_RADII) {
        console.log(`[useNearbyRestaurants] Searching radius ${radius}m for stop: ${stopName}`);
        
        const { data, error: fnError } = await supabase.functions.invoke('nb_browse_pois', {
          body: {
            lat: stopLat,
            lng: stopLng,
            radiusMeters: radius,
            filterType: 'food',
            limit: 30, // Fetch more to filter
          },
        });

        if (fnError) {
          console.error('[useNearbyRestaurants] API error:', fnError);
          continue;
        }

        const pois = data?.pois || [];
        console.log(`[useNearbyRestaurants] Raw POIs returned: ${pois.length}`);
        
        // STRICT TRUCK-FRIENDLY FILTER: Only allow restaurants inside truck stops
        const foodPlaces = pois.filter((item: any) => {
          return isTruckFriendlyFood(item, stopName);
        });
        
        console.log(`[useNearbyRestaurants] After truck-friendly filter: ${foodPlaces.length} places`);
        
        if (foodPlaces.length > 0) {
          restaurants = foodPlaces
            .sort((a: any, b: any) => a.distance - b.distance)
            .slice(0, 6)
            .map((item: any) => ({
              id: item.id,
              name: item.name || item.title,
              lat: item.lat,
              lng: item.lng,
              distance: item.distance,
              category: 'restaurant',
              address: item.address,
            }));
          
          // Dedupe by normalized name
          restaurants = dedupeByName(restaurants);
          console.log(`[useNearbyRestaurants] Deduped restaurants: ${restaurants.map(r => r.name).join(', ')}`);
          break;
        }
      }

      let resultData: NearbyRestaurantsResult;

      if (restaurants.length > 0) {
        // Found restaurants via API
        resultData = {
          restaurants,
          fallback: null,
          source: 'api',
        };
        console.log('[useNearbyRestaurants] Found restaurants:', restaurants.length);
      } else {
        // No restaurants found, use fallback catalog
        const brand = detectTruckStopBrand(stopName) ?? 'generic';
        const offerings = getOfferingsForBrand(stopName);
        
        resultData = {
          restaurants: [],
          fallback: { brand, offerings },
          source: 'fallback',
        };
        console.log('[useNearbyRestaurants] Using fallback for brand:', brand);
      }

      // Cache the result
      setCache(cacheKey, resultData);
      setResult(resultData);
      return resultData;

    } catch (err) {
      console.error('[useNearbyRestaurants] Error:', err);
      setError('Failed to search for restaurants');
      
      // Return fallback on error
      const brand = detectTruckStopBrand(stopName) ?? 'generic';
      const offerings = getOfferingsForBrand(stopName);
      const fallbackResult: NearbyRestaurantsResult = {
        restaurants: [],
        fallback: { brand, offerings },
        source: 'fallback',
      };
      setResult(fallbackResult);
      return fallbackResult;

    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [result]);

  return {
    fetchNearbyRestaurants,
    result,
    loading,
    error,
  };
}

// Export types
export type { Restaurant, FallbackSuggestions, NearbyRestaurantsResult };
export { type StopOfferings } from '@/lib/foodSuggestionEngine';
