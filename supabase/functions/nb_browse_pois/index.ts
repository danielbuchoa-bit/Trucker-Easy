import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * NextBillion Browse POIs API
 * Search for places/POIs near a location
 * Docs: https://docs.nextbillion.ai/places/search/nearby-poi
 * 
 * Note: NextBillion uses different category codes than HERE.
 * We map common trucking categories to NextBillion equivalents.
 */

// Category mapping from HERE to NextBillion/generic
const CATEGORY_MAPPING: Record<string, string[]> = {
  // Truck Stops - use fuel station + parking
  "700-7850-0000": ["fuel_station", "truck_stop", "parking"],
  "700-7850-0115": ["fuel_station", "diesel"],
  // Gas/Petrol Stations
  "700-7600-0000": ["fuel_station", "gas_station"],
  "700-7600-0116": ["fuel_station"],
  "700-7600-0117": ["fuel_station"],
  "700-7600-0324": ["fuel_station"],
  // Rest Areas
  "700-7900-0000": ["rest_area", "parking"],
  // Restaurants
  "550-5510-0000": ["restaurant", "food"],
  "550-5510-0358": ["restaurant", "fast_food"],
  // Generic fallback
  "fuel-station": ["fuel_station"],
  "truck-stop": ["truck_stop", "fuel_station"],
  "rest-area": ["rest_area", "parking"],
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { 
      lat, 
      lng, 
      radius = 32000, // Default 20 miles in meters
      radiusMeters,
      categories = [],
      limit = 20 
    } = body;

    if (lat === undefined || lng === undefined) {
      return new Response(
        JSON.stringify({ error: "lat and lng are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("NEXTBILLION_API_KEY");
    if (!apiKey) {
      console.error("[nb_browse_pois] NEXTBILLION_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const searchRadius = radiusMeters || radius;

    // Map categories to NextBillion format
    const mappedCategories = new Set<string>();
    if (Array.isArray(categories) && categories.length > 0) {
      categories.forEach((cat: string) => {
        const mapped = CATEGORY_MAPPING[cat];
        if (mapped) {
          mapped.forEach(c => mappedCategories.add(c));
        } else {
          // Try to use the category directly if it's a simple string
          mappedCategories.add(cat.replace(/-/g, '_'));
        }
      });
    } else {
      // Default to truck-relevant POIs
      mappedCategories.add("fuel_station");
      mappedCategories.add("truck_stop");
      mappedCategories.add("rest_area");
      mappedCategories.add("parking");
    }

    console.log(`[nb_browse_pois] Searching near ${lat},${lng} radius=${searchRadius}m categories=${Array.from(mappedCategories).join(',')}`);

    // NextBillion Nearby Search API
    // Note: NextBillion's POI search uses a different approach
    // We'll use their search endpoint with location bias
    const url = new URL("https://api.nextbillion.io/autosuggest");
    url.searchParams.set("at", `${lat},${lng}`);
    url.searchParams.set("q", Array.from(mappedCategories).slice(0, 3).join(" ")); // Use categories as search terms
    url.searchParams.set("limit", String(Math.min(limit, 100)));
    url.searchParams.set("key", apiKey);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (!response.ok) {
      console.error("[nb_browse_pois] NextBillion error:", data);
      
      // Return empty results instead of error for graceful degradation
      return new Response(
        JSON.stringify({ 
          pois: [], 
          items: [],
          message: "No POIs found in this area"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Transform results
    const pois = (data.items || [])
      .filter((item: any) => {
        // Filter by distance
        if (item.distance && item.distance > searchRadius) return false;
        return true;
      })
      .map((item: any) => ({
        id: item.id || `${item.position?.lat}-${item.position?.lng}`,
        title: item.title || item.address?.label || "Unknown",
        name: item.title || item.address?.label || "Unknown",
        address: {
          label: item.address?.label || formatAddress(item.address),
          street: item.address?.street,
          city: item.address?.city,
          state: item.address?.state || item.address?.stateCode,
          postalCode: item.address?.postalCode,
          country: item.address?.countryName,
        },
        position: item.position || { lat: item.lat, lng: item.lng },
        lat: item.position?.lat || item.lat,
        lng: item.position?.lng || item.lng,
        distance: item.distance || calculateDistance(lat, lng, item.position?.lat, item.position?.lng),
        categories: item.categories || [{ name: "POI" }],
        rating: item.rating || null,
      }))
      .slice(0, limit);

    console.log(`[nb_browse_pois] Found ${pois.length} POIs`);

    return new Response(
      JSON.stringify({ 
        pois, 
        items: pois, // Compatibility with both formats
        count: pois.length 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[nb_browse_pois] Error:", message);
    return new Response(
      JSON.stringify({ 
        pois: [], 
        items: [],
        error: message 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function formatAddress(address: any): string {
  if (!address) return "";
  const parts = [];
  if (address.houseNumber) parts.push(address.houseNumber);
  if (address.street) parts.push(address.street);
  if (address.city) parts.push(address.city);
  if (address.stateCode || address.state) parts.push(address.stateCode || address.state);
  if (address.postalCode) parts.push(address.postalCode);
  return parts.join(", ");
}

function calculateDistance(lat1: number, lng1: number, lat2?: number, lng2?: number): number {
  if (!lat2 || !lng2) return 0;
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}
