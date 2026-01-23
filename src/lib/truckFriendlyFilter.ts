/**
 * TRUCK-FRIENDLY POI FILTER
 * 
 * PRIMARY RULE:
 * Only suggest food locations that can safely accommodate a 53-foot semi-truck.
 * If truck parking is not confirmed or strongly inferred, DO NOT RETURN THE POI.
 */

// ============ ALLOWED POI SOURCES ============

// Known truck stop brands that are always truck-friendly
export const TRUCK_STOP_BRANDS = [
  "love's", "loves", "pilot", "flying j", "ta ", "travelcenter", "travel center",
  "petro", "sapp bros", "ambest", "buc-ee", "bucee", "town pump",
  "kwik trip", "casey's general", "kum & go", "qt ", "quiktrip",
  "wawa", "sheetz", "racetrac", "speedway",
];

// Restaurant chains commonly INSIDE truck stops (attached restaurants)
export const TRUCK_STOP_ATTACHED_RESTAURANTS = [
  // Iron Skillet / Country Pride are TA/Petro exclusive
  "iron skillet", "country pride",
  // Wendy's, Subway, Taco Bell, etc. are often inside truck stops
  "wendy", "subway", "taco bell", "mcdonald", "burger king", "arby",
  "popeyes", "chester", "godfather", "hot stuff", "denny",
  "huddle house", "ihop", "waffle house",
  // Coffee
  "dunkin", "starbucks", "tim horton",
  // Pizza
  "pizza hut", "domino", "papa john", "little caesar", "hunt brothers",
];

// Highway/Interstate restaurant brands known to have truck parking
export const HIGHWAY_TRUCK_FRIENDLY_RESTAURANTS = [
  "cracker barrel", // Famous for truck parking
  "waffle house", // Usually highway-accessible with large lots
  "golden corral", // Large parking lots
  "shoney", // Highway locations
  "denny", // Many have truck parking
  "ihop", // Some highway locations
  "huddle house", // Common at truck stop exits
];

// Walmart locations are CONDITIONALLY allowed
export const WALMART_BRANDS = ["walmart", "wal-mart"];

// ============ MANDATORY EXCLUSIONS ============

// Urban restaurant types to exclude
export const EXCLUDED_VENUE_TYPES = [
  "mall", "plaza", "shopping center", "downtown", "main street",
  "city center", "urban", "metropolitan",
];

// Categories that indicate non-truck-friendly
export const EXCLUDED_CATEGORIES = [
  "fine dining", "bistro", "cafe", "coffee shop", // Usually urban, no truck parking
  "food court", // Inside malls
  "bar", "pub", "nightclub", // Not meal-focused
];

// ============ FILTER INTERFACE ============

export interface TruckFriendlyPOI {
  id: string;
  name: string;
  lat: number;
  lng: number;
  distance?: number;
  category?: string;
  address?: string;
  chainName?: string;
  parentPoi?: {
    name: string;
    category: string;
  };
  // Truck accessibility indicators
  truckParking?: boolean;
  parkingLotSize?: 'small' | 'medium' | 'large' | 'unknown';
  distanceToHighway?: number;
  semiTruckAccessible?: boolean;
}

export interface FilterResult {
  poi: TruckFriendlyPOI;
  allowed: boolean;
  reason: string;
  source: 'truck_stop' | 'attached_restaurant' | 'highway_restaurant' | 'walmart' | 'excluded';
}

// ============ HELPER FUNCTIONS ============

function normalizeString(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}

function matchesBrandList(name: string, brandList: string[]): boolean {
  const normalized = normalizeString(name);
  return brandList.some(brand => normalized.includes(normalizeString(brand)));
}

function hasExcludedVenueType(address: string | undefined): boolean {
  if (!address) return false;
  const normalized = normalizeString(address);
  return EXCLUDED_VENUE_TYPES.some(type => normalized.includes(normalizeString(type)));
}

function hasExcludedCategory(category: string | undefined): boolean {
  if (!category) return false;
  const normalized = normalizeString(category);
  return EXCLUDED_CATEGORIES.some(cat => normalized.includes(normalizeString(cat)));
}

// ============ MAIN FILTER FUNCTION ============

/**
 * Filters a POI to determine if it's truck-friendly
 * Returns whether the POI is allowed and the reason
 */
export function filterTruckFriendlyPOI(poi: TruckFriendlyPOI): FilterResult {
  const name = poi.name || '';
  const address = poi.address || '';
  const category = poi.category || '';
  const chainName = poi.chainName || '';
  const searchText = `${name} ${chainName}`;

  // ============ MANDATORY EXCLUSIONS FIRST ============
  
  // Exclude urban venues
  if (hasExcludedVenueType(address)) {
    return {
      poi,
      allowed: false,
      reason: 'Urban location - no truck parking available',
      source: 'excluded',
    };
  }

  // Exclude non-truck-friendly categories
  if (hasExcludedCategory(category)) {
    return {
      poi,
      allowed: false,
      reason: `Category "${category}" typically lacks truck parking`,
      source: 'excluded',
    };
  }

  // ============ ALLOWED POI TYPES ============

  // 1. Truck Stops - ALWAYS allowed
  if (matchesBrandList(searchText, TRUCK_STOP_BRANDS)) {
    return {
      poi,
      allowed: true,
      reason: 'Verified truck stop with truck parking',
      source: 'truck_stop',
    };
  }

  // 2. Restaurants INSIDE truck stops (parent POI check)
  if (poi.parentPoi && matchesBrandList(poi.parentPoi.name, TRUCK_STOP_BRANDS)) {
    return {
      poi,
      allowed: true,
      reason: `Restaurant inside truck stop: ${poi.parentPoi.name}`,
      source: 'attached_restaurant',
    };
  }

  // 3. Known attached restaurant chains (when found near truck stops)
  // These are typically ONLY at truck stops, so we allow them
  if (matchesBrandList(searchText, TRUCK_STOP_ATTACHED_RESTAURANTS)) {
    // Additional check: must be close to a highway or have explicit truck parking
    if (poi.semiTruckAccessible === true || poi.truckParking === true) {
      return {
        poi,
        allowed: true,
        reason: 'Truck stop attached restaurant with verified truck access',
        source: 'attached_restaurant',
      };
    }
    
    // If distance is very small (< 200m), likely inside a truck stop
    if (poi.distance !== undefined && poi.distance < 200) {
      return {
        poi,
        allowed: true,
        reason: 'Restaurant within truck stop complex (< 200m)',
        source: 'attached_restaurant',
      };
    }
  }

  // 4. Highway truck-friendly restaurants
  if (matchesBrandList(searchText, HIGHWAY_TRUCK_FRIENDLY_RESTAURANTS)) {
    // Cracker Barrel is ALWAYS truck-friendly
    if (normalizeString(searchText).includes('cracker barrel')) {
      return {
        poi,
        allowed: true,
        reason: 'Cracker Barrel - known truck-friendly chain',
        source: 'highway_restaurant',
      };
    }

    // Others need additional verification
    if (poi.truckParking === true || 
        poi.parkingLotSize === 'large' || 
        poi.semiTruckAccessible === true) {
      return {
        poi,
        allowed: true,
        reason: 'Highway restaurant with verified truck parking',
        source: 'highway_restaurant',
      };
    }
  }

  // 5. Walmart - ONLY if truck-friendly
  if (matchesBrandList(searchText, WALMART_BRANDS)) {
    if (poi.truckParking === true) {
      return {
        poi,
        allowed: true,
        reason: 'Walmart with verified truck parking allowed',
        source: 'walmart',
      };
    }
    return {
      poi,
      allowed: false,
      reason: 'Walmart without verified truck parking policy',
      source: 'excluded',
    };
  }

  // ============ DEFAULT: EXCLUDE ============
  // If we can't verify truck accessibility, exclude for safety
  return {
    poi,
    allowed: false,
    reason: 'Cannot verify truck parking availability - excluded for safety',
    source: 'excluded',
  };
}

/**
 * Filters an array of POIs for truck-friendly locations
 * Returns only POIs that can safely accommodate a 53-foot semi-truck
 */
export function filterTruckFriendlyPOIs(pois: TruckFriendlyPOI[]): TruckFriendlyPOI[] {
  return pois.filter(poi => {
    const result = filterTruckFriendlyPOI(poi);
    if (!result.allowed) {
      console.log(`[TruckFilter] ❌ Excluded: ${poi.name} - ${result.reason}`);
    } else {
      console.log(`[TruckFilter] ✅ Allowed: ${poi.name} - ${result.reason}`);
    }
    return result.allowed;
  });
}

/**
 * Checks if a restaurant name indicates it's likely inside a truck stop
 * Used when we don't have parent POI information
 */
export function isLikelyTruckStopRestaurant(restaurantName: string, nearbyPois?: string[]): boolean {
  const normalized = normalizeString(restaurantName);
  
  // Check if it's a known attached restaurant chain
  const isAttached = TRUCK_STOP_ATTACHED_RESTAURANTS.some(brand => 
    normalized.includes(normalizeString(brand))
  );
  
  if (!isAttached) return false;
  
  // If we have nearby POIs, check if any are truck stops
  if (nearbyPois && nearbyPois.length > 0) {
    const hasTruckStopNearby = nearbyPois.some(poi => 
      matchesBrandList(poi, TRUCK_STOP_BRANDS)
    );
    return hasTruckStopNearby;
  }
  
  // Without additional context, we can't be certain
  return false;
}

/**
 * Gets the truck-friendly fallback message when no valid POIs are found
 */
export function getTruckFriendlyFallbackMessage(): string {
  return 'Nenhum restaurante com estacionamento para truck encontrado. Mostrando opções da conveniência do posto.';
}
