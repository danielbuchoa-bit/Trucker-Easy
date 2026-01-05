import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BrowsePoisRequest {
  lat: number;
  lng: number;
  heading?: number; // Optional heading to filter POIs ahead
  radiusMeters?: number;
  categories: string[]; // HERE category IDs
  limit?: number;
}

// HERE Places categories for truck-related POIs
// 700-7600-0000: Fuel/Gas station
// 700-7600-0116: Truck stop
// 550-5510-0000: Rest area
// 700-7850-0000: Truck dealership/services

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const HERE_API_KEY = Deno.env.get('HERE_API_KEY');
    if (!HERE_API_KEY) {
      console.error('HERE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'HERE API not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: BrowsePoisRequest = await req.json();
    const { 
      lat, 
      lng, 
      heading, 
      radiusMeters = 50000, // 50km default
      categories,
      limit = 20 
    } = body;

    if (lat === undefined || lng === undefined) {
      return new Response(
        JSON.stringify({ error: 'lat and lng are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Browse POIs request:', { lat, lng, heading, radiusMeters, categories });

    // Build categories query - HERE uses comma-separated category IDs
    // Handle both array and string formats
    const categoryIds = Array.isArray(categories) ? categories.join(',') : categories;

    const params = new URLSearchParams({
      apiKey: HERE_API_KEY,
      at: `${lat},${lng}`,
      categories: categoryIds,
      limit: limit.toString(),
      in: `circle:${lat},${lng};r=${radiusMeters}`,
    });

    const hereUrl = `https://browse.search.hereapi.com/v1/browse?${params.toString()}`;
    console.log('[HERE_BROWSE_POIS] Service: Places API (Browse/Discover)');
    console.log('[HERE_BROWSE_POIS] Endpoint:', hereUrl.replace(HERE_API_KEY, '***'));

    const response = await fetch(hereUrl);
    const data = await response.json();

    // Diagnostic logging for errors
    if (!response.ok) {
      console.error('[HERE_BROWSE_POIS] ❌ API Error:', {
        status: response.status,
        statusText: response.statusText,
        endpoint: 'browse.search.hereapi.com/v1/browse',
        service: 'Places/Discover',
        error: data?.error || data?.message || data?.title || 'Unknown error',
        cause: data?.cause || null,
      });
      
      // Check for auth/permission issues
      if (response.status === 401 || response.status === 403) {
        console.error('[HERE_BROWSE_POIS] 🔐 AUTH ISSUE: HERE Places/Discover service may not be enabled');
        console.error('[HERE_BROWSE_POIS] Verify in HERE Developer Portal that "Search & Geocoding" is enabled');
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'POI browse failed', 
          status: response.status,
          service: 'Places/Discover',
          details: data 
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
        if (id.includes('7600-0116') || id.includes('truck-stop')) return 'truck_stop';
        if (id.includes('7600')) return 'fuel';
        if (id.includes('5510')) return 'rest_area';
        if (id.includes('7850')) return 'truck_service';
      }
      return 'fuel';
    }

    let results = data.items?.map((item: any) => {
      const poiLat = item.position?.lat;
      const poiLng = item.position?.lng;
      const distance = haversineDistance(lat, lng, poiLat, poiLng);
      const bearingToPoi = calculateBearing(lat, lng, poiLat, poiLng);

      return {
        id: item.id,
        name: item.title,
        lat: poiLat,
        lng: poiLng,
        distance, // meters
        distanceMiles: distance / 1609.34,
        bearing: bearingToPoi,
        category: getCategoryType(item.categories),
        address: item.address?.label || '',
        chainName: item.chains?.[0]?.name || null,
        openingHours: item.openingHours?.[0]?.text || null,
        contacts: item.contacts?.[0]?.phone?.[0]?.value || null,
      };
    }) || [];

    // Filter by heading cone if heading is provided
    if (heading !== undefined && heading !== null) {
      results = results.filter((poi: any) => isWithinCone(poi.bearing, heading, 60));
    }

    // Sort by distance
    results.sort((a: any, b: any) => a.distance - b.distance);

    // Limit results
    results = results.slice(0, limit);

    console.log('POI results:', results.length);

    return new Response(
      JSON.stringify({ pois: results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in here_browse_pois:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
