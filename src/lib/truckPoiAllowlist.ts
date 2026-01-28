/**
 * STRICT TRUCK-ONLY POI ALLOWLIST v3
 * 
 * Ensures ONLY POIs relevant for 53-foot semi-trucks are displayed.
 * Regular gas stations like Shell, Arco, 76, Safeway Fuel are BLOCKED.
 * 
 * BUGFIX v3: Proper word-boundary matching for "TA" to prevent false positives
 * like "Petco", "Santa Fe", "Utah", etc.
 */

// ============ GROUP 1: TRUCK STOPS / TRAVEL CENTERS (Priority MAX) ============
// These are the ONLY fuel-related brands automatically allowed
export const TRUCK_STOP_BRANDS = [
  // Major national truck stop chains
  'pilot', 'flying j', 'flyingj', 'pilot flying j',
  "love's", 'loves', "love's travel", 'loves travel',
  'travelcenters of america', 'travelamerica',
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

// TA-specific patterns that require special handling
// Note: "ta" alone is NOT in TRUCK_STOP_BRANDS to prevent false positives
const TA_TRUCK_PATTERNS = [
  'ta travel center',
  'ta truck stop',
  'ta petro',
  'ta express',
  'ta truck',
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
  'wawa',
  'sheetz',
  'speedway',
  'racetrac',
  'raceway',
  'kwik trip',
  'quiktrip',
  'casey',
  'kum & go',
  'kum and go',
  'maverick',
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
  'gas station',
  'fuel station',
  'convenience store',
  'grocery fuel',
  'auto service',
  'parking garage',
  'mall parking',
  'restaurant',
  'coffee',
  'fast food',
  'daycare',
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
  'pet store',
  'veterinary',
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
  categories?: Array<{ name?: string; id?: string }>;
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
  chainName?: string;
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

export interface FilterOptions {
  onlyVerified?: boolean;
  includeRestAreas?: boolean;
  filterGroup?: TruckPoiGroup;
}

// ============ HELPER FUNCTIONS ============

function normalize(text: string | undefined | null): string {
  if (!text) return '';
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if text contains a token as a whole word (word boundary)
 * This prevents "ta" matching in "Petco", "Santa", etc.
 */
function hasWordToken(text: string, token: string): boolean {
  const normalizedText = normalize(text);
  const normalizedToken = normalize(token);
  
  // Use word boundary regex
  const regex = new RegExp(`(^|\\s)${escapeRegex(normalizedToken)}($|\\s)`, 'i');
  return regex.test(` ${normalizedText} `); // Add spaces to help with boundaries
}

/**
 * Check if text matches any pattern in the list
 * Uses includes for longer patterns (>=4 chars), word boundary for short ones
 */
function matchesAny(text: string, patterns: string[]): boolean {
  const normalized = normalize(text);
  
  for (const pattern of patterns) {
    const normalizedPattern = normalize(pattern);
    
    // For patterns >= 4 chars, simple includes is fine
    if (normalizedPattern.length >= 4) {
      if (normalized.includes(normalizedPattern)) {
        return true;
      }
    } else {
      // For short patterns (like "76", "bp"), use word boundary
      if (hasWordToken(text, pattern)) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Special check for "TA" brand - must have truck context
 * Prevents false positives like "Petco", "Santa Fe", "Utah", etc.
 */
function isTATruckStop(poi: TruckPoiCandidate): boolean {
  const fullText = getFullText(poi);
  const normalized = normalize(fullText);
  
  // Check for explicit TA patterns first
  for (const pattern of TA_TRUCK_PATTERNS) {
    if (normalized.includes(normalize(pattern))) {
      return true;
    }
  }
  
  // Check for standalone "TA" as a word token
  const hasTAToken = hasWordToken(poi.name, 'ta') || hasWordToken(poi.chainName || '', 'ta');
  if (!hasTAToken) return false;
  
  // Must also have truck-related context nearby
  const truckContext = [
    'truck', 'travel', 'petro', 'diesel', 'trucker', 
    'center', 'plaza', 'stop', 'express', 'fuel'
  ];
  
  return truckContext.some(ctx => normalized.includes(ctx));
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
  const chain = poi.chainName || '';
  const category = getCategoryString(poi);
  const searchTerm = poi.searchTerm || '';
  return normalize(`${name} ${chain} ${category} ${searchTerm}`);
}

// ============ MAIN FILTER FUNCTION ============

export function checkTruckPoi(poi: TruckPoiCandidate): TruckPoiResult {
  const name = normalize(poi.name || poi.title || '');
  const fullText = getFullText(poi);
  const categoryText = getCategoryString(poi);

  // ============ STEP 0: Early block for blocked categories (before TA check) ============
  // This prevents "TA Electronics" (electronics store) from matching TA truck stop
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

  // ============ STEP 1: Check GROUP 1 - Truck Stop Brands (HIGHEST PRIORITY) ============
  if (matchesAny(poi.name, TRUCK_STOP_BRANDS) || matchesAny(poi.chainName || '', TRUCK_STOP_BRANDS)) {
    return {
      allowed: true,
      reason: `Matched truck stop brand: ${poi.name}`,
      group: 'truck_stop',
      confidence: 'verified',
      score: 100,
    };
  }

  // Special TA handling - check with context to avoid false positives
  if (isTATruckStop(poi)) {
    return {
      allowed: true,
      reason: `Matched TA truck stop with context`,
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
  if (matchesAny(poi.name, BLOCKED_GAS_STATION_BRANDS) || matchesAny(poi.chainName || '', BLOCKED_GAS_STATION_BRANDS)) {
    return {
      allowed: false,
      reason: `Blocked gas station brand: ${poi.name}`,
      group: 'blocked',
      confidence: 'verified',
      score: 0,
    };
  }

  // Note: Category blocking is now done in STEP 0 (before truck stop checks)

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
  if (matchesAny(poi.name, TRUCK_REPAIR_BRANDS) || matchesAny(poi.chainName || '', TRUCK_REPAIR_BRANDS)) {
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
  if (matchesAny(poi.name, TRUCK_WASH_BRANDS) || matchesAny(poi.chainName || '', TRUCK_WASH_BRANDS)) {
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

// ============ FILTER FUNCTION ============

/**
 * Filter an array of POIs to only truck-friendly ones
 * Returns enriched POIs with truck result attached
 */
export function filterTruckPois<T extends TruckPoiCandidate>(
  pois: T[],
  options: FilterOptions = {}
): Array<T & { _truckResult: TruckPoiResult }> {
  const { onlyVerified = false, includeRestAreas = false, filterGroup } = options;
  
  const results: Array<T & { _truckResult: TruckPoiResult }> = [];
  
  for (const poi of pois) {
    const result = checkTruckPoi(poi);
    
    // Skip blocked POIs
    if (!result.allowed) continue;
    
    // Apply verified filter
    if (onlyVerified && result.confidence !== 'verified') continue;
    
    // Apply group filter
    if (filterGroup && result.group !== filterGroup) continue;
    
    // Skip rest areas unless explicitly included
    if (result.group === 'rest_area' && !includeRestAreas) continue;
    
    results.push({
      ...poi,
      _truckResult: result,
    });
  }
  
  // Sort by score (desc) then by distance (asc)
  return results.sort((a, b) => {
    // First by score (higher is better)
    if (b._truckResult.score !== a._truckResult.score) {
      return b._truckResult.score - a._truckResult.score;
    }
    // Then by distance (lower is better)
    const distA = a.distance ?? Infinity;
    const distB = b.distance ?? Infinity;
    return distA - distB;
  });
}

/**
 * Get allowed groups for a tab filter
 */
export function getGroupsForTab(tab: string): TruckPoiGroup[] {
  switch (tab) {
    case 'truck_stops':
      return ['truck_stop'];
    case 'truck_parking':
      return ['truck_parking'];
    case 'weigh_stations':
      return ['weigh_station'];
    case 'truck_repairs':
      return ['truck_repair'];
    case 'truck_wash':
      return ['truck_wash'];
    case 'rest_areas':
      return ['rest_area'];
    case 'near_me':
    default:
      // Near Me shows all truck-friendly POIs
      return ['truck_stop', 'truck_parking', 'weigh_station', 'truck_repair', 'truck_wash'];
  }
}
