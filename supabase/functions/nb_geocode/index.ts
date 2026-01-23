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
    const { query, limit = 5 } = await req.json();

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
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("key", apiKey);

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
    const results = (data.items || []).map((item: any) => ({
      id: item.id || `${item.position?.lat}-${item.position?.lng}`,
      title: item.title || item.address?.label || "Unknown",
      address: item.address?.label || formatAddress(item.address),
      lat: item.position?.lat,
      lng: item.position?.lng,
      city: item.address?.city,
      state: item.address?.state || item.address?.stateCode,
      country: item.address?.countryName || item.address?.countryCode,
    }));

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
