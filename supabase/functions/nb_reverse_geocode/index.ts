import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * NextBillion Reverse Geocode API
 * Convert coordinates to address
 * Docs: https://docs.nextbillion.ai/places/geocoding/reverse-api
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { lat, lng } = await req.json();

    if (lat === undefined || lng === undefined) {
      return new Response(
        JSON.stringify({ error: "lat and lng are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("NEXTBILLION_API_KEY");
    if (!apiKey) {
      console.error("[nb_reverse_geocode] NEXTBILLION_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // NextBillion Reverse Geocode API
    const url = new URL("https://api.nextbillion.io/revgeocode");
    url.searchParams.set("at", `${lat},${lng}`);
    url.searchParams.set("key", apiKey);

    console.log(`[nb_reverse_geocode] Calling NextBillion revgeocode: ${lat},${lng}`);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (!response.ok) {
      console.error("[nb_reverse_geocode] NextBillion error:", data);
      return new Response(
        JSON.stringify({ 
          error: data.message || "Reverse geocoding failed", 
          status: response.status 
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the first (closest) result
    const item = data.items?.[0];

    if (!item) {
      console.log("[nb_reverse_geocode] No results found");
      return new Response(
        JSON.stringify({ 
          road: null,
          city: null,
          state: null,
          stateCode: null,
          country: null,
          postalCode: null,
          label: null,
          speedLimit: null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const address = item.address || {};

    const result = {
      road: address.street || null,
      city: address.city || null,
      state: address.state || null,
      stateCode: address.stateCode || null,
      country: address.countryName || address.countryCode || null,
      postalCode: address.postalCode || null,
      label: address.label || item.title || null,
      speedLimit: item.speedLimit || null,
      houseNumber: address.houseNumber || null,
      county: address.county || null,
      distance: item.distance || null,
      position: item.position || { lat, lng },
    };

    console.log(`[nb_reverse_geocode] Found: ${result.label || result.road || 'unknown'}`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[nb_reverse_geocode] Error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
