import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Regional average diesel prices (cents) - fallback when no API/reports
const REGIONAL_AVERAGES: Record<string, number> = {
  northeast: 425,
  southeast: 389,
  midwest: 379,
  southwest: 385,
  west: 445,
  northwest: 415,
  default: 399,
};

// Simple state-to-region mapping
const STATE_REGIONS: Record<string, string> = {
  ME: "northeast", NH: "northeast", VT: "northeast", MA: "northeast",
  RI: "northeast", CT: "northeast", NY: "northeast", NJ: "northeast",
  PA: "northeast", DE: "northeast", MD: "northeast",
  VA: "southeast", WV: "southeast", NC: "southeast", SC: "southeast",
  GA: "southeast", FL: "southeast", AL: "southeast", MS: "southeast",
  TN: "southeast", KY: "southeast",
  OH: "midwest", IN: "midwest", IL: "midwest", MI: "midwest",
  WI: "midwest", MN: "midwest", IA: "midwest", MO: "midwest",
  ND: "midwest", SD: "midwest", NE: "midwest", KS: "midwest",
  TX: "southwest", OK: "southwest", AR: "southwest", LA: "southwest",
  NM: "southwest", AZ: "southwest",
  CA: "west", NV: "west", UT: "west", CO: "west", HI: "west",
  WA: "northwest", OR: "northwest", ID: "northwest", MT: "northwest",
  WY: "northwest", AK: "northwest",
};

interface FuelStop {
  place_id: string;
  name: string;
  lat: number;
  lng: number;
  distance_miles: number;
  diesel_price_cents: number;
  price_source: string;
  recommended_gallons: number;
  estimated_cost_cents: number;
  arrival_fuel_gallons: number;
}

interface OptimizeRequest {
  route_points: { lat: number; lng: number }[];
  truck_mpg: number;
  current_fuel_gallons: number;
  tank_capacity_gallons: number;
  preference: "cheapest" | "fastest" | "balanced";
}

// Haversine distance in miles
function haversineDistanceMiles(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Sample route points to reduce processing
function sampleRoutePoints(
  points: { lat: number; lng: number }[],
  maxPoints = 50
): { lat: number; lng: number; cumMiles: number }[] {
  if (points.length <= maxPoints) {
    let cum = 0;
    return points.map((p, i) => {
      if (i > 0) cum += haversineDistanceMiles(points[i - 1].lat, points[i - 1].lng, p.lat, p.lng);
      return { ...p, cumMiles: cum };
    });
  }
  const step = Math.floor(points.length / maxPoints);
  const sampled: { lat: number; lng: number; cumMiles: number }[] = [];
  let cum = 0;
  for (let i = 0; i < points.length; i += step) {
    if (i > 0) {
      for (let j = sampled.length > 0 ? (i - step) : 0; j < i; j++) {
        if (j > 0) cum += haversineDistanceMiles(points[j - 1].lat, points[j - 1].lng, points[j].lat, points[j].lng);
      }
    }
    sampled.push({ ...points[i], cumMiles: cum });
  }
  // Always include last point
  if (sampled[sampled.length - 1] !== points[points.length - 1]) {
    cum += haversineDistanceMiles(
      sampled[sampled.length - 1].lat, sampled[sampled.length - 1].lng,
      points[points.length - 1].lat, points[points.length - 1].lng
    );
    sampled.push({ ...points[points.length - 1], cumMiles: cum });
  }
  return sampled;
}

// Get regional price estimate based on lat/lng
function getRegionalPrice(lat: number, lng: number): number {
  // Very rough state estimation based on coordinates
  if (lat > 40 && lng > -80) return REGIONAL_AVERAGES.northeast;
  if (lat < 35 && lng > -90) return REGIONAL_AVERAGES.southeast;
  if (lat > 35 && lng > -100 && lng < -80) return REGIONAL_AVERAGES.midwest;
  if (lat < 37 && lng < -95 && lng > -115) return REGIONAL_AVERAGES.southwest;
  if (lng < -115) return REGIONAL_AVERAGES.west;
  if (lat > 42 && lng < -110) return REGIONAL_AVERAGES.northwest;
  return REGIONAL_AVERAGES.default;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: OptimizeRequest = await req.json();
    const {
      route_points,
      truck_mpg = 6.5,
      current_fuel_gallons = 75,
      tank_capacity_gallons = 150,
      preference = "cheapest",
    } = body;

    if (!route_points || route_points.length < 2) {
      return new Response(
        JSON.stringify({ error: "At least 2 route points required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Calculate total route distance
    const sampledRoute = sampleRoutePoints(route_points);
    const totalMiles = sampledRoute[sampledRoute.length - 1].cumMiles;
    const totalGallonsNeeded = totalMiles / truck_mpg;
    const reserveGallons = 50 / truck_mpg; // 50-mile reserve

    // Fetch fuel prices from DB (within 50mi corridor of route)
    const routeBounds = {
      minLat: Math.min(...route_points.map((p) => p.lat)) - 0.7,
      maxLat: Math.max(...route_points.map((p) => p.lat)) + 0.7,
      minLng: Math.min(...route_points.map((p) => p.lng)) - 0.7,
      maxLng: Math.max(...route_points.map((p) => p.lng)) + 0.7,
    };

    const { data: dbPrices } = await supabase
      .from("fuel_prices")
      .select("*")
      .gte("lat", routeBounds.minLat)
      .lte("lat", routeBounds.maxLat)
      .gte("lng", routeBounds.minLng)
      .lte("lng", routeBounds.maxLng)
      .order("updated_at", { ascending: false })
      .limit(200);

    // Map fuel stops to route position
    const fuelStopsOnRoute: {
      place_id: string;
      name: string;
      lat: number;
      lng: number;
      routeMile: number;
      priceCents: number;
      source: string;
    }[] = [];

    if (dbPrices && dbPrices.length > 0) {
      for (const price of dbPrices) {
        // Find closest route point
        let closestDist = Infinity;
        let routeMile = 0;
        for (const rp of sampledRoute) {
          const d = haversineDistanceMiles(price.lat, price.lng, rp.lat, rp.lng);
          if (d < closestDist) {
            closestDist = d;
            routeMile = rp.cumMiles;
          }
        }
        if (closestDist <= 50) {
          fuelStopsOnRoute.push({
            place_id: price.place_id,
            name: price.place_name,
            lat: price.lat,
            lng: price.lng,
            routeMile,
            priceCents: price.diesel_price_cents,
            source: price.source,
          });
        }
      }
    }

    // If no fuel stops in DB, generate estimates at ~100-mile intervals
    if (fuelStopsOnRoute.length === 0) {
      const interval = 100; // miles
      for (let mile = 50; mile < totalMiles - 30; mile += interval) {
        // Find route point near this mile
        const rp = sampledRoute.find((p) => p.cumMiles >= mile) || sampledRoute[sampledRoute.length - 1];
        const price = getRegionalPrice(rp.lat, rp.lng);
        fuelStopsOnRoute.push({
          place_id: `est-${mile}`,
          name: `Truck Stop (~mile ${Math.round(mile)})`,
          lat: rp.lat,
          lng: rp.lng,
          routeMile: mile,
          priceCents: price,
          source: "estimate",
        });
      }
    }

    // Sort by route mile
    fuelStopsOnRoute.sort((a, b) => a.routeMile - b.routeMile);

    // DP optimization: minimize total fuel cost
    // Simple greedy for now: fill when fuel drops below 25% or at cheapest stop ahead
    const optimalStops: FuelStop[] = [];
    let currentFuel = current_fuel_gallons;
    let currentMile = 0;
    let totalCost = 0;

    // Look-ahead window (miles)
    const lookAhead = preference === "cheapest" ? 200 : preference === "fastest" ? 100 : 150;

    for (let i = 0; i < fuelStopsOnRoute.length; i++) {
      const stop = fuelStopsOnRoute[i];
      const milesDriven = stop.routeMile - currentMile;
      const fuelUsed = milesDriven / truck_mpg;
      currentFuel -= fuelUsed;

      if (currentFuel < 0) currentFuel = 0;

      // Should we stop here?
      const milesRemaining = totalMiles - stop.routeMile;
      const fuelNeededToFinish = milesRemaining / truck_mpg + reserveGallons;
      const fuelDeficit = fuelNeededToFinish - currentFuel;

      // Check if this is cheapest within look-ahead
      const stopsAhead = fuelStopsOnRoute.filter(
        (s) => s.routeMile > stop.routeMile && s.routeMile <= stop.routeMile + lookAhead
      );
      const isCheapestAhead =
        stopsAhead.length === 0 || stop.priceCents <= Math.min(...stopsAhead.map((s) => s.priceCents));

      const fuelPct = currentFuel / tank_capacity_gallons;
      const shouldStop =
        fuelPct < 0.25 || // Tank low
        (fuelDeficit > 0 && isCheapestAhead) || // Need fuel and this is cheapest
        (preference === "cheapest" && isCheapestAhead && fuelPct < 0.5); // Opportunistic fill at cheap stop

      if (shouldStop && fuelDeficit > 0) {
        const gallonsToAdd = Math.min(
          tank_capacity_gallons - currentFuel,
          Math.max(fuelDeficit, tank_capacity_gallons * 0.3) // At least 30% fill
        );
        const cost = Math.round(gallonsToAdd * stop.priceCents);

        optimalStops.push({
          place_id: stop.place_id,
          name: stop.name,
          lat: stop.lat,
          lng: stop.lng,
          distance_miles: Math.round(stop.routeMile * 10) / 10,
          diesel_price_cents: stop.priceCents,
          price_source: stop.source,
          recommended_gallons: Math.round(gallonsToAdd * 10) / 10,
          estimated_cost_cents: cost,
          arrival_fuel_gallons: Math.round(currentFuel * 10) / 10,
        });

        currentFuel += gallonsToAdd;
        totalCost += cost;
        currentMile = stop.routeMile;
      } else {
        currentMile = stop.routeMile;
      }
    }

    // Calculate savings vs filling up at average price everywhere
    const avgPrice = REGIONAL_AVERAGES.default;
    const naiveCost = Math.round(totalGallonsNeeded * avgPrice);
    const savings = Math.max(0, naiveCost - totalCost);

    return new Response(
      JSON.stringify({
        optimal_stops: optimalStops,
        total_fuel_cost_cents: totalCost,
        total_distance_miles: Math.round(totalMiles * 10) / 10,
        total_gallons_needed: Math.round(totalGallonsNeeded * 10) / 10,
        savings_vs_average_cents: savings,
        current_fuel_gallons: current_fuel_gallons,
        regional_avg_price_cents: avgPrice,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Fuel optimize error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
