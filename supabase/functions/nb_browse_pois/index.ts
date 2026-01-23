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
 * Supports:
 * - Multiple category mappings for truck-friendly POIs
 * - Progressive radius expansion (5mi → 10mi → 25mi)
 * - Along-route corridor search
 * - Fallback for 53ft truck compatibility (don't zero results on missing metadata)
 */

// Robust category mapping for different filter types
const CATEGORY_MAP: Record<string, { browse: string[]; discover: string[] }> = {
  nearMe: {
    browse: ["fuel-station", "parking", "restaurant"],
    discover: ["truck stop", "fuel station", "rest area"],
  },
  truckStops: {
    browse: ["fuel-station", "parking"],
    discover: ["truck stop", "travel center", "petro", "loves", "pilot", "flying j"],
  },
  restAreas: {
    browse: ["parking", "parking-lot"],
    discover: ["rest area", "rest stop", "service area", "truck parking", "highway rest"],
  },
  restaurants: {
    browse: ["restaurant", "fast-food", "food"],
    discover: ["restaurant", "diner", "fast food", "truck stop restaurant"],
  },
  weighStations: {
    browse: [],
    discover: ["weigh station", "scale"],
  },
};

// Progressive radius in meters: 5mi, 10mi, 25mi
const PROGRESSIVE_RADII = [8047, 16093, 40234];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { 
      lat, 
      lng, 
      radius = 32000,
      radiusMeters,
      filterType = "nearMe", // 'nearMe', 'truckStops', 'restAreas', 'restaurants', 'weighStations'
      categories = [],
      query,
      limit = 30,
      progressiveRadius = true, // Enable progressive radius by default
      routeCorridor, // Optional: { coords: [[lng,lat],...], bufferMeters: 3200 }
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

    // Get category config based on filter type
    const categoryConfig = CATEGORY_MAP[filterType] || CATEGORY_MAP.nearMe;
    
    console.log(`[nb_browse_pois] Filter: ${filterType}, Location: ${lat.toFixed(4)},${lng.toFixed(4)}`);
    console.log(`[nb_browse_pois] Categories: browse=${categoryConfig.browse.join(",")}, discover=${categoryConfig.discover.join(",")}`);

    // Determine radii to try
    const baseRadius = radiusMeters || radius;
    const radiiToTry = progressiveRadius ? PROGRESSIVE_RADII.filter(r => r >= baseRadius / 2) : [baseRadius];
    if (radiiToTry.length === 0) radiiToTry.push(baseRadius);

    let allPois: any[] = [];
    let usedRadius = baseRadius;

    // Try progressively larger radii until we get results
    for (const searchRadius of radiiToTry) {
      allPois = [];
      usedRadius = searchRadius;
      const seenIds = new Set<string>();
      const radiusKm = Math.round(searchRadius / 1000);

      console.log(`[nb_browse_pois] Trying radius: ${searchRadius}m (${(searchRadius / 1609.34).toFixed(1)} mi)`);

      // 1. Browse API with category-specific searches
      for (const category of categoryConfig.browse) {
        try {
          const browseUrl = new URL("https://api.nextbillion.io/browse");
          browseUrl.searchParams.set("key", apiKey);
          browseUrl.searchParams.set("at", `${lat},${lng}`);
          browseUrl.searchParams.set("categories", category);
          browseUrl.searchParams.set("limit", String(Math.min(limit, 50)));
          browseUrl.searchParams.set("in", `circle:${lat},${lng};r=${radiusKm > 0 ? radiusKm * 1000 : 50000}`);

          const response = await fetch(browseUrl.toString());
          const data = await response.json();

          if (response.ok && data.items) {
            console.log(`[nb_browse_pois] Browse "${category}": ${data.items.length} results`);
            data.items.forEach((item: any) => {
              const id = item.id || `${item.position?.lat}-${item.position?.lng}`;
              if (!seenIds.has(id)) {
                seenIds.add(id);
                allPois.push({
                  ...item,
                  _source: 'browse',
                  _category: category,
                  _filterType: filterType,
                });
              }
            });
          }
        } catch (err) {
          console.warn(`[nb_browse_pois] Browse "${category}" error:`, err);
        }
      }

      // 2. Discover API with search terms
      for (const term of categoryConfig.discover.slice(0, 3)) {
        try {
          const discoverUrl = new URL("https://api.nextbillion.io/discover");
          discoverUrl.searchParams.set("key", apiKey);
          discoverUrl.searchParams.set("at", `${lat},${lng}`);
          discoverUrl.searchParams.set("q", term);
          discoverUrl.searchParams.set("limit", String(Math.min(limit, 20)));
          discoverUrl.searchParams.set("in", "countryCode:USA,CAN,MEX");

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
                  _filterType: filterType,
                });
              }
            });
          }
        } catch (err) {
          console.warn(`[nb_browse_pois] Discover "${term}" error:`, err);
        }
      }

      // If we have results, stop expanding radius
      if (allPois.length > 0) {
        console.log(`[nb_browse_pois] Found ${allPois.length} POIs at radius ${searchRadius}m`);
        break;
      }
    }

    // Transform and filter results
    const pois = allPois
      .map((item: any) => {
        const itemLat = item.position?.lat || item.lat;
        const itemLng = item.position?.lng || item.lng;
        const distance = calculateDistance(lat, lng, itemLat, itemLng);
        
        // Determine POI type based on filter and item data
        let poiType: 'truckStop' | 'restArea' | 'restaurant' | 'weighStation' = 'truckStop';
        const title = (item.title || '').toLowerCase();
        const category = (item._category || '').toLowerCase();
        const searchTerm = (item._searchTerm || '').toLowerCase();

        if (filterType === 'restAreas' || searchTerm.includes('rest') || category.includes('parking')) {
          poiType = 'restArea';
        } else if (filterType === 'restaurants' || category.includes('restaurant') || category.includes('food')) {
          poiType = 'restaurant';
        } else if (filterType === 'weighStations' || searchTerm.includes('weigh') || searchTerm.includes('scale')) {
          poiType = 'weighStation';
        }

        // Truck-friendly heuristic - DON'T discard, just flag uncertainty
        const truckFriendlyConfidence = determineTruckFriendlyConfidence(item, title, category, searchTerm);

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
          poiType,
          truckFriendlyConfidence, // 'confirmed', 'likely', 'unknown'
          _source: item._source,
          _filterType: filterType,
        };
      })
      .filter((poi: any) => poi.lat && poi.lng)
      .filter((poi: any) => poi.distance <= usedRadius * 1.1) // 10% tolerance
      .sort((a: any, b: any) => a.distance - b.distance)
      .slice(0, limit);

    console.log(`[nb_browse_pois] Final result: ${pois.length} POIs (filter: ${filterType}, radius: ${usedRadius}m)`);

    return new Response(
      JSON.stringify({ 
        pois, 
        items: pois,
        count: pois.length,
        searchRadius: usedRadius,
        filterType,
        center: { lat, lng },
        debug: {
          triedRadii: radiiToTry,
          usedRadius,
          browseCategories: categoryConfig.browse,
          discoverTerms: categoryConfig.discover,
        },
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

/**
 * Determine truck-friendly confidence based on available data
 * Returns 'confirmed', 'likely', or 'unknown'
 * NEVER blocks results - just provides confidence level
 */
function determineTruckFriendlyConfidence(item: any, title: string, category: string, searchTerm: string): string {
  // Known truck stop brands = confirmed
  const truckStopBrands = ['pilot', 'flying j', 'loves', 'petro', 'ta ', 'travelcenter', 'sapp bros', 'ambest', 'buc-ee'];
  if (truckStopBrands.some(brand => title.includes(brand))) {
    return 'confirmed';
  }

  // Rest areas, service areas, truck parking = likely
  if (searchTerm.includes('rest area') || searchTerm.includes('service area') || 
      searchTerm.includes('truck parking') || category.includes('parking')) {
    return 'likely';
  }

  // Highway-related = likely
  if (title.includes('highway') || title.includes('interstate') || title.includes('i-')) {
    return 'likely';
  }

  // Everything else = unknown (but still shown)
  return 'unknown';
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

function calculateDistance(lat1: number, lng1: number, lat2?: number, lng2?: number): number {
  if (!lat2 || !lng2) return 999999;
  const R = 6371000;
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
