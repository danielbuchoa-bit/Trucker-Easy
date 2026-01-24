import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * POI Browse API with automatic fallback
 * Primary: NextBillion Browse/Discover APIs
 * Fallback: HERE Browse/Discover APIs (when NB rate limited)
 */

// HERE category IDs for truck-friendly POIs
const HERE_CATEGORY_MAP: Record<string, string[]> = {
  nearMe: ["700-7600-0000", "700-7850-0000", "100-1000-0000"], // fuel, parking, restaurants
  truckStops: ["700-7600-0116", "700-7600-0000"], // truck stops, fuel stations
  restAreas: ["700-7850-0000", "400-4100-0000"], // parking, rest areas
  restaurants: ["100-1000-0000", "100-1100-0000"], // restaurants, cafes
  weighStations: [], // Not available in HERE, use discover
};

const HERE_DISCOVER_TERMS: Record<string, string[]> = {
  nearMe: ["truck stop", "rest area", "gas station"],
  truckStops: ["truck stop", "travel center", "pilot", "loves"],
  restAreas: ["rest area", "truck parking", "service area"],
  restaurants: ["restaurant", "diner", "fast food"],
  weighStations: ["weigh station", "scale house"],
};

// NextBillion category mapping
const NB_CATEGORY_MAP: Record<string, { browse: string[]; discover: string[] }> = {
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
      filterType = "nearMe",
      limit = 30,
      progressiveRadius = true,
    } = body;

    if (lat === undefined || lng === undefined) {
      return new Response(
        JSON.stringify({ error: "lat and lng are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const nbApiKey = Deno.env.get("NEXTBILLION_API_KEY");
    const hereApiKey = Deno.env.get("HERE_API_KEY");
    
    if (!nbApiKey && !hereApiKey) {
      console.error("[browse_pois] No API keys configured");
      return new Response(
        JSON.stringify({ error: "API keys not configured", pois: [], items: [] }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[browse_pois] Filter: ${filterType}, Location: ${lat.toFixed(4)},${lng.toFixed(4)}`);

    const baseRadius = radiusMeters || radius;
    const radiiToTry = progressiveRadius ? PROGRESSIVE_RADII.filter(r => r >= baseRadius / 2) : [baseRadius];
    if (radiiToTry.length === 0) radiiToTry.push(baseRadius);

    let allPois: any[] = [];
    let usedRadius = baseRadius;
    let usedProvider = 'nextbillion';
    let nbRateLimited = false;

    // Try NextBillion first
    if (nbApiKey && !nbRateLimited) {
      const nbResult = await tryNextBillion(lat, lng, filterType, radiiToTry, limit, nbApiKey);
      if (nbResult.rateLimited) {
        console.log(`[browse_pois] NextBillion rate limited, falling back to HERE`);
        nbRateLimited = true;
      } else if (nbResult.pois.length > 0) {
        allPois = nbResult.pois;
        usedRadius = nbResult.usedRadius;
        usedProvider = 'nextbillion';
      }
    }

    // Fallback to HERE if NB failed or is rate limited
    if (allPois.length === 0 && hereApiKey) {
      console.log(`[browse_pois] Using HERE API fallback`);
      const hereResult = await tryHere(lat, lng, filterType, radiiToTry, limit, hereApiKey);
      allPois = hereResult.pois;
      usedRadius = hereResult.usedRadius;
      usedProvider = 'here';
    }

    // Transform and filter results
    const pois = transformPois(allPois, lat, lng, filterType, usedRadius, limit);

    console.log(`[browse_pois] Final: ${pois.length} POIs via ${usedProvider} (radius: ${usedRadius}m)`);

    return new Response(
      JSON.stringify({ 
        pois, 
        items: pois,
        count: pois.length,
        searchRadius: usedRadius,
        filterType,
        center: { lat, lng },
        provider: usedProvider,
        debug: {
          triedRadii: radiiToTry,
          usedRadius,
          provider: usedProvider,
          nbRateLimited,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[browse_pois] Error:", message);
    return new Response(
      JSON.stringify({ pois: [], items: [], error: message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// NextBillion API implementation
async function tryNextBillion(
  lat: number, lng: number, filterType: string, radii: number[], limit: number, apiKey: string
): Promise<{ pois: any[]; usedRadius: number; rateLimited: boolean }> {
  const categoryConfig = NB_CATEGORY_MAP[filterType] || NB_CATEGORY_MAP.nearMe;
  
  for (const searchRadius of radii) {
    const pois: any[] = [];
    const seenIds = new Set<string>();
    let rateLimited = false;

    // Browse API
    for (const category of categoryConfig.browse) {
      try {
        const url = new URL("https://api.nextbillion.io/browse");
        url.searchParams.set("key", apiKey);
        url.searchParams.set("at", `${lat},${lng}`);
        url.searchParams.set("categories", category);
        url.searchParams.set("limit", String(Math.min(limit, 50)));
        url.searchParams.set("in", `circle:${lat},${lng};r=${searchRadius}`);

        const response = await fetch(url.toString());
        const data = await response.json();

        if (response.status === 429) {
          rateLimited = true;
          break;
        }

        if (response.ok && data.items?.length > 0) {
          data.items.forEach((item: any) => {
            const id = item.id || `${item.position?.lat}-${item.position?.lng}`;
            if (!seenIds.has(id)) {
              seenIds.add(id);
              pois.push({ ...item, _source: 'nb_browse', _category: category });
            }
          });
        }
      } catch (err) {
        console.warn(`[NB Browse] ${category} error:`, err);
      }
    }

    if (rateLimited) return { pois: [], usedRadius: searchRadius, rateLimited: true };

    // Discover API
    for (const term of categoryConfig.discover.slice(0, 3)) {
      try {
        const url = new URL("https://api.nextbillion.io/discover");
        url.searchParams.set("key", apiKey);
        url.searchParams.set("at", `${lat},${lng}`);
        url.searchParams.set("q", term);
        url.searchParams.set("limit", String(Math.min(limit, 20)));
        url.searchParams.set("in", `circle:${lat},${lng};r=${searchRadius}`);

        const response = await fetch(url.toString());
        const data = await response.json();

        if (response.status === 429) {
          rateLimited = true;
          break;
        }

        if (response.ok && data.items?.length > 0) {
          data.items.forEach((item: any) => {
            const id = item.id || `${item.position?.lat}-${item.position?.lng}`;
            if (!seenIds.has(id)) {
              seenIds.add(id);
              pois.push({ ...item, _source: 'nb_discover', _searchTerm: term });
            }
          });
        }
      } catch (err) {
        console.warn(`[NB Discover] ${term} error:`, err);
      }
    }

    if (rateLimited) return { pois: [], usedRadius: searchRadius, rateLimited: true };
    if (pois.length > 0) return { pois, usedRadius: searchRadius, rateLimited: false };
  }

  return { pois: [], usedRadius: radii[radii.length - 1], rateLimited: false };
}

// HERE API fallback implementation
async function tryHere(
  lat: number, lng: number, filterType: string, radii: number[], limit: number, apiKey: string
): Promise<{ pois: any[]; usedRadius: number }> {
  const categories = HERE_CATEGORY_MAP[filterType] || HERE_CATEGORY_MAP.nearMe;
  const discoverTerms = HERE_DISCOVER_TERMS[filterType] || HERE_DISCOVER_TERMS.nearMe;

  for (const searchRadius of radii) {
    const pois: any[] = [];
    const seenIds = new Set<string>();

    // HERE Browse API
    if (categories.length > 0) {
      try {
        const url = new URL("https://browse.search.hereapi.com/v1/browse");
        url.searchParams.set("apiKey", apiKey);
        url.searchParams.set("at", `${lat},${lng}`);
        url.searchParams.set("categories", categories.join(","));
        url.searchParams.set("limit", String(Math.min(limit, 100)));
        url.searchParams.set("in", `circle:${lat},${lng};r=${searchRadius}`);

        const response = await fetch(url.toString());
        const data = await response.json();

        if (response.ok && data.items?.length > 0) {
          console.log(`[HERE Browse] Found ${data.items.length} results`);
          data.items.forEach((item: any) => {
            const id = item.id || `${item.position?.lat}-${item.position?.lng}`;
            if (!seenIds.has(id)) {
              seenIds.add(id);
              pois.push({ ...item, _source: 'here_browse' });
            }
          });
        }
      } catch (err) {
        console.warn(`[HERE Browse] error:`, err);
      }
    }

    // HERE Discover API
    for (const term of discoverTerms.slice(0, 2)) {
      try {
        const url = new URL("https://discover.search.hereapi.com/v1/discover");
        url.searchParams.set("apiKey", apiKey);
        url.searchParams.set("at", `${lat},${lng}`);
        url.searchParams.set("q", term);
        url.searchParams.set("limit", String(Math.min(limit, 20)));
        url.searchParams.set("in", `circle:${lat},${lng};r=${searchRadius}`);

        const response = await fetch(url.toString());
        const data = await response.json();

        if (response.ok && data.items?.length > 0) {
          console.log(`[HERE Discover] "${term}": ${data.items.length} results`);
          data.items.forEach((item: any) => {
            const id = item.id || `${item.position?.lat}-${item.position?.lng}`;
            if (!seenIds.has(id)) {
              seenIds.add(id);
              pois.push({ ...item, _source: 'here_discover', _searchTerm: term });
            }
          });
        }
      } catch (err) {
        console.warn(`[HERE Discover] "${term}" error:`, err);
      }
    }

    if (pois.length > 0) return { pois, usedRadius: searchRadius };
  }

  return { pois: [], usedRadius: radii[radii.length - 1] };
}

// Transform POIs to unified format
function transformPois(items: any[], centerLat: number, centerLng: number, filterType: string, maxRadius: number, limit: number): any[] {
  return items
    .map((item: any) => {
      const itemLat = item.position?.lat || item.lat;
      const itemLng = item.position?.lng || item.lng;
      const distance = calculateDistance(centerLat, centerLng, itemLat, itemLng);
      
      const title = (item.title || '').toLowerCase();
      const category = (item._category || '').toLowerCase();
      const searchTerm = (item._searchTerm || '').toLowerCase();

      let poiType: 'truckStop' | 'restArea' | 'restaurant' | 'weighStation' = 'truckStop';
      if (filterType === 'restAreas' || searchTerm.includes('rest') || category.includes('parking')) {
        poiType = 'restArea';
      } else if (filterType === 'restaurants' || category.includes('restaurant') || category.includes('food')) {
        poiType = 'restaurant';
      } else if (filterType === 'weighStations' || searchTerm.includes('weigh') || searchTerm.includes('scale')) {
        poiType = 'weighStation';
      }

      const truckFriendlyConfidence = determineTruckFriendlyConfidence(title, category, searchTerm);

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
        distance,
        categories: item.categories || [{ name: item._category || "POI" }],
        rating: item.rating || null,
        poiType,
        truckFriendlyConfidence,
        _source: item._source,
      };
    })
    .filter((poi: any) => poi.lat && poi.lng)
    .filter((poi: any) => poi.distance <= maxRadius * 1.1)
    .sort((a: any, b: any) => a.distance - b.distance)
    .slice(0, limit);
}

function determineTruckFriendlyConfidence(title: string, category: string, searchTerm: string): string {
  const truckStopBrands = ['pilot', 'flying j', 'loves', 'petro', 'ta ', 'travelcenter', 'sapp bros', 'ambest', 'buc-ee'];
  if (truckStopBrands.some(brand => title.includes(brand))) return 'confirmed';
  if (searchTerm.includes('rest area') || searchTerm.includes('service area') || 
      searchTerm.includes('truck parking') || category.includes('parking')) return 'likely';
  if (title.includes('highway') || title.includes('interstate') || title.includes('i-')) return 'likely';
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
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}