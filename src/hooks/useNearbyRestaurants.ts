import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

interface StopOfferings {
  breakfast: string[];
  lunch_dinner: string[];
  snacks: string[];
  drinks: string[];
}

interface FallbackSuggestions {
  brand: string;
  offerings: StopOfferings;
}

interface NearbyRestaurantsResult {
  restaurants: Restaurant[];
  fallback: FallbackSuggestions | null;
  source: 'api' | 'fallback';
}

// ============ CONSTANTS ============
const SEARCH_RADII = [150, 300, 500]; // meters
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const CACHE_VERSION = 'v2'; // bump to invalidate old cached results

// Known food brands for detection
const KNOWN_FOOD_BRANDS = [
  "mcdonald", "burger king", "wendy", "subway", "taco bell", "hardee", "carl's jr",
  "popeyes", "chick-fil-a", "arby", "dairy queen", "sonic", "denny", "ihop",
  "waffle house", "cracker barrel", "pizza hut", "domino", "papa john",
  "dunkin", "starbucks", "tim horton", "krispy kreme", "cinnabon",
  "chester", "godfather", "hot stuff", "iron skillet", "country pride"
];

// HERE category IDs for food places
const FOOD_CATEGORIES = [
  '100-1000-0000', // Restaurant
  '100-1000-0001', // Casual Dining
  '100-1000-0002', // Fine Dining
  '100-1000-0003', // Take Out & Delivery
  '100-1000-0004', // Food Court
  '100-1000-0005', // Bistro
  '100-1000-0006', // Fast Food
  '100-1000-0007', // Coffee Shop
  '100-1000-0008', // Cafeteria
  '100-1000-0009', // Bakery
];

// ============ TRUCK STOP OFFERINGS CATALOG ============
const STOP_OFFERINGS_CATALOG: Record<string, StopOfferings> = {
  loves: {
    breakfast: ['Oatmeal cup', 'Greek yogurt + fruit', 'Egg bites or omelet bowl'],
    lunch_dinner: ['Grilled chicken salad', 'Turkey or chicken wrap', 'Chili cup'],
    snacks: ['Nuts', 'String cheese', 'Fruit cup', 'Low sugar protein bar'],
    drinks: ['Water', 'Unsweetened iced tea', 'Zero sugar sports drink'],
  },
  pilot: {
    breakfast: ['Oatmeal cup', 'Yogurt + fruit', 'Egg option'],
    lunch_dinner: ['Salad + lean protein', 'Whole wheat deli sandwich', 'Chicken bowl'],
    snacks: ['Nuts', 'Low sugar jerky', 'Fruit', 'Cheese sticks'],
    drinks: ['Water', 'Black coffee', 'Zero sugar drinks'],
  },
  ta: {
    breakfast: ['Oatmeal cup', 'Yogurt + fruit', 'Egg option'],
    lunch_dinner: ['Salad + lean protein', 'Grilled or roasted chicken', 'Soup or chili'],
    snacks: ['Nuts', 'Fruit', 'Cheese sticks', 'Protein bar'],
    drinks: ['Water', 'Unsweetened drinks', 'Black coffee'],
  },
  petro: {
    breakfast: ['Oatmeal cup', 'Yogurt + fruit', 'Egg option'],
    lunch_dinner: ['Salad + lean protein', 'Wrap or whole wheat sandwich', 'Soup or chili'],
    snacks: ['Nuts', 'Fruit', 'Cheese sticks', 'Protein bar'],
    drinks: ['Water', 'Unsweetened drinks', 'Black coffee'],
  },
  generic: {
    breakfast: ['Oatmeal cup', 'Yogurt + fruit', 'Egg option'],
    lunch_dinner: ['Salad + lean protein', 'Wrap or whole wheat sandwich', 'Soup or chili'],
    snacks: ['Nuts', 'Fruit', 'Cheese sticks', 'Protein bar'],
    drinks: ['Water', 'Unsweetened drinks', 'Black coffee'],
  },
};

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

function isFoodPlace(item: any): boolean {
  // Our backend already classifies results; trust it.
  if (item?.category === 'restaurant') return true;

  // Check categories (when present)
  const categories = item.categories || [];
  for (const cat of categories) {
    const catId = cat.id || '';
    // Restaurant and food categories start with 100-1000
    if (catId.startsWith('100-1000') || catId.startsWith('100-1100')) {
      return true;
    }
  }

  // Check name against known food brands
  const nameNormalized = normalizeName(item.name || item.title || '');
  return KNOWN_FOOD_BRANDS.some((brand) => nameNormalized.includes(normalizeName(brand)));
}

function detectTruckStopBrand(stopName: string): string {
  const name = stopName.toLowerCase();
  if (name.includes("love's") || name.includes("loves")) return 'loves';
  if (name.includes("pilot") || name.includes("flying j")) return 'pilot';
  if (name.includes("ta ") || name.includes("travelcenter") || name.includes("travel center")) return 'ta';
  if (name.includes("petro")) return 'petro';
  return 'generic';
}

function getCacheKey(lat: number, lng: number): string {
  // Round to ~100m precision for caching
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
        console.log(`[useNearbyRestaurants] Searching radius ${radius}m`);
        
        const { data, error: fnError } = await supabase.functions.invoke('here_browse_pois', {
          body: {
            lat: stopLat,
            lng: stopLng,
            radiusMeters: radius,
            categories: FOOD_CATEGORIES,
            limit: 20,
          },
        });

        if (fnError) {
          console.error('[useNearbyRestaurants] API error:', fnError);
          continue;
        }

        const pois = data?.pois || [];
        
        // Filter for actual food places
        const foodPlaces = pois.filter((item: any) => isFoodPlace(item));
        
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
        const brand = detectTruckStopBrand(stopName);
        const offerings = STOP_OFFERINGS_CATALOG[brand] || STOP_OFFERINGS_CATALOG.generic;
        
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
      const brand = detectTruckStopBrand(stopName);
      const offerings = STOP_OFFERINGS_CATALOG[brand] || STOP_OFFERINGS_CATALOG.generic;
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
export type { Restaurant, StopOfferings, FallbackSuggestions, NearbyRestaurantsResult };
