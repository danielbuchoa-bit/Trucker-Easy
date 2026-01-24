import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * TRUCK-ONLY POI Browse API
 * 
 * This API ONLY returns POIs relevant to semi-trucks (53ft):
 * - Truck stops / Travel centers (Pilot, Flying J, Love's, TA, Petro, etc.)
 * - DOT Weigh Stations / Inspection Stations
 * - Blue Beacon Truck Wash
 * - Rest Areas with truck parking
 * - Walmart (only if truck-friendly verified)
 * 
 * NO restaurants, retail, or random local businesses.
 */

// ============ TRUCK-ONLY BRAND ALLOWLIST ============
const ALLOWED_TRUCK_BRANDS = [
  'pilot', 'flying j', 'flyingj',
  "love's", 'loves',
  'ta ', 'ta-', 'travelamerica', 'travel america', 'travelcenters',
  'petro', 'petro stopping',
  'sapp bros', 'sappbros',
  'ambest', 'am best',
  "buc-ee's", 'bucees', 'buc-ees',
  'kenly 95', 'iowa 80', 'road ranger', 'town pump', 'little america',
  'kwik trip', 'kwiktrip', 'quick trip', 'quiktrip', 'qt',
  'casey', 'kum & go', 'kum and go',
  'speedway', 'racetrac', 'raceway', 'sheetz', 'wawa',
  'blue beacon', 'bluebeacon', 'truck wash',
];

// HERE category IDs - TRUCK FOCUSED ONLY
const HERE_CATEGORY_MAP: Record<string, string[]> = {
  nearMe: ["700-7600-0116", "700-7600-0000", "700-7850-0000"], // truck stops, fuel, parking
  truckStops: ["700-7600-0116", "700-7600-0000"], // truck stops, fuel stations
  restAreas: ["700-7850-0000", "400-4100-0000"], // parking, rest areas
  weighStations: [], // Use discover only
  truckWash: [], // Use discover only
};

// Search terms - TRUCK FOCUSED ONLY
const TRUCK_DISCOVER_TERMS: Record<string, string[]> = {
  nearMe: ["truck stop", "travel center", "pilot", "loves", "rest area truck"],
  truckStops: ["truck stop", "travel center", "pilot flying j", "loves travel", "ta petro"],
  restAreas: ["rest area", "truck parking", "service plaza"],
  weighStations: ["weigh station", "scale house", "dot inspection", "port of entry"],
  truckWash: ["blue beacon", "truck wash"],
};

// NextBillion category mapping - TRUCK FOCUSED ONLY
const NB_CATEGORY_MAP: Record<string, { browse: string[]; discover: string[] }> = {
  nearMe: {
    browse: ["fuel-station", "parking"],
    discover: ["truck stop", "travel center", "pilot", "loves", "rest area"],
  },
  truckStops: {
    browse: ["fuel-station"],
    discover: ["truck stop", "travel center", "pilot flying j", "loves travel", "ta petro", "sapp bros"],
  },
  restAreas: {
    browse: ["parking", "parking-lot"],
    discover: ["rest area", "truck parking", "service plaza"],
  },
  weighStations: {
    browse: [],
    discover: ["weigh station", "scale house", "dot inspection"],
  },
  truckWash: {
    browse: [],
    discover: ["blue beacon", "truck wash"],
  },
};

// Progressive radius in meters: 50mi, 80mi, 100mi (expanded for long-distance route POIs)
const PROGRESSIVE_RADII = [80467, 128748, 160934];

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

    console.log(`[browse_pois] TRUCK-ONLY search | Filter: ${filterType}, Location: ${lat.toFixed(4)},${lng.toFixed(4)}`);

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

    // Transform and apply STRICT truck-only filtering
    const pois = transformAndFilterTruckOnly(allPois, lat, lng, filterType, usedRadius, limit);

    console.log(`[browse_pois] Final: ${pois.length} TRUCK-ONLY POIs via ${usedProvider} (radius: ${usedRadius}m)`);

    return new Response(
      JSON.stringify({ 
        pois, 
        items: pois,
        count: pois.length,
        searchRadius: usedRadius,
        filterType,
        center: { lat, lng },
        provider: usedProvider,
        truckOnlyFilter: true,
        debug: {
          triedRadii: radiiToTry,
          usedRadius,
          provider: usedProvider,
          nbRateLimited,
          rawCount: allPois.length,
          filteredCount: pois.length,
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

    // Discover API - TRUCK ONLY TERMS
    for (const term of categoryConfig.discover.slice(0, 4)) {
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
  const discoverTerms = TRUCK_DISCOVER_TERMS[filterType] || TRUCK_DISCOVER_TERMS.nearMe;

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

    // HERE Discover API - TRUCK ONLY TERMS
    for (const term of discoverTerms.slice(0, 3)) {
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

// ============ STRICT TRUCK-ONLY FILTERING ============

function transformAndFilterTruckOnly(
  items: any[], 
  centerLat: number, 
  centerLng: number, 
  filterType: string, 
  maxRadius: number, 
  limit: number
): any[] {
  const transformed = items.map((item: any) => {
    const itemLat = item.position?.lat || item.lat;
    const itemLng = item.position?.lng || item.lng;
    const distance = calculateDistance(centerLat, centerLng, itemLat, itemLng);
    
    const title = (item.title || '').toLowerCase();
    const category = (item._category || '').toLowerCase();
    const searchTerm = (item._searchTerm || '').toLowerCase();

    // Determine POI type based on filter and content
    let poiType: 'truckStop' | 'restArea' | 'weighStation' | 'truckWash' = 'truckStop';
    if (filterType === 'restAreas' || searchTerm.includes('rest') || category.includes('parking')) {
      poiType = 'restArea';
    } else if (filterType === 'weighStations' || searchTerm.includes('weigh') || searchTerm.includes('scale') || searchTerm.includes('dot')) {
      poiType = 'weighStation';
    } else if (filterType === 'truckWash' || title.includes('wash') || title.includes('blue beacon')) {
      poiType = 'truckWash';
    }

    // Check if this is a truck-friendly POI
    const truckCheck = checkTruckAllowed(title, category, searchTerm, item);

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
      truckFriendlyConfidence: truckCheck.confidence,
      _truckAllowed: truckCheck.allowed,
      _truckReason: truckCheck.reason,
      _source: item._source,
    };
  });

  // STRICT FILTER: Only allow verified truck-friendly POIs
  const truckOnly = transformed
    .filter((poi: any) => poi.lat && poi.lng)
    .filter((poi: any) => poi.distance <= maxRadius * 1.1)
    .filter((poi: any) => poi._truckAllowed === true);

  // Log filtering results
  const blockedCount = transformed.length - truckOnly.length;
  if (blockedCount > 0) {
    const blocked = transformed.filter((p: any) => !p._truckAllowed).slice(0, 5);
    console.log(`[TruckFilter] Blocked ${blockedCount} non-truck POIs:`, 
      blocked.map((b: any) => `${b.name} (${b._truckReason})`).join(', ')
    );
  }

  return truckOnly
    .sort((a: any, b: any) => a.distance - b.distance)
    .slice(0, limit);
}

function checkTruckAllowed(
  title: string, 
  category: string, 
  searchTerm: string, 
  rawItem: any
): { allowed: boolean; reason: string; confidence: 'confirmed' | 'likely' | 'unknown' } {
  const fullText = `${title} ${category} ${searchTerm}`;

  // Check against allowed truck brands
  for (const brand of ALLOWED_TRUCK_BRANDS) {
    if (fullText.includes(brand)) {
      return { allowed: true, reason: `Matched brand: ${brand}`, confidence: 'confirmed' };
    }
  }

  // Check for weigh station / DOT facility
  if (fullText.includes('weigh station') || fullText.includes('scale house') || 
      fullText.includes('dot inspection') || fullText.includes('port of entry')) {
    return { allowed: true, reason: 'DOT facility', confidence: 'confirmed' };
  }

  // Check for rest areas with truck parking
  if (fullText.includes('rest area') || fullText.includes('service plaza') || 
      fullText.includes('service area') || fullText.includes('welcome center')) {
    return { allowed: true, reason: 'Rest area', confidence: 'likely' };
  }

  // Check for truck parking / truck stop categories
  if (fullText.includes('truck stop') || fullText.includes('travel center') ||
      fullText.includes('truck parking') || category.includes('700-7600-0116')) {
    return { allowed: true, reason: 'Truck stop category', confidence: 'likely' };
  }

  // Check for truck wash
  if (fullText.includes('truck wash') || fullText.includes('blue beacon')) {
    return { allowed: true, reason: 'Truck wash', confidence: 'confirmed' };
  }

  // Check for fuel station with diesel - MORE PERMISSIVE for truck stops
  if ((fullText.includes('fuel') || fullText.includes('diesel') || category.includes('fuel') ||
       fullText.includes('gas station') || fullText.includes('truck') || fullText.includes('travel')) && 
      !fullText.includes('restaurant') && !fullText.includes('cafe') && !fullText.includes('diner')) {
    // Allow truck-related fuel stations
    if (fullText.includes('truck') || fullText.includes('travel center') || 
        fullText.includes('diesel') || fullText.includes('fuel stop')) {
      return { allowed: true, reason: 'Truck fuel stop', confidence: 'likely' };
    }
    // Check for generic gas stations - still allow them with unknown confidence
    const knownGasStations = ['shell', 'chevron', 'exxon', 'mobil', 'bp ', 'citgo', 'marathon', 'phillips 66', 'conoco', 'sinclair', 'murphy usa', 'mapco'];
    for (const gas of knownGasStations) {
      if (title.includes(gas)) {
        // These are generic gas stations - allow with unknown confidence for route display
        return { allowed: true, reason: `Fuel station: ${gas}`, confidence: 'unknown' };
      }
    }
    // Unknown fuel station - allow with unknown confidence
    return { allowed: true, reason: 'Fuel station', confidence: 'unknown' };
  }

  // Block restaurants, cafes, retail, etc.
  const blockedCategories = ['restaurant', 'cafe', 'coffee', 'retail', 'store', 'shop', 'mall', 'bar', 'pub', 'hotel', 'motel'];
  for (const blocked of blockedCategories) {
    if (category.includes(blocked) || title.includes(blocked)) {
      return { allowed: false, reason: `Blocked category: ${blocked}`, confidence: 'confirmed' };
    }
  }

  // Default: not allowed (safety first)
  return { allowed: false, reason: 'Not on truck allowlist', confidence: 'unknown' };
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
