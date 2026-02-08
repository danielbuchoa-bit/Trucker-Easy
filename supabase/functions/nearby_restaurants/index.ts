import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Nearby Restaurant Search - specifically for food suggestion prompts.
 * Unlike nb_browse_pois (which blocks restaurants), this function
 * searches for actual restaurants/food places near a given coordinate
 * using NextBillion.ai Discover API with food-related search terms.
 * 
 * Returns raw restaurant names found within the specified radius.
 */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { lat, lng, radiusMeters = 500 } = await req.json();

    if (lat === undefined || lng === undefined) {
      return new Response(
        JSON.stringify({ error: "lat and lng are required", restaurants: [] }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const nbApiKey = Deno.env.get("NEXTBILLION_API_KEY");
    if (!nbApiKey) {
      console.error("[nearby_restaurants] NEXTBILLION_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "API key not configured", restaurants: [] }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[nearby_restaurants] Searching at ${lat.toFixed(5)},${lng.toFixed(5)} radius=${radiusMeters}m`);

    const searchTerms = ["restaurant", "food", "fast food", "pizza", "grill"];
    const seenIds = new Set<string>();
    const allPois: any[] = [];

    // Search with multiple food-related terms
    for (const term of searchTerms) {
      try {
        const url = new URL("https://api.nextbillion.io/discover");
        url.searchParams.set("key", nbApiKey);
        url.searchParams.set("at", `${lat},${lng}`);
        url.searchParams.set("q", term);
        url.searchParams.set("limit", "20");
        url.searchParams.set("in", `circle:${lat},${lng};r=${radiusMeters}`);

        const response = await fetch(url.toString());
        
        if (response.status === 429) {
          console.warn(`[nearby_restaurants] Rate limited on term: ${term}`);
          break;
        }

        const data = await response.json();
        
        if (response.ok && data.items?.length > 0) {
          for (const item of data.items) {
            const id = item.id || `${item.position?.lat}-${item.position?.lng}`;
            if (!seenIds.has(id)) {
              seenIds.add(id);
              
              // Calculate distance
              const itemLat = item.position?.lat || item.lat;
              const itemLng = item.position?.lng || item.lng;
              const dist = haversineDistance(lat, lng, itemLat, itemLng);
              
              // Only include POIs actually within the radius
              if (dist <= radiusMeters) {
                allPois.push({
                  name: item.title || item.name || '',
                  distance: Math.round(dist),
                  lat: itemLat,
                  lng: itemLng,
                  categories: item.categories || [],
                  _searchTerm: term,
                });
              }
            }
          }
        }
      } catch (err) {
        console.warn(`[nearby_restaurants] Error searching "${term}":`, err);
      }
    }

    // Sort by distance
    allPois.sort((a, b) => a.distance - b.distance);

    // Deduplicate by similar names
    const uniqueRestaurants: any[] = [];
    const seenNames = new Set<string>();
    for (const poi of allPois) {
      const normalized = poi.name.toLowerCase().trim();
      if (normalized && !seenNames.has(normalized)) {
        seenNames.add(normalized);
        uniqueRestaurants.push(poi);
      }
    }

    const restaurantNames = uniqueRestaurants.map(r => r.name).filter(Boolean);
    
    console.log(`[nearby_restaurants] Found ${restaurantNames.length} restaurants:`, restaurantNames);

    return new Response(
      JSON.stringify({
        restaurants: restaurantNames,
        details: uniqueRestaurants,
        count: restaurantNames.length,
        center: { lat, lng },
        radiusMeters,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[nearby_restaurants] Error:", message);
    return new Response(
      JSON.stringify({ restaurants: [], error: message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
