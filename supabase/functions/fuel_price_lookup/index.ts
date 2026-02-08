import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Regional average diesel prices (cents) - fallback
const REGIONAL_AVERAGES: Record<string, number> = {
  northeast: 425, southeast: 389, midwest: 379,
  southwest: 385, west: 445, northwest: 415, default: 399,
};

function getRegionalPrice(lat: number, lng: number): number {
  if (lat > 40 && lng > -80) return REGIONAL_AVERAGES.northeast;
  if (lat < 35 && lng > -90) return REGIONAL_AVERAGES.southeast;
  if (lat > 35 && lng > -100 && lng < -80) return REGIONAL_AVERAGES.midwest;
  if (lat < 37 && lng < -95 && lng > -115) return REGIONAL_AVERAGES.southwest;
  if (lng < -115) return REGIONAL_AVERAGES.west;
  if (lat > 42 && lng < -110) return REGIONAL_AVERAGES.northwest;
  return REGIONAL_AVERAGES.default;
}

// In-memory cache (edge function instance)
const priceCache = new Map<string, { price: number; source: string; ts: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 min

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(3)}_${lng.toFixed(3)}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { lat, lng, place_id, place_name } = await req.json();

    if (!lat || !lng) {
      return new Response(
        JSON.stringify({ error: "lat and lng required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Check in-memory cache
    const ck = cacheKey(lat, lng);
    const cached = priceCache.get(ck);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return new Response(
        JSON.stringify({ diesel_price_cents: cached.price, source: cached.source }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 2. Check DB for recent price (within ~5 miles / 0.07 degrees, last 24h)
    const { data: dbPrice } = await supabase
      .from("fuel_prices")
      .select("diesel_price_cents, source, updated_at, place_name")
      .gte("lat", lat - 0.07)
      .lte("lat", lat + 0.07)
      .gte("lng", lng - 0.07)
      .lte("lng", lng + 0.07)
      .gte("updated_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (dbPrice) {
      priceCache.set(ck, { price: dbPrice.diesel_price_cents, source: dbPrice.source, ts: Date.now() });
      return new Response(
        JSON.stringify({ diesel_price_cents: dbPrice.diesel_price_cents, source: dbPrice.source }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Try GasBuddy API
    const gasbuddyKey = Deno.env.get("GASBUDDY_API_KEY");
    if (gasbuddyKey) {
      try {
        const gbUrl = `https://api.gasbuddy.com/v1/stations/nearby?lat=${lat}&lng=${lng}&fuel_type=diesel&radius=5&limit=3`;
        const gbRes = await fetch(gbUrl, {
          headers: { "Authorization": `Bearer ${gasbuddyKey}`, "Accept": "application/json" },
        });

        if (gbRes.ok) {
          const gbData = await gbRes.json();
          const stations = gbData.stations || gbData.results || [];
          if (stations.length > 0) {
            // Find diesel price from first station
            const station = stations[0];
            const dieselPrice = station.diesel_price || station.prices?.diesel;
            if (dieselPrice) {
              const priceCents = Math.round(dieselPrice * 100);
              
              // Save to DB
              await supabase.from("fuel_prices").upsert({
                place_id: place_id || `gb-${station.id || lat.toFixed(4)}-${lng.toFixed(4)}`,
                place_name: place_name || station.name || "GasBuddy Station",
                lat, lng,
                diesel_price_cents: priceCents,
                source: "gasbuddy",
              }, { onConflict: "place_id" });

              priceCache.set(ck, { price: priceCents, source: "gasbuddy", ts: Date.now() });
              return new Response(
                JSON.stringify({ diesel_price_cents: priceCents, source: "gasbuddy" }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          }
        } else {
          console.warn("[fuel_price] GasBuddy API error:", gbRes.status);
        }
      } catch (gbErr) {
        console.error("[fuel_price] GasBuddy fetch error:", gbErr);
      }
    }

    // 4. Fallback to regional estimate
    const regionalPrice = getRegionalPrice(lat, lng);
    priceCache.set(ck, { price: regionalPrice, source: "estimate", ts: Date.now() });

    return new Response(
      JSON.stringify({ diesel_price_cents: regionalPrice, source: "estimate" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[fuel_price] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
