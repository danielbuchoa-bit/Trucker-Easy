import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BrowsePoisRequest {
  lat: number;
  lng: number;
  heading?: number;
  radiusMeters?: number;
  categories?: string[];
  type?: 'FUEL' | 'TRUCK_STOP' | 'RESTAURANT';
  limit?: number;
}

// HERE category IDs
const HERE_CATEGORIES = {
  FUEL: ['700-7600-0116'],           // Fuel / Gas Station
  TRUCK_STOP: ['700-7850-0000'],     // Truck Stop / Service Area
  RESTAURANT: ['100-1000-0000'],     // Restaurant
};

// Fallback query terms
const QUERY_MAP = {
  FUEL: 'fuel',
  TRUCK_STOP: 'truck stop',
  RESTAURANT: 'restaurant',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const HERE_API_KEY = Deno.env.get('HERE_API_KEY');
    if (!HERE_API_KEY) {
      console.error('HERE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'HERE API not configured', pois: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
      return new Response(
        JSON.stringify({ error: 'lat and lng are required', pois: [] }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Browse POIs request:', { lat, lng, heading, radiusMeters, categories, type });

    // Determine categories to use
    let categoryIds: string[];
    let poiType: 'FUEL' | 'TRUCK_STOP' | 'RESTAURANT' | null = null;

    if (type && HERE_CATEGORIES[type]) {
      categoryIds = HERE_CATEGORIES[type];
      poiType = type;
    } else if (categories) {
      categoryIds = Array.isArray(categories) ? categories : [categories];
    } else {
      // Default: all truck-related categories
      categoryIds = [...HERE_CATEGORIES.FUEL, ...HERE_CATEGORIES.TRUCK_STOP];
    }

    let items: any[] = [];

    // 1️⃣ Primary search – CATEGORY MODE (HERE-compliant)
    try {
      const primaryUrl = new URL('https://discover.search.hereapi.com/v1/discover');
      primaryUrl.searchParams.set('at', `${lat},${lng}`);
      primaryUrl.searchParams.set('limit', limit.toString());
      primaryUrl.searchParams.set('in', `circle:${lat},${lng};r=${radiusMeters}`);
      primaryUrl.searchParams.set('categories', categoryIds.join(','));
      primaryUrl.searchParams.set('apiKey', HERE_API_KEY);

      console.log('[HERE_BROWSE_POIS] Primary URL:', primaryUrl.toString().replace(HERE_API_KEY, '***'));

      const primaryRes = await fetch(primaryUrl.toString());
      const primaryData = await primaryRes.json();

      if (primaryRes.ok && primaryData?.items?.length > 0) {
        console.log('[HERE_BROWSE_POIS] Primary search returned:', primaryData.items.length, 'results');
        items = primaryData.items;
      } else {
        console.log('[HERE_BROWSE_POIS] Primary search returned no results, trying fallback');
      }
    } catch (primaryErr) {
      console.error('[HERE_BROWSE_POIS] Primary search failed:', primaryErr);
    }

    // 2️⃣ FALLBACK – QUERY MODE (never fails)
    if (items.length === 0 && poiType && QUERY_MAP[poiType]) {
      try {
        const fallbackUrl = new URL('https://discover.search.hereapi.com/v1/discover');
        fallbackUrl.searchParams.set('at', `${lat},${lng}`);
        fallbackUrl.searchParams.set('limit', limit.toString());
        fallbackUrl.searchParams.set('in', `circle:${lat},${lng};r=${radiusMeters}`);
        fallbackUrl.searchParams.set('q', QUERY_MAP[poiType]);
        fallbackUrl.searchParams.set('apiKey', HERE_API_KEY);

        console.log('[HERE_BROWSE_POIS] Fallback URL:', fallbackUrl.toString().replace(HERE_API_KEY, '***'));

        const fallbackRes = await fetch(fallbackUrl.toString());
        const fallbackData = await fallbackRes.json();

        if (fallbackRes.ok && fallbackData?.items) {
          console.log('[HERE_BROWSE_POIS] Fallback search returned:', fallbackData.items.length, 'results');
          items = fallbackData.items;
        }
      } catch (fallbackErr) {
        console.error('[HERE_BROWSE_POIS] Fallback search failed:', fallbackErr);
      }
    }

    // Calculate bearing between two points
    function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
      const toRad = (deg: number) => (deg * Math.PI) / 180;
      const toDeg = (rad: number) => (rad * 180) / Math.PI;
      
      const dLng = toRad(lng2 - lng1);
      const lat1Rad = toRad(lat1);
      const lat2Rad = toRad(lat2);
      
      const y = Math.sin(dLng) * Math.cos(lat2Rad);
      const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
                Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
      
      const bearing = toDeg(Math.atan2(y, x));
      return ((bearing % 360) + 360) % 360;
    }

    // Calculate distance in meters
    function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
      const R = 6371000;
      const toRad = (deg: number) => (deg * Math.PI) / 180;
      const dLat = toRad(lat2 - lat1);
      const dLng = toRad(lng2 - lng1);
      const a = Math.sin(dLat / 2) ** 2 + 
                Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    // Check if bearing is within cone (±60 degrees of heading)
    function isWithinCone(poiBearing: number, heading: number, coneAngle: number = 60): boolean {
      let diff = Math.abs(poiBearing - heading);
      if (diff > 180) diff = 360 - diff;
      return diff <= coneAngle;
    }

    // Map category IDs to friendly types
    function getCategoryType(categories: any[]): string {
      for (const cat of categories || []) {
        const id = cat.id || '';
        if (id.includes('7850')) return 'truck_stop';
        if (id.includes('7600')) return 'fuel';
        if (id.includes('1000')) return 'restaurant';
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

    // Filter by heading cone if heading is provided
    if (heading !== undefined && heading !== null) {
      results = results.filter((poi: any) => isWithinCone(poi.bearing, heading, 60));
    }

    // Sort by distance
    results.sort((a: any, b: any) => a.distance - b.distance);

    // Limit results
    results = results.slice(0, limit);

    console.log('[HERE_BROWSE_POIS] Final results:', results.length);

    return new Response(
      JSON.stringify({ pois: results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    // 3️⃣ HARD FAIL SAFE MODE – NEVER BREAK UI
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[HERE_BROWSE_POIS] Critical error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage, pois: [] }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
