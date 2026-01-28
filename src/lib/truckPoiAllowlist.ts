/**
 * STRICT TRUCK-ONLY POI ALLOWLIST v2
 * 
 * Ensures ONLY POIs relevant for 53-foot semi-trucks are displayed.
 * Regular gas stations like Shell, Arco, 76, Safeway Fuel are BLOCKED.
 */

// ============ GROUP 1: TRUCK STOPS / TRAVEL CENTERS (Priority MAX) ============
// These are the ONLY fuel-related brands automatically allowed
export const TRUCK_STOP_BRANDS = [
  // Major national truck stop chains
  'pilot', 'flying j', 'flyingj', 'pilot flying j',
  "love's", 'loves', "love's travel", 'loves travel',
  'ta ', 'ta-', 'travelcenters of america', 'travelamerica',
  'petro', 'petro stopping', 'petro stopping centers',
  'one9', 'one 9',
  'sapp bros', 'sappbros', 'sapp brothers',
  'maverik truck', // Only truck-specific Maverik locations
  'ambest', 'am best',
  "buc-ee's", 'bucees', "buc-ees",
  
  // Regional truck stops
  'kenly 95',
  'iowa 80',
  'road ranger truck',
  'town pump truck',
  'little america travel',
  'truckstops of america',
  'boss truck',
  'roady\'s truck',
  'catlins truck',
  'big rig travel',
];

// Keywords that indicate a true truck stop
export const TRUCK_STOP_KEYWORDS = [
  'truck stop',
  'truckstop',
  'travel center',
  'travel plaza',
  'truck plaza',
  'diesel lane',
  'truck fuel',
  'trucker',
  'big rig',
  'semi truck fuel',
  'tractor trailer',
];

// ============ GROUP 2: TRUCK PARKING ============
export const TRUCK_PARKING_KEYWORDS = [
  'truck parking',
  'semi truck parking',
  'tractor trailer parking',
  'hgv parking',
  'commercial vehicle parking',
  'truck lot',
  'trucker parking',
  'overnight truck',
  'semi parking',
  '18 wheeler parking',
  'big rig parking',
];

// ============ GROUP 3: WEIGH STATIONS / DOT ============
export const WEIGH_STATION_KEYWORDS = [
  'weigh station',
  'weight station',
  'scale house',
  'dot inspection',
  'port of entry',
  'truck scales',
  'inspection station',
  'commercial vehicle inspection',
  'truck checkpoint',
];

// ============ GROUP 4: TRUCK REPAIR / HEAVY DUTY ============
export const TRUCK_REPAIR_BRANDS = [
  'speedco',
  "love's truck care",
  'loves truck care',
  'ta truck service',
  'petro lube',
  'blue beacon tire',
  'goodyear commercial',
  'bridgestone commercial',
  'michelin commercial',
  'freightliner',
  'peterbilt',
  'kenworth',
  'volvo trucks',
  'mack trucks',
  'international trucks',
  'navistar',
];

export const TRUCK_REPAIR_KEYWORDS = [
  'truck repair',
  'diesel repair',
  'heavy duty repair',
  'semi truck repair',
  'truck service',
  'commercial truck repair',
  'fleet service',
  'truck tire',
  'diesel mechanic',
  'road service truck',
  'tractor repair',
  'trailer repair',
  'truck maintenance',
  'cdl service',
  'semi service',
];

// ============ GROUP 5: TRUCK WASH ============
export const TRUCK_WASH_BRANDS = [
  'blue beacon',
  'bluebeacon',
  'transtar',
  'speedywash',
  'beacon wash',
];

export const TRUCK_WASH_KEYWORDS = [
  'truck wash',
  'semi wash',
  'trailer wash',
  'commercial wash',
  'tractor wash',
  'big rig wash',
  'fleet wash',
];

// ============ REST AREAS (with truck parking) ============
export const REST_AREA_KEYWORDS = [
  'rest area truck',
  'service area truck',
  'truck rest',
  'rest stop truck',
  'welcome center truck',
];

// ============ HARD BLACKLIST - BLOCKED ALWAYS ============
// These are NEVER shown unless they explicitly match truck stop brands
export const BLOCKED_GAS_STATION_BRANDS = [
  'shell',
  'arco',
  'chevron',
  '76',
  'union 76',
  'safeway fuel',
  'safeway gas',
  'costco gas',
  'costco fuel',
  'sam\'s club gas',
  'sams club',
  'kroger fuel',
  'fred meyer fuel',
  'fred meyer gas',
  'qfc fuel',
  'albertsons fuel',
  'vons fuel',
  'ralph\'s fuel',
  'exxon',
  'mobil',
  'bp ',
  'citgo',
  'sunoco',
  'marathon',
  'valero',
  'phillips 66',
  'conoco',
  'cenex',
  'sinclair',
  'murphy usa',
  'murphy express',
  'circle k',
  '7-eleven',
  '7 eleven',
  'pac pride',
  'ampm',
  'am pm',
  'wawa', // Regular locations are NOT truck friendly
  'sheetz', // Regular locations are NOT truck friendly
  'speedway', // Regular locations are NOT truck friendly
  'racetrac',
  'raceway',
  'kwik trip', // Regular locations may not be truck friendly
  'quiktrip',
  'qt ',
  'casey',
  'kum & go',
  'kum and go',
  'maverick', // Regular Maverik is NOT truck friendly
  'thorntons',
  'wesco',
  'kangaroo',
  'flash foods',
  'mapco',
  'gate',
  'stripes',
];

export const BLOCKED_CATEGORIES = [
  'car wash',
  'gas station', // Block generic gas stations
  'fuel station', // Block generic fuel stations  
  'convenience store',
  'grocery fuel',
  'auto service',
  'parking garage',
  'mall parking',
  'restaurant',
  'coffee',
  'fast food',
  'daycare', // Block "Love" daycares that false-match
  'child care',
  'preschool',
  'school',
  'church',
  'welfare',
  'hotel',
  'motel',
  'lodging',
  'apartment',
  'residential',
  'bank',
  'atm',
  'hospital',
  'medical',
  'pharmacy',
  'retail',
  'store',
  'shop',
  'mall',
  'supermarket',
  'grocery',
];

// ============ INTERFACES ============

export type TruckPoiGroup = 
  | 'truck_stop'
  | 'truck_parking'
  | 'weigh_station'
  | 'truck_repair'
  | 'truck_wash'
  | 'rest_area'
  | 'blocked';

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
  truckAccess?: boolean;
  overnightParking?: boolean;
  truckFriendly?: boolean;
  dieselLanes?: boolean;
  commercialVehicle?: boolean;
  searchTerm?: string;
  poiType?: string;
  _truckReason?: string;
  _source?: string;
}

export interface TruckPoiResult {
  allowed: boolean;
  reason: string;
  group: TruckPoiGroup;
  confidence: 'verified' | 'unverified';
  score: number; // 0-100, higher = more relevant
}

// ============ HELPER FUNCTIONS ============

function normalize(text: string | undefined | null): string {
  if (!text) return '';
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function matchesAny(text: string, patterns: string[]): boolean {
  const normalized = normalize(text);
  return patterns.some(pattern => {
    const normalizedPattern = normalize(pattern);
    // For short patterns, use word boundary matching
    if (normalizedPattern.length <= 3) {
      const regex = new RegExp(`\\b${normalizedPattern.trim()}\\b`, 'i');
      return regex.test(normalized);
    }
    return normalized.includes(normalizedPattern);
  });
}

function getCategoryString(poi: TruckPoiCandidate): string {
  const parts: string[] = [];
  if (poi.category) parts.push(poi.category);
  if (poi.categories) {
    poi.categories.forEach(c => {
      if (c.name) parts.push(c.name);
      if (c.id) parts.push(c.id);
    });
  }
  if (poi.poiType) parts.push(poi.poiType);
  if (poi._truckReason) parts.push(poi._truckReason);
  return normalize(parts.join(' '));
}

function getFullText(poi: TruckPoiCandidate): string {
  const name = poi.name || poi.title || '';
  const category = getCategoryString(poi);
  const searchTerm = poi.searchTerm || '';
  return normalize(`${name} ${category} ${searchTerm}`);
}

// ============ MAIN FILTER FUNCTION ============

export function checkTruckPoi(poi: TruckPoiCandidate): TruckPoiResult {
  const name = normalize(poi.name || poi.title || '');
  const fullText = getFullText(poi);
  const categoryText = getCategoryString(poi);

  // ============ STEP 1: Check GROUP 1 - Truck Stop Brands (HIGHEST PRIORITY) ============
  if (matchesAny(name, TRUCK_STOP_BRANDS)) {
    return {
      allowed: true,
      reason: `Matched truck stop brand: ${poi.name}`,
      group: 'truck_stop',
      confidence: 'verified',
      score: 100,
    };
  }

  // Check truck stop keywords in name
  if (matchesAny(name, TRUCK_STOP_KEYWORDS)) {
    return {
      allowed: true,
      reason: `Matched truck stop keyword in name`,
      group: 'truck_stop',
      confidence: 'verified',
      score: 95,
    };
  }

  // ============ STEP 2: Check BLOCKLIST (before other checks) ============
  
  // Block known gas station brands
  if (matchesAny(name, BLOCKED_GAS_STATION_BRANDS)) {
    return {
      allowed: false,
      reason: `Blocked gas station brand: ${poi.name}`,
      group: 'blocked',
      confidence: 'verified',
      score: 0,
    };
  }

  // Block by category
  for (const blocked of BLOCKED_CATEGORIES) {
    if (categoryText.includes(normalize(blocked))) {
      return {
        allowed: false,
        reason: `Blocked category: ${blocked}`,
        group: 'blocked',
        confidence: 'verified',
        score: 0,
      };
    }
  }

  // Block generic "petrol station" unless it matched truck brands above
  if (categoryText.includes('petrol station') || categoryText.includes('gas station')) {
    // Only allow if name strongly suggests truck stop
    if (!matchesAny(fullText, [...TRUCK_STOP_KEYWORDS, ...TRUCK_STOP_BRANDS])) {
      return {
        allowed: false,
        reason: `Generic petrol station without truck indicators`,
        group: 'blocked',
        confidence: 'verified',
        score: 0,
      };
    }
  }

  // ============ STEP 3: Check GROUP 3 - Weigh Stations ============
  if (matchesAny(fullText, WEIGH_STATION_KEYWORDS)) {
    return {
      allowed: true,
      reason: `Matched weigh station keyword`,
      group: 'weigh_station',
      confidence: 'verified',
      score: 90,
    };
  }

  // ============ STEP 4: Check GROUP 4 - Truck Repair ============
  if (matchesAny(name, TRUCK_REPAIR_BRANDS)) {
    return {
      allowed: true,
      reason: `Matched truck repair brand: ${poi.name}`,
      group: 'truck_repair',
      confidence: 'verified',
      score: 85,
    };
  }

  if (matchesAny(fullText, TRUCK_REPAIR_KEYWORDS)) {
    return {
      allowed: true,
      reason: `Matched truck repair keyword`,
      group: 'truck_repair',
      confidence: 'unverified',
      score: 75,
    };
  }

  // ============ STEP 5: Check GROUP 5 - Truck Wash ============
  if (matchesAny(name, TRUCK_WASH_BRANDS)) {
    return {
      allowed: true,
      reason: `Matched truck wash brand: ${poi.name}`,
      group: 'truck_wash',
      confidence: 'verified',
      score: 85,
    };
  }

  if (matchesAny(fullText, TRUCK_WASH_KEYWORDS)) {
    return {
      allowed: true,
      reason: `Matched truck wash keyword`,
      group: 'truck_wash',
      confidence: 'unverified',
      score: 70,
    };
  }

  // ============ STEP 6: Check GROUP 2 - Truck Parking ============
  // Check for explicit truck parking attributes
  if (poi.truckParking === true || poi.truckAccess === true || poi.commercialVehicle === true) {
    return {
      allowed: true,
      reason: `Has truck parking/access attribute`,
      group: 'truck_parking',
      confidence: 'verified',
      score: 80,
    };
  }

  if (matchesAny(fullText, TRUCK_PARKING_KEYWORDS)) {
    return {
      allowed: true,
      reason: `Matched truck parking keyword`,
      group: 'truck_parking',
      confidence: 'unverified',
      score: 65,
    };
  }

  // ============ STEP 7: Check Rest Areas with Truck Parking ============
  if (matchesAny(fullText, REST_AREA_KEYWORDS)) {
    return {
      allowed: true,
      reason: `Matched rest area with truck parking`,
      group: 'rest_area',
      confidence: 'unverified',
      score: 60,
    };
  }

  // Generic "rest area" without truck indicators - allow with low confidence
  if (fullText.includes('rest area') || fullText.includes('service area')) {
    // Only if it has overnight or truck friendly indicator
    if (poi.overnightParking === true || poi.truckFriendly === true) {
      return {
        allowed: true,
        reason: `Rest area with overnight/truck friendly flag`,
        group: 'rest_area',
        confidence: 'unverified',
        score: 55,
      };
    }
  }

  // ============ DEFAULT: BLOCK ============
  return {
    allowed: false,
    reason: `Not on truck-friendly allowlist: ${poi.name}`,
    group: 'blocked',
    confidence: 'verified',
    score: 0,
  };
}

/**
 * Filters POIs to only include 53-foot truck friendly locations.
 * Sorts by relevance score (highest first).
 */
export function filterTruckPois<T extends TruckPoiCandidate>(
  pois: T[],
  options?: {
    only53Friendly?: boolean;
    onlyVerified?: boolean;
    includeRestAreas?: boolean;
    filterGroup?: TruckPoiGroup;
  }
): Array<T & { _truckResult: TruckPoiResult }> {
  const results: Array<T & { _truckResult: TruckPoiResult }> = [];
  const blocked: { name: string; reason: string }[] = [];
  const { only53Friendly = true, onlyVerified = false, includeRestAreas = true, filterGroup } = options || {};

  for (const poi of pois) {
    const result = checkTruckPoi(poi);

    // Apply filters
    if (!result.allowed) {
      blocked.push({ name: poi.name || poi.title || 'Unknown', reason: result.reason });
      continue;
    }

    // Filter by group if specified
    if (filterGroup && result.group !== filterGroup) {
      continue;
    }

    // Skip rest areas if not included
    if (!includeRestAreas && result.group === 'rest_area') {
      continue;
    }

    // Skip unverified if only verified requested
    if (onlyVerified && result.confidence === 'unverified') {
      continue;
    }

    results.push({ ...poi, _truckResult: result });
  }

  // Log filtering summary
  if (blocked.length > 0) {
    console.log(`[TruckFilter] BLOCKED ${blocked.length} non-truck POIs:`,
      blocked.slice(0, 5).map(b => `${b.name} (${b.reason})`).join(', '),
      blocked.length > 5 ? `... and ${blocked.length - 5} more` : ''
    );
  }
  console.log(`[TruckFilter] ALLOWED ${results.length} truck-friendly POIs`);

  // Sort by score (highest first), then by distance
  return results.sort((a, b) => {
    const scoreDiff = b._truckResult.score - a._truckResult.score;
    if (scoreDiff !== 0) return scoreDiff;
    return (a.distance || 0) - (b.distance || 0);
  });
}

/**
 * Filter POIs by specific group
 */
export function filterByGroup<T extends TruckPoiCandidate>(
  pois: T[],
  group: TruckPoiGroup
): Array<T & { _truckResult: TruckPoiResult }> {
  return filterTruckPois(pois, { filterGroup: group });
}

/**
 * Get optimized search terms for truck-only POI queries
 */
export function getTruckSearchTerms(filterType: string): string[] {
  switch (filterType) {
    case 'truckStops':
      return [
        'pilot flying j',
        "love's travel stop",
        'ta petro',
        'truck stop',
        'travel center',
        'diesel truck',
      ];
    case 'truckParking':
      return [
        'truck parking',
        'semi truck parking',
        'tractor trailer parking',
        'commercial parking',
      ];
    case 'weighStations':
      return [
        'weigh station',
        'scale house',
        'dot inspection',
        'port of entry',
      ];
    case 'truckRepair':
      return [
        'truck repair',
        'diesel repair',
        'heavy duty repair',
        'truck service',
        'speedco',
      ];
    case 'truckWash':
      return [
        'blue beacon',
        'truck wash',
      ];
    case 'restAreas':
      return [
        'rest area',
        'service plaza',
        'truck rest',
      ];
    case 'nearMe':
    default:
      return [
        'pilot',
        "love's",
        'ta ',
        'petro',
        'truck stop',
        'weigh station',
        'truck parking',
      ];
  }
}

/**
 * Get API categories for truck-only searches
 */
export function getTruckCategories(): { nextbillion: string[]; here: string[] } {
  return {
    nextbillion: ['fuel-station', 'parking'],
    here: ['700-7600-0116', '700-7600-0000'], // Truck-specific categories
  };
}
