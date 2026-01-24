/**
 * STRICT TRUCK-ONLY POI ALLOWLIST
 * 
 * This module ensures that ONLY truck-relevant POIs are displayed in Near Me and Stop Suggestions.
 * Any POI that doesn't match the allowlist is EXCLUDED - no exceptions.
 */

// ============ ALLOWED TRUCK STOP BRANDS ============
// These are the ONLY brands that are automatically allowed

export const ALLOWED_TRUCK_STOP_BRANDS = [
  // Major national chains
  'pilot', 'flying j', 'flyingj',
  "love's", 'loves',
  'ta ', 'ta-', 'travelamerica', 'travel america', 'travelcenters',
  'petro', 'petro stopping',
  'sapp bros', 'sappbros',
  'ambest', 'am best',
  "buc-ee's", 'bucees', "buc-ees",
  
  // Regional truck stops
  'kenly 95',
  'iowa 80',
  'road ranger',
  'town pump',
  'little america',
  'truckstops of america',
  
  // Truck-friendly gas stations (known to have diesel lanes and truck parking)
  'kwik trip', 'kwiktrip', // Often has truck diesel
  'quick trip', 'quiktrip', 'qt', // Many locations truck-friendly
  'casey', // Casey's General Store - many have truck access
  'kum & go', 'kum and go',
  'speedway', // Some locations are truck stops
  'racetrac', 'raceway', // Some highway locations
  'sheetz', // Some highway locations
  'wawa', // Some highway locations
];

// ============ ALLOWED TRUCK SERVICES ============

export const ALLOWED_TRUCK_SERVICES = [
  // Truck wash
  'blue beacon',
  'bluebeacon',
  'truck wash',
  'semi wash',
  
  // Truck repair/service
  'truck repair',
  'truck service',
  'diesel repair',
  'roadside assist',
  'freightliner',
  'peterbilt',
  'kenworth',
  'volvo trucks',
  'mack trucks',
];

// ============ ALLOWED OFFICIAL FACILITIES ============

export const ALLOWED_OFFICIAL_FACILITIES = [
  'weigh station',
  'scale house',
  'dot inspection',
  'port of entry',
  'truck inspection',
  'commercial vehicle',
];

// ============ ALLOWED REST AREAS ============

export const ALLOWED_REST_AREAS = [
  'rest area',
  'rest stop',
  'service area',
  'service plaza',
  'welcome center',
  'travel plaza',
  'truck parking',
  'overnight parking',
];

// ============ CONDITIONAL ALLOWLIST (requires verification) ============

export const CONDITIONAL_BRANDS = {
  walmart: {
    brand: ['walmart', 'wal-mart', 'wal mart'],
    // Only allow if explicitly marked as truck-friendly
    requiresVerification: true,
    verificationFields: ['truckParking', 'overnightParking', 'truckFriendly'],
  },
};

// ============ MANDATORY BLOCKLIST ============
// These categories are NEVER shown, regardless of other conditions

export const BLOCKED_CATEGORIES = [
  'restaurant',
  'cafe',
  'coffee shop',
  'bar',
  'pub',
  'nightclub',
  'retail',
  'store',
  'shop',
  'mall',
  'shopping center',
  'grocery',
  'supermarket',
  'bank',
  'atm',
  'hotel',
  'motel',
  'lodging',
  'hospital',
  'medical',
  'school',
  'church',
  'park',
  'museum',
  'theater',
  'cinema',
  'gym',
  'fitness',
  'spa',
  'salon',
  'pharmacy',
  'drugstore',
  'office',
  'business',
  'apartment',
  'residential',
];

export const BLOCKED_VENUE_TYPES = [
  'downtown',
  'city center',
  'main street',
  'plaza',
  'mall',
  'urban',
  'metropolitan',
];

// ============ FILTER INTERFACE ============

export interface TruckPoiCandidate {
  id: string;
  name: string;
  title?: string;
  category?: string;
  categories?: Array<{ name: string; id?: string }>;
  lat: number;
  lng: number;
  address?: string | { label?: string; street?: string; city?: string };
  distance?: number;
  truckParking?: boolean;
  overnightParking?: boolean;
  truckFriendly?: boolean;
  dieselLanes?: boolean;
  searchTerm?: string;
  poiType?: string;
}

export interface AllowlistResult {
  allowed: boolean;
  reason: string;
  category: 'truck_stop' | 'truck_service' | 'weigh_station' | 'rest_area' | 'walmart' | 'blocked';
  confidence: 'confirmed' | 'likely' | 'unknown';
}

// ============ HELPER FUNCTIONS ============

function normalizeText(text: string | undefined | null): string {
  if (!text) return '';
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function matchesAnyBrand(text: string, brands: string[]): boolean {
  const normalized = normalizeText(text);
  return brands.some(brand => {
    const normalizedBrand = normalizeText(brand);
    // Exact word boundary match for short brands like "ta " or "qt"
    if (normalizedBrand.length <= 3) {
      const regex = new RegExp(`\\b${normalizedBrand.trim()}\\b`, 'i');
      return regex.test(normalized);
    }
    return normalized.includes(normalizedBrand);
  });
}

function getCategoryText(poi: TruckPoiCandidate): string {
  const parts: string[] = [];
  if (poi.category) parts.push(poi.category);
  if (poi.categories) {
    poi.categories.forEach(c => {
      if (c.name) parts.push(c.name);
      if (c.id) parts.push(c.id);
    });
  }
  if (poi.poiType) parts.push(poi.poiType);
  return normalizeText(parts.join(' '));
}

function getAddressText(address: TruckPoiCandidate['address']): string {
  if (!address) return '';
  if (typeof address === 'string') return normalizeText(address);
  const parts = [address.label, address.street, address.city].filter(Boolean);
  return normalizeText(parts.join(' '));
}

// ============ MAIN FILTER FUNCTION ============

/**
 * Checks if a POI should be allowed based on strict truck-only allowlist.
 * Returns whether the POI is allowed and the category it belongs to.
 */
export function checkTruckPoiAllowlist(poi: TruckPoiCandidate): AllowlistResult {
  const name = poi.name || poi.title || '';
  const searchText = normalizeText(`${name} ${poi.searchTerm || ''}`);
  const categoryText = getCategoryText(poi);
  const addressText = getAddressText(poi.address);
  const fullText = `${searchText} ${categoryText}`;

  // ============ STEP 1: Check blocklist first ============
  
  // Check if category is blocked
  for (const blocked of BLOCKED_CATEGORIES) {
    if (categoryText.includes(normalizeText(blocked))) {
      // EXCEPTION: Don't block if it's clearly a truck stop
      if (!matchesAnyBrand(searchText, ALLOWED_TRUCK_STOP_BRANDS)) {
        return {
          allowed: false,
          reason: `Blocked category: ${blocked}`,
          category: 'blocked',
          confidence: 'confirmed',
        };
      }
    }
  }

  // Check if address indicates blocked venue type
  for (const blocked of BLOCKED_VENUE_TYPES) {
    if (addressText.includes(normalizeText(blocked))) {
      if (!matchesAnyBrand(searchText, ALLOWED_TRUCK_STOP_BRANDS)) {
        return {
          allowed: false,
          reason: `Blocked venue type: ${blocked}`,
          category: 'blocked',
          confidence: 'confirmed',
        };
      }
    }
  }

  // ============ STEP 2: Check explicit truck stops ============
  
  if (matchesAnyBrand(searchText, ALLOWED_TRUCK_STOP_BRANDS)) {
    return {
      allowed: true,
      reason: 'Matched allowed truck stop brand',
      category: 'truck_stop',
      confidence: 'confirmed',
    };
  }

  // ============ STEP 3: Check truck services (Blue Beacon, etc.) ============
  
  if (matchesAnyBrand(searchText, ALLOWED_TRUCK_SERVICES)) {
    return {
      allowed: true,
      reason: 'Matched truck service provider',
      category: 'truck_service',
      confidence: 'confirmed',
    };
  }

  // ============ STEP 4: Check official facilities (weigh stations) ============
  
  if (matchesAnyBrand(fullText, ALLOWED_OFFICIAL_FACILITIES)) {
    return {
      allowed: true,
      reason: 'Matched official truck facility',
      category: 'weigh_station',
      confidence: 'confirmed',
    };
  }

  // ============ STEP 5: Check rest areas ============
  
  if (matchesAnyBrand(fullText, ALLOWED_REST_AREAS)) {
    return {
      allowed: true,
      reason: 'Matched rest area/service plaza',
      category: 'rest_area',
      confidence: 'likely',
    };
  }

  // ============ STEP 6: Check conditional (Walmart) ============
  
  const walmartConfig = CONDITIONAL_BRANDS.walmart;
  if (matchesAnyBrand(searchText, walmartConfig.brand)) {
    // Only allow if truck parking is explicitly confirmed
    if (poi.truckParking === true || poi.overnightParking === true || poi.truckFriendly === true) {
      return {
        allowed: true,
        reason: 'Walmart with verified truck parking',
        category: 'walmart',
        confidence: 'confirmed',
      };
    }
    return {
      allowed: false,
      reason: 'Walmart without verified truck parking',
      category: 'blocked',
      confidence: 'unknown',
    };
  }

  // ============ STEP 7: Check category-based allowance ============
  
  // Allow if the POI category explicitly indicates truck-related
  const truckRelatedCategories = [
    'truck stop', 'truck_stop', 'truckstop',
    'travel center', 'travel_center', 'travelcenter',
    'fuel station', 'fuel_station', 'diesel',
    'truck parking', 'truck_parking',
    '700-7600-0116', // HERE truck stop category
  ];

  for (const truckCat of truckRelatedCategories) {
    if (categoryText.includes(normalizeText(truckCat))) {
      return {
        allowed: true,
        reason: `Category indicates truck-friendly: ${truckCat}`,
        category: 'truck_stop',
        confidence: 'likely',
      };
    }
  }

  // ============ DEFAULT: BLOCK ============
  // If we can't verify it's truck-friendly, don't show it
  
  return {
    allowed: false,
    reason: 'Not on truck-friendly allowlist',
    category: 'blocked',
    confidence: 'unknown',
  };
}

/**
 * Filters an array of POIs to only include truck-friendly locations.
 * Returns only POIs that pass the strict allowlist check.
 */
export function filterTruckOnlyPois<T extends TruckPoiCandidate>(pois: T[]): T[] {
  const results: T[] = [];
  const blocked: { name: string; reason: string }[] = [];

  for (const poi of pois) {
    const check = checkTruckPoiAllowlist(poi);
    if (check.allowed) {
      results.push(poi);
    } else {
      blocked.push({ name: poi.name || poi.title || 'Unknown', reason: check.reason });
    }
  }

  // Log summary for debugging
  if (blocked.length > 0) {
    console.log(`[TruckAllowlist] Blocked ${blocked.length} non-truck POIs:`, 
      blocked.slice(0, 5).map(b => `${b.name} (${b.reason})`).join(', '),
      blocked.length > 5 ? `... and ${blocked.length - 5} more` : ''
    );
  }
  console.log(`[TruckAllowlist] Allowed ${results.length} truck-friendly POIs`);

  return results;
}

/**
 * Gets a list of search terms optimized for finding truck-only POIs.
 * Use these when querying POI APIs.
 */
export function getTruckOnlySearchTerms(filterType: string): string[] {
  switch (filterType) {
    case 'truckStops':
      return [
        'truck stop',
        'travel center',
        'pilot flying j',
        "love's travel",
        'ta petro',
        'sapp bros',
        'diesel truck',
      ];
    case 'weighStations':
      return [
        'weigh station',
        'scale house',
        'dot inspection',
        'port of entry',
      ];
    case 'truckWash':
      return [
        'blue beacon',
        'truck wash',
      ];
    case 'walmart':
      return [
        'walmart truck parking',
        'walmart supercenter truck',
      ];
    case 'restAreas':
      return [
        'rest area',
        'service plaza',
        'truck parking',
      ];
    case 'nearMe':
    default:
      return [
        'truck stop',
        'travel center', 
        'pilot',
        "love's",
        'ta petro',
        'rest area',
        'truck parking',
      ];
  }
}

/**
 * Gets API categories optimized for truck-only searches.
 */
export function getTruckOnlyCategories(filterType: string): { nextbillion: string[]; here: string[] } {
  switch (filterType) {
    case 'truckStops':
      return {
        nextbillion: ['fuel-station'],
        here: ['700-7600-0116', '700-7600-0000'], // truck stops, fuel stations
      };
    case 'restAreas':
      return {
        nextbillion: ['parking', 'parking-lot'],
        here: ['700-7850-0000', '400-4100-0000'], // parking, rest areas
      };
    case 'weighStations':
      return {
        nextbillion: [],
        here: [],
      };
    case 'nearMe':
    default:
      return {
        nextbillion: ['fuel-station', 'parking'],
        here: ['700-7600-0116', '700-7600-0000', '700-7850-0000'],
      };
  }
}
