import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  filterTruckFriendlyPOIs, 
  TRUCK_STOP_BRANDS, 
  TRUCK_STOP_ATTACHED_RESTAURANTS,
  type TruckFriendlyPOI 
} from '@/lib/truckFriendlyFilter';

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
  truckFriendlyFiltered?: boolean;
}

// ============ CONSTANTS ============
// Search only within truck stop complex - very tight radius
const SEARCH_RADII = [150, 300]; // meters - only find restaurants INSIDE or adjacent to truck stops
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const CACHE_VERSION = 'v4-truck-filter'; // bump to invalidate old cached results

// Known food brands for detection - only those commonly in truck stops
const KNOWN_FOOD_BRANDS = [
  // Fast food chains commonly INSIDE truck stops - verified truck-friendly
  "iron skillet", "country pride", // TA/Petro exclusive
  "denny", "huddle house", "waffle house",
  "wendy", "subway", "taco bell", "mcdonald", "burger king", "arby",
  "popeyes", "chester", "godfather", "hot stuff",
  "dunkin", "starbucks", "tim horton",
  "pizza hut", "domino", "papa john", "little caesar", "hunt brothers",
  // Highway chains with known truck parking
  "cracker barrel", "golden corral", "shoney",
];

// Food categories are now handled by nb_browse_pois filterType: 'food'

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

/**
 * STRICT TRUCK-FRIENDLY FOOD FILTER
 * Only allows food places that are:
 * 1. Inside a truck stop complex (distance < 150m from truck stop)
 * 2. Known truck stop attached restaurants
 * 3. Highway restaurants with verified truck parking (Cracker Barrel, etc.)
 */
function isTruckFriendlyFood(item: any, stopName: string): boolean {
  const itemName = normalizeName(item.name || item.title || '');
  const chainName = normalizeName(item.chainName || item.chains?.[0]?.name || '');
  const searchText = itemName + ' ' + chainName;
  const distance = item.distance || 0;
  
  // Check if the stop itself is a known truck stop
  const isAtTruckStop = TRUCK_STOP_BRANDS.some(brand => 
    normalizeName(stopName).includes(normalizeName(brand))
  );
  
  // If we're at a truck stop and the restaurant is very close (< 150m), it's likely attached
  if (isAtTruckStop && distance < 150) {
    // Check if it's a known food brand
    const isKnownFood = KNOWN_FOOD_BRANDS.some(brand => 
      searchText.includes(normalizeName(brand))
    );
    if (isKnownFood) {
      console.log(`[TruckFilter] ✅ ${item.name} - attached to truck stop (${distance}m)`);
      return true;
    }
  }
  
  // Check if it's a truck stop attached restaurant chain
  const isAttachedChain = TRUCK_STOP_ATTACHED_RESTAURANTS.some(brand =>
    searchText.includes(normalizeName(brand))
  );
  
  if (isAttachedChain && distance < 200) {
    console.log(`[TruckFilter] ✅ ${item.name} - known truck stop restaurant chain`);
    return true;
  }
  
  // Special case: Cracker Barrel is always truck-friendly
  if (searchText.includes('crackerbarrel') || searchText.includes('cracker barrel')) {
    console.log(`[TruckFilter] ✅ ${item.name} - Cracker Barrel (truck-friendly)`);
    return true;
  }
  
  // STRICT: Exclude everything else - urban restaurants, malls, etc.
  console.log(`[TruckFilter] ❌ ${item.name} - not verified truck-friendly (${distance}m from stop)`);
  return false;
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
