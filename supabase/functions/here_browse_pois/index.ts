import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================
// HERE Category ID Map (slug -> HERE IDs)
// ============================================
const CATEGORY_MAP: Record<string, string[]> = {
  // Truck Stop - PRIMARY category for this app
  'truck_stop': ['700-7850-0000'],
  'truck-stop': ['700-7850-0000'],
  'truckstop': ['700-7850-0000'],
  
  // Fuel / Gas Station variations
  'gas_station': ['700-7600-0116'],
  'fuel_station': ['700-7600-0116'],
  'petrol_station': ['700-7600-0116'],
  'fuel-station': ['700-7600-0116'],
  'petrol-station': ['700-7600-0116'],
  'gas-station': ['700-7600-0116'],
  'fuel': ['700-7600-0116'],
  'gas': ['700-7600-0116'],
  
  // Fueling Station (aggregator)
  'fueling_station': ['700-7600-0000'],
  'fueling-station': ['700-7600-0000'],
  
  // Direct HERE IDs (pass through)
  '700-7600-0116': ['700-7600-0116'],
  '700-7600-0000': ['700-7600-0000'],
  '700-7850-0000': ['700-7850-0000'],
  '100-1000-0000': ['100-1000-0000'],
  '550-5510-0000': ['550-5510-0000'],
};

// Query fallback map - what to search for when using text query
const QUERY_FALLBACK_MAP: Record<string, string> = {
  '700-7850-0000': 'truck stop',
  'truck_stop': 'truck stop',
  'truck-stop': 'truck stop',
  'truckstop': 'truck stop',
  '700-7600-0116': 'gas station',
  '700-7600-0000': 'fuel station',
  'restaurant': 'restaurant',
  'food': 'restaurant',
  '100-1000-0000': 'restaurant',
  'rest_area': 'rest area',
  'rest-area': 'rest area',
  '550-5510-0000': 'rest area',
  'weigh_station': 'weigh station',
  'weigh-station': 'weigh station',
};

// Known truck stop brand names - ONLY these pass the filter
const TRUCK_STOP_BRANDS = [
  'pilot', 'flying j', 'loves', "love's", 'ta ', 'travel centers', 'petro',
  'sapp bros', 'ambest', 'big cat', 'road ranger', 'buckys', "buc-ee's",
  'buc-ees', 'bucees', 'kenly 95', 'truck stops of america', 'cefco',
  'quik trip', 'quick trip', 'qt ', 'sheetz', 'wawa', 'maverick',
  'caseys', "casey's", 'town pump', 'kwik trip', 'kwiktrip', 'speedway',
  'circle k', 'husky', 'flying hook', 'saddleman', 'truck stop',
  'travel plaza', 'travel center', 'truck plaza', 'truckstop',
  'gas station', 'fuel stop', 'fuel center', 'service plaza', 'service area',
  'rest stop', 'rest area', 'welcome center',
];

// Words that DISQUALIFY a place from being a truck stop
const EXCLUSION_KEYWORDS = [
  'auto body', 'body shop', 'collision', 'repair shop', 'mechanic',
  'storage', 'warehouse', 'moving', 'rental',
  'dealership', 'car dealer', 'auto dealer', 'sales',
  'insurance', 'finance', 'bank', 'credit union',
  'hotel', 'motel', 'inn', 'lodge', 'suites',
  'hospital', 'clinic', 'medical', 'dental', 'pharmacy',
  'school', 'college', 'university', 'academy',
  'church', 'temple', 'mosque', 'synagogue',
  'office', 'law firm', 'attorney', 'lawyer',
  'real estate', 'realty', 'property',
  'salon', 'spa', 'barber', 'beauty',
  'gym', 'fitness', 'yoga',
  'veterinary', 'vet ', 'animal',
  'funeral', 'cemetery', 'mortuary',
  'towing', 'tow truck', 'wrecker',
  'tire shop', 'tire center', // tire shops separate from truck stops
  'auto parts', 'parts store',
  'car wash only', // car wash without fuel
];

interface BrowsePoisRequest {
  lat: number;
  lng: number;
  heading?: number;
  radiusMeters?: number;
  categories?: string | string[];
  type?: 'FUEL' | 'TRUCK_STOP' | 'RESTAURANT';
  limit?: number;
}

interface ApiResponse {
  ok: boolean;
  source: 'here';
  mode: 'categories' | 'query_fallback' | 'error';
  pois: any[];
  warnings?: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const respond = (data: ApiResponse, status = 200) => {
    return new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  };

  try {
    const HERE_API_KEY = Deno.env.get('HERE_API_KEY');
    if (!HERE_API_KEY) {
      console.error('[HERE_BROWSE_POIS] ❌ HERE_API_KEY not configured');
      return respond({
        ok: false,
        source: 'here',
        mode: 'error',
        pois: [],
        warnings: ['HERE API not configured'],
      });
    }

    const body: BrowsePoisRequest = await req.json();
    const { 
      lat, 
      lng, 
      heading, 
      radiusMeters = 50000,
      categories,
      type,
      limit = 20 
    } = body;

    if (lat === undefined || lng === undefined) {
      return respond({
        ok: false,
        source: 'here',
        mode: 'error',
        pois: [],
        warnings: ['lat and lng are required'],
      });
    }

    console.log('[HERE_BROWSE_POIS] Request:', { lat, lng, heading, radiusMeters, categories, type });

    // ============================================
    // 1️⃣ Normalize and validate categories
    // ============================================
    let inputCategories: string[] = [];
    
    if (categories) {
      if (Array.isArray(categories)) {
        inputCategories = categories;
      } else if (typeof categories === 'string') {
        inputCategories = categories.split(',').map(c => c.trim()).filter(Boolean);
      }
    }

    // Track what was originally requested for proper fallback
    const isTruckStopSearch = inputCategories.some(cat => 
      cat === '700-7850-0000' || 
      cat.toLowerCase().includes('truck')
    ) || type === 'TRUCK_STOP';

    // Map ONLY the requested categories to HERE IDs - NO ADDITIONS
    const validHereIds: string[] = [];
    const invalidCategories: string[] = [];

    for (const cat of inputCategories) {
      const normalized = cat.toLowerCase().trim();

      // Pass-through for valid HERE category IDs (e.g. 100-1000-0006)
      if (/^\d{3}-\d{4}-\d{4}$/.test(normalized)) {
        validHereIds.push(normalized);
      } else if (CATEGORY_MAP[normalized]) {
        validHereIds.push(...CATEGORY_MAP[normalized]);
      } else {
        invalidCategories.push(cat);
      }
    }

    // Handle type parameter ONLY if no categories specified
    if (type && validHereIds.length === 0) {
      switch (type) {
        case 'FUEL':
          validHereIds.push('700-7600-0116');
          break;
        case 'TRUCK_STOP':
          validHereIds.push('700-7850-0000');
          break;
        case 'RESTAURANT':
          validHereIds.push('100-1000-0000');
          break;
      }
    }

    // Deduplicate - ONLY use what was requested
    const uniqueHereIds = [...new Set(validHereIds)];

    if (invalidCategories.length > 0) {
      console.log('[HERE_BROWSE_POIS] ⚠️ Invalid categories ignored:', invalidCategories);
    }

    console.log('[HERE_BROWSE_POIS] Searching with categories:', uniqueHereIds, 'isTruckStopSearch:', isTruckStopSearch);

    // ============================================
    // 2️⃣ Attempt A: Category-based search
    // ============================================
    let items: any[] = [];
    let mode: 'categories' | 'query_fallback' = 'categories';
    const warnings: string[] = [];

    if (uniqueHereIds.length > 0) {
      try {
        // Use HERE Browse endpoint for category-based search
        const categoryUrl = new URL('https://browse.search.hereapi.com/v1/browse');
        categoryUrl.searchParams.set('at', `${lat},${lng}`);
        categoryUrl.searchParams.set('limit', Math.min(limit * 3, 100).toString()); // Fetch extra for filtering
        categoryUrl.searchParams.set('circle', `${lat},${lng};r=${radiusMeters}`);
        categoryUrl.searchParams.set('categories', uniqueHereIds.join(','));
        categoryUrl.searchParams.set('apiKey', HERE_API_KEY);

        const safeUrl = categoryUrl.toString().replace(HERE_API_KEY, '***');
        console.log('[HERE_BROWSE_POIS] 🔍 Category search (Browse API):', safeUrl);

        const res = await fetch(categoryUrl.toString());
        const data = await res.json();

        if (res.ok && data?.items?.length > 0) {
          console.log('[HERE_BROWSE_POIS] ✅ Category search returned:', data.items.length, 'results');
          items = data.items;
          mode = 'categories';
        } else if (!res.ok) {
          console.log('[HERE_BROWSE_POIS] ⚠️ Category search failed:', res.status, data?.title || data?.error);
          warnings.push(`Category search failed: ${res.status} ${data?.title || ''}`);
        } else {
          console.log('[HERE_BROWSE_POIS] ⚠️ Category search returned 0 results');
        }
      } catch (err) {
        console.error('[HERE_BROWSE_POIS] ❌ Category search error:', err);
        warnings.push('Category search threw exception');
      }
    }

    // ============================================
    // 3️⃣ Attempt B: Query fallback - MATCH the original request
    // ============================================
    if (items.length === 0) {
      // Determine query term based on what was ORIGINALLY requested
      let queryTerm: string;
      
      if (isTruckStopSearch) {
        queryTerm = 'truck stop';
      } else if (uniqueHereIds.length > 0) {
        // Use fallback map for the first requested category
        queryTerm = QUERY_FALLBACK_MAP[uniqueHereIds[0]] || 'truck stop';
      } else if (inputCategories.length > 0) {
        const firstCat = inputCategories[0].toLowerCase();
        queryTerm = QUERY_FALLBACK_MAP[firstCat] || 'truck stop';
      } else {
        // Default to truck stop for this app
        queryTerm = 'truck stop';
      }

      try {
        // Use HERE Discover endpoint for text search
        const queryUrl = new URL('https://discover.search.hereapi.com/v1/discover');
        queryUrl.searchParams.set('at', `${lat},${lng}`);
        queryUrl.searchParams.set('limit', Math.min(limit * 3, 100).toString());
        queryUrl.searchParams.set('q', queryTerm);
        queryUrl.searchParams.set('apiKey', HERE_API_KEY);

        const safeUrl = queryUrl.toString().replace(HERE_API_KEY, '***');
        console.log('[HERE_BROWSE_POIS] 🔍 Query fallback (Discover API):', safeUrl, 'query:', queryTerm);

        const res = await fetch(queryUrl.toString());
        const data = await res.json();

        if (res.ok && data?.items) {
          console.log('[HERE_BROWSE_POIS] ✅ Query fallback returned:', data.items.length, 'results');
          items = data.items;
          mode = 'query_fallback';
        } else {
          console.log('[HERE_BROWSE_POIS] ⚠️ Query fallback failed:', res.status, data?.title || data?.error);
          warnings.push(`Query fallback failed: ${res.status} ${data?.title || ''}`);
        }
      } catch (err) {
        console.error('[HERE_BROWSE_POIS] ❌ Query fallback error:', err);
        warnings.push('Query fallback threw exception');
      }
    }

    // ============================================
    // 4️⃣ Process and filter results
    // ============================================
    function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
      const toRad = (deg: number) => (deg * Math.PI) / 180;
      const toDeg = (rad: number) => (rad * 180) / Math.PI;
      const dLng = toRad(lng2 - lng1);
      const lat1Rad = toRad(lat1);
      const lat2Rad = toRad(lat2);
      const y = Math.sin(dLng) * Math.cos(lat2Rad);
      const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
      const bearing = toDeg(Math.atan2(y, x));
      return ((bearing % 360) + 360) % 360;
    }

    function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
      const R = 6371000;
      const toRad = (deg: number) => (deg * Math.PI) / 180;
      const dLat = toRad(lat2 - lat1);
      const dLng = toRad(lng2 - lng1);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function isWithinCone(poiBearing: number, heading: number, coneAngle = 60): boolean {
      let diff = Math.abs(poiBearing - heading);
      if (diff > 180) diff = 360 - diff;
      return diff <= coneAngle;
    }

    function getCategoryType(categories: any[], name: string, chainName: string | null): string {
      // First check by HERE category ID
      for (const cat of categories || []) {
        const id = cat.id || '';
        if (id.includes('7850')) return 'truck_stop';
        if (id.includes('5510')) return 'rest_area';
      }
      
      // Then check by name/chain for truck stops
      const searchText = `${name} ${chainName || ''}`.toLowerCase();
      for (const brand of TRUCK_STOP_BRANDS) {
        if (searchText.includes(brand)) return 'truck_stop';
      }
      
      // Check remaining categories
      for (const cat of categories || []) {
        const id = cat.id || '';
        if (id.includes('7600')) return 'fuel';
        if (id.includes('1000')) return 'restaurant';
      }
      
      return 'fuel';
    }

    // Check if a place is EXCLUDED (not a valid truck stop)
    function isExcludedPlace(name: string, chainName: string | null): boolean {
      const searchText = `${name} ${chainName || ''}`.toLowerCase();
      
      for (const keyword of EXCLUSION_KEYWORDS) {
        if (searchText.includes(keyword)) {
          console.log(`[HERE_BROWSE_POIS] ❌ Excluded: "${name}" (matched: ${keyword})`);
          return true;
        }
      }
      return false;
    }

    function isTruckStopPoi(item: any): boolean {
      const name = (item.title || '').toLowerCase();
      const chainName = (item.chains?.[0]?.name || '').toLowerCase();
      
      // First check exclusions - if excluded, it's NOT a truck stop
      if (isExcludedPlace(name, chainName)) {
        return false;
      }
      
      // Check category IDs
      for (const cat of item.categories || []) {
        const id = cat.id || '';
        // Only 7850 is truck stop category
        if (id.includes('7850')) return true;
      }
      
      // Check name/chain for known truck stop brands
      const searchText = `${name} ${chainName}`;
      
      for (const brand of TRUCK_STOP_BRANDS) {
        if (searchText.includes(brand)) return true;
      }
      
      return false;
    }

    let results = items.map((item: any) => {
      const poiLat = item.position?.lat;
      const poiLng = item.position?.lng;
      const distance = haversineDistance(lat, lng, poiLat, poiLng);
      const bearingToPoi = calculateBearing(lat, lng, poiLat, poiLng);
      const chainName = item.chains?.[0]?.name || null;

      return {
        id: item.id,
        name: item.title,
        lat: poiLat,
        lng: poiLng,
        distance,
        distanceMiles: distance / 1609.34,
        bearing: bearingToPoi,
        category: getCategoryType(item.categories, item.title, chainName),
        address: item.address?.label || '',
        chainName,
        openingHours: item.openingHours?.[0]?.text || null,
        contacts: item.contacts?.[0]?.phone?.[0]?.value || null,
        _isTruckStop: isTruckStopPoi(item), // Internal flag for filtering
        _isExcluded: isExcludedPlace(item.title, chainName), // Track exclusions
      };
    });

    // ============================================
    // 5️⃣ CRITICAL: Filter results based on what was requested
    // ============================================
    if (isTruckStopSearch) {
      const beforeCount = results.length;
      // Keep ONLY valid truck stops, exclude everything else
      results = results.filter((poi: any) => poi._isTruckStop && !poi._isExcluded);
      console.log('[HERE_BROWSE_POIS] 🚛 Truck stop filter: kept', results.length, 'of', beforeCount);
      
      // Log what was filtered out
      if (beforeCount > results.length) {
        const excluded = beforeCount - results.length;
        console.log(`[HERE_BROWSE_POIS] 🗑️ Filtered out ${excluded} non-truck-stop places`);
      }
    }

    // Remove internal flags
    results = results.map(({ _isTruckStop, _isExcluded, ...poi }: any) => poi);

    // Filter by heading cone if provided
    if (heading !== undefined && heading !== null) {
      const beforeConeFilter = results.length;
      results = results.filter((poi: any) => isWithinCone(poi.bearing, heading, 60));
      console.log(`[HERE_BROWSE_POIS] 🧭 Heading filter: kept ${results.length} of ${beforeConeFilter}`);
    }

    // Sort by distance and limit
    results.sort((a: any, b: any) => a.distance - b.distance);
    results = results.slice(0, limit);

    console.log('[HERE_BROWSE_POIS] ✅ Final results:', results.length, 'mode:', mode);

    return respond({
      ok: true,
      source: 'here',
      mode,
      pois: results,
      warnings: warnings.length > 0 ? warnings : undefined,
    });

  } catch (error: unknown) {
    // ============================================
    // 6️⃣ HARD FAIL SAFE – NEVER BREAK UI
    // ============================================
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[HERE_BROWSE_POIS] ❌ Critical error:', error);
    
    return respond({
      ok: false,
      source: 'here',
      mode: 'error',
      pois: [],
      warnings: [`Critical error: ${errorMessage}`],
    });
  }
});
