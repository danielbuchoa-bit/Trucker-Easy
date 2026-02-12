import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// State code lookup from lat/lng (approximate boundaries)
function getStateFromCoords(lat: number, lng: number): string | null {
  // Major US states with approximate bounding boxes
  const states: { code: string; minLat: number; maxLat: number; minLng: number; maxLng: number }[] = [
    { code: "AL", minLat: 30.2, maxLat: 35.0, minLng: -88.5, maxLng: -84.9 },
    { code: "AZ", minLat: 31.3, maxLat: 37.0, minLng: -114.8, maxLng: -109.0 },
    { code: "AR", minLat: 33.0, maxLat: 36.5, minLng: -94.6, maxLng: -89.6 },
    { code: "CA", minLat: 32.5, maxLat: 42.0, minLng: -124.4, maxLng: -114.1 },
    { code: "CO", minLat: 37.0, maxLat: 41.0, minLng: -109.1, maxLng: -102.0 },
    { code: "CT", minLat: 41.0, maxLat: 42.1, minLng: -73.7, maxLng: -71.8 },
    { code: "DE", minLat: 38.5, maxLat: 39.8, minLng: -75.8, maxLng: -75.0 },
    { code: "FL", minLat: 24.5, maxLat: 31.0, minLng: -87.6, maxLng: -80.0 },
    { code: "GA", minLat: 30.4, maxLat: 35.0, minLng: -85.6, maxLng: -80.8 },
    { code: "ID", minLat: 42.0, maxLat: 49.0, minLng: -117.2, maxLng: -111.0 },
    { code: "IL", minLat: 37.0, maxLat: 42.5, minLng: -91.5, maxLng: -87.5 },
    { code: "IN", minLat: 37.8, maxLat: 41.8, minLng: -88.1, maxLng: -84.8 },
    { code: "IA", minLat: 40.4, maxLat: 43.5, minLng: -96.6, maxLng: -90.1 },
    { code: "KS", minLat: 37.0, maxLat: 40.0, minLng: -102.1, maxLng: -94.6 },
    { code: "KY", minLat: 36.5, maxLat: 39.1, minLng: -89.6, maxLng: -82.0 },
    { code: "LA", minLat: 29.0, maxLat: 33.0, minLng: -94.0, maxLng: -89.0 },
    { code: "ME", minLat: 43.1, maxLat: 47.5, minLng: -71.1, maxLng: -66.9 },
    { code: "MD", minLat: 38.0, maxLat: 39.7, minLng: -79.5, maxLng: -75.0 },
    { code: "MA", minLat: 41.2, maxLat: 42.9, minLng: -73.5, maxLng: -69.9 },
    { code: "MI", minLat: 41.7, maxLat: 48.3, minLng: -90.4, maxLng: -82.4 },
    { code: "MN", minLat: 43.5, maxLat: 49.4, minLng: -97.2, maxLng: -89.5 },
    { code: "MS", minLat: 30.2, maxLat: 35.0, minLng: -91.7, maxLng: -88.1 },
    { code: "MO", minLat: 36.0, maxLat: 40.6, minLng: -95.8, maxLng: -89.1 },
    { code: "MT", minLat: 44.4, maxLat: 49.0, minLng: -116.0, maxLng: -104.0 },
    { code: "NE", minLat: 40.0, maxLat: 43.0, minLng: -104.1, maxLng: -95.3 },
    { code: "NV", minLat: 35.0, maxLat: 42.0, minLng: -120.0, maxLng: -114.0 },
    { code: "NH", minLat: 42.7, maxLat: 45.3, minLng: -72.6, maxLng: -70.7 },
    { code: "NJ", minLat: 39.0, maxLat: 41.4, minLng: -75.6, maxLng: -73.9 },
    { code: "NM", minLat: 31.3, maxLat: 37.0, minLng: -109.0, maxLng: -103.0 },
    { code: "NY", minLat: 40.5, maxLat: 45.0, minLng: -79.8, maxLng: -71.9 },
    { code: "NC", minLat: 33.8, maxLat: 36.6, minLng: -84.3, maxLng: -75.5 },
    { code: "ND", minLat: 45.9, maxLat: 49.0, minLng: -104.0, maxLng: -96.6 },
    { code: "OH", minLat: 38.4, maxLat: 42.0, minLng: -84.8, maxLng: -80.5 },
    { code: "OK", minLat: 33.6, maxLat: 37.0, minLng: -103.0, maxLng: -94.4 },
    { code: "OR", minLat: 42.0, maxLat: 46.3, minLng: -124.6, maxLng: -116.5 },
    { code: "PA", minLat: 39.7, maxLat: 42.3, minLng: -80.5, maxLng: -74.7 },
    { code: "RI", minLat: 41.1, maxLat: 42.0, minLng: -71.9, maxLng: -71.1 },
    { code: "SC", minLat: 32.0, maxLat: 35.2, minLng: -83.4, maxLng: -78.5 },
    { code: "SD", minLat: 42.5, maxLat: 45.9, minLng: -104.1, maxLng: -96.4 },
    { code: "TN", minLat: 35.0, maxLat: 36.7, minLng: -90.3, maxLng: -81.6 },
    { code: "TX", minLat: 25.8, maxLat: 36.5, minLng: -106.6, maxLng: -93.5 },
    { code: "UT", minLat: 37.0, maxLat: 42.0, minLng: -114.1, maxLng: -109.0 },
    { code: "VT", minLat: 42.7, maxLat: 45.0, minLng: -73.4, maxLng: -71.5 },
    { code: "VA", minLat: 36.5, maxLat: 39.5, minLng: -83.7, maxLng: -75.2 },
    { code: "WA", minLat: 45.5, maxLat: 49.0, minLng: -124.8, maxLng: -116.9 },
    { code: "WV", minLat: 37.2, maxLat: 40.6, minLng: -82.6, maxLng: -77.7 },
    { code: "WI", minLat: 42.5, maxLat: 47.1, minLng: -92.9, maxLng: -86.8 },
    { code: "WY", minLat: 41.0, maxLat: 45.0, minLng: -111.1, maxLng: -104.1 },
  ];

  for (const s of states) {
    if (lat >= s.minLat && lat <= s.maxLat && lng >= s.minLng && lng <= s.maxLng) {
      return s.code;
    }
  }
  return null;
}

// PADD region mapping for EIA API fallback
function getPaddRegion(stateCode: string): string {
  const padd1a = ["CT", "ME", "MA", "NH", "RI", "VT"]; // New England
  const padd1b = ["DE", "DC", "MD", "NJ", "NY", "PA"]; // Central Atlantic
  const padd1c = ["FL", "GA", "NC", "SC", "VA", "WV"]; // Lower Atlantic
  const padd2 = ["IL", "IN", "IA", "KS", "KY", "MI", "MN", "MO", "NE", "ND", "OH", "OK", "SD", "TN", "WI"];
  const padd3 = ["AL", "AR", "LA", "MS", "NM", "TX"];
  const padd4 = ["CO", "ID", "MT", "UT", "WY"];
  // PADD5 = everything else (west coast)

  if (padd1a.includes(stateCode)) return "R1X";
  if (padd1b.includes(stateCode)) return "R1Y";
  if (padd1c.includes(stateCode)) return "R1Z";
  if (padd2.includes(stateCode)) return "R20";
  if (padd3.includes(stateCode)) return "R30";
  if (padd4.includes(stateCode)) return "R40";
  return "R50"; // West Coast
}

// Regional average diesel prices (cents) - hardcoded fallback
const REGIONAL_AVERAGES: Record<string, number> = {
  R1X: 435, R1Y: 420, R1Z: 395, R20: 385, R30: 375, R40: 395, R50: 445, default: 399,
};

// EIA state-level price cache (shared across requests in same instance)
const eiaCache = new Map<string, { priceCents: number; ts: number }>();
const EIA_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours (EIA updates weekly)

// In-memory cache for individual lookups
const priceCache = new Map<string, { price: number; source: string; ts: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 min

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(3)}_${lng.toFixed(3)}`;
}

// Fetch diesel price from EIA API v2 for a state
async function fetchEiaPrice(stateCode: string): Promise<number | null> {
  const cached = eiaCache.get(stateCode);
  if (cached && Date.now() - cached.ts < EIA_CACHE_TTL) {
    return cached.priceCents;
  }

  const eiaKey = Deno.env.get("EIA_API_KEY");
  if (!eiaKey) {
    console.warn("[fuel_price] No EIA_API_KEY configured");
    return null;
  }

  try {
    // EIA APIv2: Weekly Retail Gasoline and Diesel Prices
    // Use the weekly fuel report endpoint for diesel by state
    const url = `https://api.eia.gov/v2/petroleum/pri/gnd/data/?api_key=${eiaKey}&frequency=weekly&data[0]=value&facets[product][]=EPD2D&facets[duoarea][]=S${stateCode}&sort[0][column]=period&sort[0][direction]=desc&length=1`;
    
    console.log(`[fuel_price] Fetching EIA for state ${stateCode}`);
    const res = await fetch(url);

    if (!res.ok) {
      const body = await res.text();
      console.warn(`[fuel_price] EIA API error: ${res.status} - ${body.substring(0, 200)}`);
      return null;
    }

    const data = await res.json();
    const records = data?.response?.data;
    
    if (records && records.length > 0 && records[0].value) {
      const pricePerGallon = parseFloat(records[0].value);
      const priceCents = Math.round(pricePerGallon * 100);
      console.log(`[fuel_price] EIA price for ${stateCode}: $${pricePerGallon}/gal (${records[0].period})`);
      
      eiaCache.set(stateCode, { priceCents, ts: Date.now() });
      return priceCents;
    }

    console.log(`[fuel_price] No EIA data for state ${stateCode}, trying PADD region`);

    // Try PADD region if state not available
    const padd = getPaddRegion(stateCode);
    const paddUrl = `https://api.eia.gov/v2/petroleum/pri/gnd/data/?api_key=${eiaKey}&frequency=weekly&data[0]=value&facets[product][]=EPD2D&facets[duoarea][]=${padd}&sort[0][column]=period&sort[0][direction]=desc&length=1`;
    
    const paddRes = await fetch(paddUrl);
    if (paddRes.ok) {
      const paddData = await paddRes.json();
      const paddRecords = paddData?.response?.data;
      if (paddRecords && paddRecords.length > 0 && paddRecords[0].value) {
        const pricePerGallon = parseFloat(paddRecords[0].value);
        const priceCents = Math.round(pricePerGallon * 100);
        console.log(`[fuel_price] EIA PADD price for ${stateCode} (${padd}): $${pricePerGallon}/gal`);
        eiaCache.set(stateCode, { priceCents, ts: Date.now() });
        return priceCents;
      }
    } else {
      await paddRes.text();
    }

    return null;
  } catch (err) {
    console.error("[fuel_price] EIA fetch error:", err);
    return null;
  }
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

    // 2. Check DB for recent crowdsourced price (within ~5 miles, last 24h)
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

    if (dbPrice && dbPrice.source === "driver") {
      // Prioritize driver-reported prices
      priceCache.set(ck, { price: dbPrice.diesel_price_cents, source: "driver", ts: Date.now() });
      return new Response(
        JSON.stringify({ diesel_price_cents: dbPrice.diesel_price_cents, source: "driver" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Try EIA API for real state-level price
    const stateCode = getStateFromCoords(lat, lng);
    if (stateCode) {
      const eiaPrice = await fetchEiaPrice(stateCode);
      if (eiaPrice) {
        // Save to DB for future lookups
        const pid = place_id || `eia-${stateCode}-${lat.toFixed(4)}-${lng.toFixed(4)}`;
        await supabase.from("fuel_prices").upsert({
          place_id: pid,
          place_name: place_name || `EIA ${stateCode} Average`,
          lat, lng,
          diesel_price_cents: eiaPrice,
          source: "eia",
        }, { onConflict: "place_id" });

        priceCache.set(ck, { price: eiaPrice, source: "eia", ts: Date.now() });
        return new Response(
          JSON.stringify({ diesel_price_cents: eiaPrice, source: "eia", state: stateCode }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 4. Use DB price if available (even if not driver-reported)
    if (dbPrice) {
      priceCache.set(ck, { price: dbPrice.diesel_price_cents, source: dbPrice.source, ts: Date.now() });
      return new Response(
        JSON.stringify({ diesel_price_cents: dbPrice.diesel_price_cents, source: dbPrice.source }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Fallback to regional estimate
    const region = stateCode ? getPaddRegion(stateCode) : "default";
    const regionalPrice = REGIONAL_AVERAGES[region] || REGIONAL_AVERAGES.default;
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
