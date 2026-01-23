import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * NextBillion Browse/Discover POIs API
 * Search for places/POIs near a location using NextBillion's Browse and Discover APIs
 * 
 * Docs: 
 * - Browse API: https://docs.nextbillion.ai/places/search/search-places-api#browse-api
 * - Discover API: https://docs.nextbillion.ai/places/search/search-places-api#discover-api
 */

// NextBillion category mapping for truck-relevant POIs
const NB_CATEGORIES = {
  fuel: ["fuel-station", "gas-station", "petrol-station"],
  truckStop: ["truck-stop", "fuel-station", "parking"],
  restArea: ["rest-area", "parking-lot"],
  restaurant: ["restaurant", "fast-food", "food"],
  parking: ["parking", "parking-lot"],
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
      query,
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
        JSON.stringify({ error: "API key not configured", pois: [], items: [] }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const searchRadius = radiusMeters || radius;
    const radiusKm = Math.round(searchRadius / 1000);

    console.log(`[nb_browse_pois] Searching near ${lat},${lng} radius=${searchRadius}m`);

    // Strategy: Use multiple search methods to get comprehensive results
    const allPois: any[] = [];
    const seenIds = new Set<string>();

    // 1. Try Browse API with truck-relevant categories
    const browseCategories = ["fuel-station", "parking", "restaurant"];
    
    for (const category of browseCategories) {
      try {
        const browseUrl = new URL("https://api.nextbillion.io/browse");
        browseUrl.searchParams.set("key", apiKey);
        browseUrl.searchParams.set("at", `${lat},${lng}`);
        browseUrl.searchParams.set("categories", category);
        browseUrl.searchParams.set("limit", String(Math.min(limit, 50)));
        browseUrl.searchParams.set("in", `circle:${lat},${lng};r=${radiusKm > 0 ? radiusKm * 1000 : 50000}`);

        console.log(`[nb_browse_pois] Browse request: ${browseUrl.toString().replace(apiKey, '***')}`);
        
        const response = await fetch(browseUrl.toString());
        const data = await response.json();

        if (response.ok && data.items) {
          console.log(`[nb_browse_pois] Browse ${category}: ${data.items.length} results`);
          data.items.forEach((item: any) => {
            const id = item.id || `${item.position?.lat}-${item.position?.lng}`;
            if (!seenIds.has(id)) {
              seenIds.add(id);
              allPois.push({
                ...item,
                _source: 'browse',
                _category: category,
              });
            }
          });
        } else {
          console.warn(`[nb_browse_pois] Browse ${category} failed:`, data);
        }
      } catch (err) {
        console.warn(`[nb_browse_pois] Browse ${category} error:`, err);
      }
    }

    // 2. Try Discover API with truck-related search terms
    const searchTerms = query ? [query] : ["truck stop", "fuel station", "gas station", "rest area"];
    
    for (const term of searchTerms.slice(0, 2)) { // Limit to avoid rate limiting
      try {
        const discoverUrl = new URL("https://api.nextbillion.io/discover");
        discoverUrl.searchParams.set("key", apiKey);
        discoverUrl.searchParams.set("at", `${lat},${lng}`);
        discoverUrl.searchParams.set("q", term);
        discoverUrl.searchParams.set("limit", String(Math.min(limit, 20)));
        discoverUrl.searchParams.set("in", "countryCode:USA,CAN,MEX");

        console.log(`[nb_browse_pois] Discover request: ${term}`);
        
        const response = await fetch(discoverUrl.toString());
        const data = await response.json();

        if (response.ok && data.items) {
          console.log(`[nb_browse_pois] Discover "${term}": ${data.items.length} results`);
          data.items.forEach((item: any) => {
            const id = item.id || `${item.position?.lat}-${item.position?.lng}`;
            if (!seenIds.has(id)) {
              seenIds.add(id);
              allPois.push({
                ...item,
                _source: 'discover',
                _searchTerm: term,
              });
            }
          });
        } else {
          console.warn(`[nb_browse_pois] Discover "${term}" failed:`, data);
        }
      } catch (err) {
        console.warn(`[nb_browse_pois] Discover "${term}" error:`, err);
      }
    }

    // Transform and sort results by distance
    const pois = allPois
      .map((item: any) => {
        const itemLat = item.position?.lat || item.lat;
        const itemLng = item.position?.lng || item.lng;
        const distance = calculateDistance(lat, lng, itemLat, itemLng);
        
        return {
          id: item.id || `${itemLat}-${itemLng}`,
          title: item.title || item.address?.label || "Unknown",
          name: item.title || item.address?.label || "Unknown",
          address: {
            label: item.address?.label || formatAddress(item.address),
            street: item.address?.street,
            city: item.address?.city,
            state: item.address?.state || item.address?.stateCode,
            postalCode: item.address?.postalCode,
            country: item.address?.countryName || item.address?.countryCode,
          },
          position: { lat: itemLat, lng: itemLng },
          lat: itemLat,
          lng: itemLng,
          distance: item.distance || distance,
          categories: item.categories || [{ name: item._category || "POI" }],
          rating: item.rating || null,
          _source: item._source,
        };
      })
      .filter((poi: any) => poi.lat && poi.lng)
      .filter((poi: any) => poi.distance <= searchRadius)
      .sort((a: any, b: any) => a.distance - b.distance)
      .slice(0, limit);

    console.log(`[nb_browse_pois] Total unique POIs: ${pois.length}`);

    return new Response(
      JSON.stringify({ 
        pois, 
        items: pois,
        count: pois.length,
        searchRadius,
        center: { lat, lng },
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
  if (!lat2 || !lng2) return 999999;
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
