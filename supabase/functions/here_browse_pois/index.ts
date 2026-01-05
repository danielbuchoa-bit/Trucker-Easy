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

// Query fallback map (for categories without confirmed IDs)
const QUERY_FALLBACK_MAP: Record<string, string> = {
  'truck_stop': 'truck stop',
  'truck-stop': 'truck stop',
  'truckstop': 'truck stop',
  'restaurant': 'restaurant',
  'food': 'restaurant',
  'rest_area': 'rest area',
  'rest-area': 'rest area',
  'weigh_station': 'weigh station',
  'weigh-station': 'weigh station',
};

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

    // Map slugs to HERE IDs
    const validHereIds: string[] = [];
    const queryFallbacks: string[] = [];
    const invalidCategories: string[] = [];

    for (const cat of inputCategories) {
      const normalized = cat.toLowerCase().trim();
      
      if (CATEGORY_MAP[normalized]) {
        validHereIds.push(...CATEGORY_MAP[normalized]);
      } else if (QUERY_FALLBACK_MAP[normalized]) {
        queryFallbacks.push(QUERY_FALLBACK_MAP[normalized]);
      } else {
        invalidCategories.push(cat);
      }
    }

    // Handle type parameter as shortcut
    if (type) {
      switch (type) {
        case 'FUEL':
          if (!validHereIds.includes('700-7600-0116')) {
            validHereIds.push('700-7600-0116');
          }
          break;
        case 'TRUCK_STOP':
          if (!queryFallbacks.includes('truck stop')) {
            queryFallbacks.push('truck stop');
          }
          break;
        case 'RESTAURANT':
          if (!queryFallbacks.includes('restaurant')) {
            queryFallbacks.push('restaurant');
          }
          break;
      }
    }

    // Deduplicate
    const uniqueHereIds = [...new Set(validHereIds)];
    const uniqueQueryFallbacks = [...new Set(queryFallbacks)];

    if (invalidCategories.length > 0) {
      console.log('[HERE_BROWSE_POIS] ⚠️ Invalid categories ignored:', invalidCategories);
    }

    // ============================================
    // 2️⃣ Attempt A: Category-based search
    // ============================================
    let items: any[] = [];
    let mode: 'categories' | 'query_fallback' = 'categories';
    const warnings: string[] = [];

    if (uniqueHereIds.length > 0) {
      try {
        const categoryUrl = new URL('https://discover.search.hereapi.com/v1/discover');
        categoryUrl.searchParams.set('at', `${lat},${lng}`);
        categoryUrl.searchParams.set('limit', limit.toString());
        categoryUrl.searchParams.set('in', `circle:${lat},${lng};r=${radiusMeters}`);
        categoryUrl.searchParams.set('categories', uniqueHereIds.join(','));
        categoryUrl.searchParams.set('apiKey', HERE_API_KEY);

        const safeUrl = categoryUrl.toString().replace(HERE_API_KEY, '***');
        console.log('[HERE_BROWSE_POIS] 🔍 Category search:', safeUrl);

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
    } else {
      console.log('[HERE_BROWSE_POIS] ℹ️ No valid category IDs, skipping category search');
      if (invalidCategories.length > 0) {
        console.log('[HERE_BROWSE_POIS] categories_invalid_fallback_to_query');
      }
    }

    // ============================================
    // 3️⃣ Attempt B: Query fallback
    // ============================================
    if (items.length === 0) {
      // Determine query term
      let queryTerm = uniqueQueryFallbacks[0] || null;
      
      // If no explicit fallback, infer from original input
      if (!queryTerm && inputCategories.length > 0) {
        const firstCat = inputCategories[0].toLowerCase();
        if (firstCat.includes('fuel') || firstCat.includes('gas') || firstCat.includes('petrol')) {
          queryTerm = 'gas station';
        } else if (firstCat.includes('truck') || firstCat.includes('stop')) {
          queryTerm = 'truck stop';
        } else if (firstCat.includes('restaurant') || firstCat.includes('food')) {
          queryTerm = 'restaurant';
        } else if (firstCat.includes('rest')) {
          queryTerm = 'rest area';
        }
      }

      // Default fallback
      if (!queryTerm) {
        queryTerm = 'gas station';
      }

      try {
        const queryUrl = new URL('https://discover.search.hereapi.com/v1/discover');
        queryUrl.searchParams.set('at', `${lat},${lng}`);
        queryUrl.searchParams.set('limit', limit.toString());
        queryUrl.searchParams.set('in', `circle:${lat},${lng};r=${radiusMeters}`);
        queryUrl.searchParams.set('q', queryTerm);
        queryUrl.searchParams.set('apiKey', HERE_API_KEY);

        const safeUrl = queryUrl.toString().replace(HERE_API_KEY, '***');
        console.log('[HERE_BROWSE_POIS] 🔍 Query fallback:', safeUrl);

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
    // 4️⃣ Process results
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

    function getCategoryType(categories: any[]): string {
      for (const cat of categories || []) {
        const id = cat.id || '';
        if (id.includes('7850')) return 'truck_stop';
        if (id.includes('7600')) return 'fuel';
        if (id.includes('1000')) return 'restaurant';
        if (id.includes('5510')) return 'rest_area';
      }
      return 'fuel';
    }

    let results = items.map((item: any) => {
      const poiLat = item.position?.lat;
      const poiLng = item.position?.lng;
      const distance = haversineDistance(lat, lng, poiLat, poiLng);
      const bearingToPoi = calculateBearing(lat, lng, poiLat, poiLng);

      return {
        id: item.id,
        name: item.title,
        lat: poiLat,
        lng: poiLng,
        distance,
        distanceMiles: distance / 1609.34,
        bearing: bearingToPoi,
        category: getCategoryType(item.categories),
        address: item.address?.label || '',
        chainName: item.chains?.[0]?.name || null,
        openingHours: item.openingHours?.[0]?.text || null,
        contacts: item.contacts?.[0]?.phone?.[0]?.value || null,
      };
    });

    // Filter by heading cone if provided
    if (heading !== undefined && heading !== null) {
      results = results.filter((poi: any) => isWithinCone(poi.bearing, heading, 60));
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
    // 5️⃣ HARD FAIL SAFE – NEVER BREAK UI
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
