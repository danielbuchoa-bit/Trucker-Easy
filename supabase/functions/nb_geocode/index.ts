import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * NextBillion Geocode API
 * Forward geocoding: convert address/query to coordinates
 * Docs: https://docs.nextbillion.ai/places/geocoding/forward-api
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, limit = 5, lat, lng } = await req.json();

    if (!query) {
      return new Response(
        JSON.stringify({ error: "query is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("NEXTBILLION_API_KEY");
    if (!apiKey) {
      console.error("[nb_geocode] NEXTBILLION_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // NextBillion Forward Geocode API
    const url = new URL("https://api.nextbillion.io/geocode");
    url.searchParams.set("q", query);
    url.searchParams.set("limit", String(limit * 2)); // Request more to filter by proximity
    url.searchParams.set("key", apiKey);
    
    // Add location bias if user location is provided
    if (lat !== undefined && lng !== undefined) {
      // Use 'at' parameter for location biasing (format: lat,lng)
      url.searchParams.set("at", `${lat},${lng}`);
      console.log(`[nb_geocode] Using location bias: ${lat},${lng}`);
    }

    console.log("[nb_geocode] Calling NextBillion geocode:", query);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (!response.ok) {
      console.error("[nb_geocode] NextBillion error:", data);
      return new Response(
        JSON.stringify({ 
          error: data.message || "Geocoding failed", 
          status: response.status 
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Transform NextBillion response to our format
    let results = (data.items || []).map((item: any) => {
      const resultLat = item.position?.lat;
      const resultLng = item.position?.lng;
      
      // Calculate distance from user if location provided
      let distanceMeters: number | undefined;
      if (lat !== undefined && lng !== undefined && resultLat && resultLng) {
        distanceMeters = calculateDistance(lat, lng, resultLat, resultLng);
      }
      
      return {
        id: item.id || `${resultLat}-${resultLng}`,
        title: item.title || item.address?.label || "Unknown",
        address: item.address?.label || formatAddress(item.address),
        lat: resultLat,
        lng: resultLng,
        city: item.address?.city,
        state: item.address?.state || item.address?.stateCode,
        country: item.address?.countryName || item.address?.countryCode,
        distanceMeters,
      };
    });
    
    // Sort by distance if user location was provided
    if (lat !== undefined && lng !== undefined) {
      results = results
        .filter((r: any) => r.distanceMeters !== undefined)
        .sort((a: any, b: any) => (a.distanceMeters || Infinity) - (b.distanceMeters || Infinity))
        .slice(0, limit);
      console.log(`[nb_geocode] Sorted by proximity, closest: ${results[0]?.distanceMeters?.toFixed(0)}m`);
    } else {
      results = results.slice(0, limit);
    }

    console.log(`[nb_geocode] Found ${results.length} results for "${query}"`);

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[nb_geocode] Error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Calculate distance between two points in meters (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

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
