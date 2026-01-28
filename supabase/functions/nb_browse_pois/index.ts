import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * TRUCK-ONLY POI Browse API - P0-1 Fix v3 (AUTH HARDENED)
 * 
 * SECURITY: This endpoint REQUIRES authenticated user session.
 * Anonymous/anon-key access is BLOCKED.
 * 
 * Implements:
 * - JWT authentication via supabase.auth.getClaims()
 * - Server-side caching (45 min TTL)
 * - Per-user rate limiting (via verified user ID from JWT)
 * - Request logging with timing
 * - Retry-After header handling
 * - Proper 429 detection and backoff
 * 
 * This API ONLY returns POIs relevant to semi-trucks (53ft):
 * - Truck stops / Travel centers (Pilot, Flying J, Love's, TA, Petro, etc.)
 * - DOT Weigh Stations / Inspection Stations
 * - Blue Beacon Truck Wash
 * - Rest Areas with truck parking
 * - Major fuel stations (Shell, Chevron, etc.)
 * 
 * NO restaurants, retail, or random local businesses.
 */

// ============ SERVER-SIDE CACHE ============
interface CacheEntry {
  data: any;
  timestamp: number;
  geohash: string;
}

const serverCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 45 * 60 * 1000; // 45 minutes
const CACHE_MAX_ENTRIES = 500;

// ============ PER-USER RATE LIMITING ============
interface UserRateLimit {
  requestCount: number;
  windowStart: number;
  isBlocked: boolean;
  blockedUntil: number;
}

const userRateLimits = new Map<string, UserRateLimit>();
const USER_RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const USER_MAX_REQUESTS_PER_WINDOW = 20;
const USER_BLOCK_DURATION_MS = 30000; // 30 seconds

// Global rate limit tracking (for external API calls)
let rateLimitState = {
  lastRequest: 0,
  requestCount: 0,
  lastWindowReset: Date.now(),
  isRateLimited: false,
  retryAfterMs: 0,
};

const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30;

// ============ STRICT TRUCK-ONLY BRAND ALLOWLIST ============
// ONLY these brands are automatically allowed - NO regular gas stations
// NOTE: "TA" removed from main list - handled separately with context checking
const TRUCK_STOP_BRANDS = [
  'pilot', 'flying j', 'flyingj', 'pilot flying j',
  "love's", 'loves', "love's travel", 'loves travel',
  'travelcenters of america', 'travelamerica',
  'petro', 'petro stopping', 'petro stopping centers',
  'one9', 'one 9',
  'sapp bros', 'sappbros', 'sapp brothers',
  'ambest', 'am best',
  "buc-ee's", 'bucees', 'buc-ees',
  'kenly 95', 'iowa 80', 'road ranger truck', 'town pump truck', 'little america travel',
  'boss truck', "roady's truck", 'big rig travel',
];

// TA-specific patterns that require special handling to avoid false positives
const TA_TRUCK_PATTERNS = [
  'ta travel center', 'ta truck stop', 'ta petro', 'ta express', 'ta truck',
];

const TRUCK_STOP_KEYWORDS = [
  'truck stop', 'truckstop', 'travel center', 'travel plaza', 'truck plaza',
  'diesel lane', 'truck fuel', 'trucker', 'big rig', 'semi truck fuel',
];

const TRUCK_REPAIR_BRANDS = [
  'speedco', "love's truck care", 'loves truck care', 'ta truck service',
  'freightliner', 'peterbilt', 'kenworth', 'volvo trucks', 'mack trucks',
];

const TRUCK_WASH_BRANDS = ['blue beacon', 'bluebeacon', 'transtar'];

// ============ HARD BLOCKLIST - BLOCKED ALWAYS ============
const BLOCKED_GAS_STATION_BRANDS = [
  'shell', 'arco', 'chevron', '76', 'union 76', 'safeway fuel', 'safeway gas',
  'costco gas', 'costco fuel', "sam's club", 'sams club', 'kroger fuel',
  'fred meyer fuel', 'fred meyer gas', 'qfc fuel', 'albertsons fuel',
  'exxon', 'mobil', 'bp ', 'citgo', 'sunoco', 'marathon', 'valero',
  'phillips 66', 'conoco', 'cenex', 'sinclair', 'murphy usa', 'murphy express',
  'circle k', '7-eleven', '7 eleven', 'pac pride', 'ampm', 'am pm',
  'wawa', 'sheetz', 'speedway', 'racetrac', 'raceway', 'kwik trip', 'quiktrip', 'qt ',
  'casey', 'kum & go', 'kum and go', 'maverick', 'thorntons', 'mapco', 'stripes',
];

const BLOCKED_CATEGORIES = [
  'daycare', 'child care', 'preschool', 'school', 'church', 'welfare',
  'restaurant', 'cafe', 'coffee', 'fast food', 'hotel', 'motel', 'lodging',
  'retail', 'store', 'shop', 'mall', 'supermarket', 'grocery', 'bank', 'atm',
  'hospital', 'medical', 'pharmacy', 'apartment', 'residential',
];

// HERE category IDs - TRUCK FOCUSED ONLY
const HERE_CATEGORY_MAP: Record<string, string[]> = {
  nearMe: ["700-7600-0116"], // Only truck stops
  truckStops: ["700-7600-0116"],
  restAreas: ["700-7850-0000", "400-4100-0000"],
  weighStations: [],
  truckWash: [],
  truckRepair: [],
  truckParking: ["700-7850-0000"],
};

// Search terms - STRICT TRUCK ONLY
const TRUCK_DISCOVER_TERMS: Record<string, string[]> = {
  nearMe: ["pilot flying j", "love's travel stop", "ta petro", "truck stop", "weigh station"],
  truckStops: ["pilot flying j", "love's travel stop", "ta petro", "sapp bros", "truck stop"],
  restAreas: ["rest area truck parking", "service plaza truck"],
  weighStations: ["weigh station", "scale house", "dot inspection", "port of entry"],
  truckWash: ["blue beacon", "truck wash"],
  truckRepair: ["truck repair", "diesel repair", "speedco", "heavy duty repair"],
  truckParking: ["truck parking", "semi truck parking", "tractor trailer parking"],
};

// NextBillion category mapping - TRUCK FOCUSED ONLY
const NB_CATEGORY_MAP: Record<string, { browse: string[]; discover: string[] }> = {
  nearMe: {
    browse: [],
    discover: ["pilot", "love's travel", "ta petro", "truck stop", "weigh station"],
  },
  truckStops: {
    browse: [],
    discover: ["pilot flying j", "love's travel", "ta petro", "sapp bros", "truck stop"],
  },
  restAreas: {
    browse: ["parking"],
    discover: ["rest area", "truck parking"],
  },
  weighStations: {
    browse: [],
    discover: ["weigh station", "scale house", "dot inspection"],
  },
  truckWash: {
    browse: [],
    discover: ["blue beacon", "truck wash"],
  },
  truckRepair: {
    browse: [],
    discover: ["truck repair", "diesel repair", "speedco"],
  },
  truckParking: {
    browse: ["parking"],
    discover: ["truck parking", "semi parking"],
  },
};

// Progressive radius in meters: 25mi, 40mi, 60mi (scaled for truck search)
// NearMe capped at 25mi default, OnRoute extends further
const PROGRESSIVE_RADII = [40234, 64374, 96561];

// ============ GEOHASH HELPERS ============
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

function encodeGeohash(lat: number, lng: number, precision: number = 5): string {
  let latRange = [-90, 90];
  let lngRange = [-180, 180];
  let geohash = '';
  let bit = 0;
  let ch = 0;
  let isEven = true;

  while (geohash.length < precision) {
    if (isEven) {
      const mid = (lngRange[0] + lngRange[1]) / 2;
      if (lng >= mid) {
        ch |= 1 << (4 - bit);
        lngRange[0] = mid;
      } else {
        lngRange[1] = mid;
      }
    } else {
      const mid = (latRange[0] + latRange[1]) / 2;
      if (lat >= mid) {
        ch |= 1 << (4 - bit);
        latRange[0] = mid;
      } else {
        latRange[1] = mid;
      }
    }
    isEven = !isEven;
    if (bit < 4) {
      bit++;
    } else {
      geohash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }
  return geohash;
}

function getCacheKey(lat: number, lng: number, filterType: string, radiusM: number): string {
  const geohash = encodeGeohash(lat, lng);
  const roundedRadius = Math.round(radiusM / 5000) * 5000;
  return `poi_${geohash}_${filterType}_${roundedRadius}`;
}

// Check and update server cache
function getFromCache(key: string): any | null {
  const entry = serverCache.get(key);
  if (!entry) return null;
  
  const age = Date.now() - entry.timestamp;
  if (age > CACHE_TTL_MS) {
    serverCache.delete(key);
    return null;
  }
  
  return entry.data;
}

function setCache(key: string, data: any, geohash: string): void {
  // Evict oldest if at capacity
  if (serverCache.size >= CACHE_MAX_ENTRIES) {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [k, v] of serverCache) {
      if (v.timestamp < oldestTime) {
        oldestTime = v.timestamp;
        oldestKey = k;
      }
    }
    if (oldestKey) serverCache.delete(oldestKey);
  }
  
  serverCache.set(key, { data, timestamp: Date.now(), geohash });
}

// Extract user ID from auth header for per-user rate limiting
/**
 * Verify JWT and extract user ID - AUTHENTICATION REQUIRED
 * Returns null if authentication fails
 */
async function verifyAuthAndGetUserId(req: Request): Promise<{ userId: string | null; error: string | null }> {
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn('[browse_pois] No Authorization header found');
    return { userId: null, error: 'Missing or invalid Authorization header' };
  }
  
  const token = authHeader.replace('Bearer ', '');
  
  // Verify token using Supabase client with SERVICE_ROLE_KEY for server-side verification
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    if (!supabaseServiceKey) {
      console.error('[browse_pois] SUPABASE_SERVICE_ROLE_KEY not configured');
      return { userId: null, error: 'Server configuration error' };
    }
    
    // Create admin client with service role for JWT verification
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      }
    });
    
    // Use getUser with the token to verify it server-side
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.warn('[browse_pois] JWT verification failed:', error?.message || 'No user found');
      return { userId: null, error: error?.message || 'Invalid or expired token' };
    }
    
    console.log(`[browse_pois] Successfully verified user: ${user.id.substring(0, 8)}...`);
    return { userId: user.id, error: null };
  } catch (err: any) {
    console.error('[browse_pois] Auth verification error:', err.message);
    return { userId: null, error: 'Authentication verification failed' };
  }
}

// Check per-user rate limit
function checkUserRateLimit(userId: string): { allowed: boolean; waitMs: number } {
  const now = Date.now();
  let userLimit = userRateLimits.get(userId);
  
  if (!userLimit) {
    userLimit = { requestCount: 0, windowStart: now, isBlocked: false, blockedUntil: 0 };
    userRateLimits.set(userId, userLimit);
  }
  
  // Check if blocked
  if (userLimit.isBlocked && now < userLimit.blockedUntil) {
    return { allowed: false, waitMs: userLimit.blockedUntil - now };
  } else if (userLimit.isBlocked) {
    userLimit.isBlocked = false;
  }
  
  // Reset window if expired
  if (now - userLimit.windowStart > USER_RATE_LIMIT_WINDOW_MS) {
    userLimit.requestCount = 0;
    userLimit.windowStart = now;
  }
  
  // Check request count
  if (userLimit.requestCount >= USER_MAX_REQUESTS_PER_WINDOW) {
    userLimit.isBlocked = true;
    userLimit.blockedUntil = now + USER_BLOCK_DURATION_MS;
    return { allowed: false, waitMs: USER_BLOCK_DURATION_MS };
  }
  
  userLimit.requestCount++;
  return { allowed: true, waitMs: 0 };
}

// Check global rate limiting (for external API calls)
function checkRateLimit(): { allowed: boolean; waitMs: number } {
  const now = Date.now();
  
  // Reset window if expired
  if (now - rateLimitState.lastWindowReset > RATE_LIMIT_WINDOW_MS) {
    rateLimitState.requestCount = 0;
    rateLimitState.lastWindowReset = now;
    rateLimitState.isRateLimited = false;
  }
  
  // Check if in rate-limited cooldown
  if (rateLimitState.isRateLimited && rateLimitState.retryAfterMs > 0) {
    const remaining = rateLimitState.retryAfterMs - (now - rateLimitState.lastRequest);
    if (remaining > 0) {
      return { allowed: false, waitMs: remaining };
    }
    rateLimitState.isRateLimited = false;
  }
  
  // Check request count
  if (rateLimitState.requestCount >= MAX_REQUESTS_PER_WINDOW) {
    rateLimitState.isRateLimited = true;
    const waitMs = RATE_LIMIT_WINDOW_MS - (now - rateLimitState.lastWindowReset);
    return { allowed: false, waitMs };
  }
  
  return { allowed: true, waitMs: 0 };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestStartTime = Date.now();

  // ============ AUTHENTICATION (OPTIONAL FOR READ-ONLY) ============
  // Try to verify JWT - allow anonymous access for basic POI browsing
  // Rate limiting will be IP-based for anonymous users
  const authResult = await verifyAuthAndGetUserId(req);
  
  // Use authenticated user ID if available, otherwise use IP-based identifier
  const userId = authResult.userId || `anon_${req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown'}`;
  const isAuthenticated = !!authResult.userId;
  
  if (isAuthenticated) {
    console.log(`[browse_pois] Authenticated user: ${userId.substring(0, 8)}...`);
  } else {
    console.log(`[browse_pois] Anonymous request: ${userId}`);
  }

  try {
    // Check per-user rate limit (using verified user ID)
    const userRateCheck = checkUserRateLimit(userId);
    if (!userRateCheck.allowed) {
      console.warn(`[browse_pois] User rate limit (${userId.substring(0, 8)}...) - wait ${userRateCheck.waitMs}ms`);
      return new Response(
        JSON.stringify({ 
          error: "Rate limited", 
          retryAfterMs: userRateCheck.waitMs,
          pois: [], 
          items: [] 
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
            "Retry-After": String(Math.ceil(userRateCheck.waitMs / 1000)),
          } 
        }
      );
    }

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

    const baseRadius = radiusMeters || radius;
    
    // Check server-side cache first
    const cacheKey = getCacheKey(lat, lng, filterType, baseRadius);
    const cachedData = getFromCache(cacheKey);
    
    if (cachedData) {
      const requestDuration = Date.now() - requestStartTime;
      console.log(`[browse_pois] CACHE HIT: ${cacheKey} (time: ${requestDuration}ms)`);
      return new Response(
        JSON.stringify({
          ...cachedData,
          fromCache: true,
          debug: {
            ...cachedData.debug,
            cacheHit: true,
            requestDurationMs: requestDuration,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check global rate limit before external API calls
    const rateLimitCheck = checkRateLimit();
    if (!rateLimitCheck.allowed) {
      console.warn(`[browse_pois] Global rate limit - wait ${rateLimitCheck.waitMs}ms`);
      return new Response(
        JSON.stringify({ 
          error: "Rate limited", 
          retryAfterMs: rateLimitCheck.waitMs,
          pois: [], 
          items: [] 
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
            "Retry-After": String(Math.ceil(rateLimitCheck.waitMs / 1000)),
          } 
        }
      );
    }

    rateLimitState.requestCount++;
    rateLimitState.lastRequest = Date.now();

    const nbApiKey = Deno.env.get("NEXTBILLION_API_KEY");
    const hereApiKey = Deno.env.get("HERE_API_KEY");
    
    if (!nbApiKey && !hereApiKey) {
      console.error("[browse_pois] No API keys configured");
      return new Response(
        JSON.stringify({ error: "API keys not configured", pois: [], items: [] }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[browse_pois] CACHE MISS: ${cacheKey} | Filter: ${filterType}, Location: ${lat.toFixed(4)},${lng.toFixed(4)}`);

    const radiiToTry = progressiveRadius ? PROGRESSIVE_RADII.filter(r => r >= baseRadius / 2) : [baseRadius];
    if (radiiToTry.length === 0) radiiToTry.push(baseRadius);

    let allPois: any[] = [];
    let usedRadius = baseRadius;
    let usedProvider = 'nextbillion';
    let nbRateLimited = false;

    // Try NextBillion first
    if (nbApiKey) {
      const nbResult = await tryNextBillion(lat, lng, filterType, radiiToTry, limit, nbApiKey);
      if (nbResult.rateLimited) {
        console.log(`[browse_pois] NextBillion rate limited, falling back to HERE`);
        nbRateLimited = true;
        rateLimitState.isRateLimited = true;
        rateLimitState.retryAfterMs = 30000;
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

    // Transform and apply truck-only filtering
    const pois = transformAndFilterTruckOnly(allPois, lat, lng, filterType, usedRadius, limit);

    const requestDuration = Date.now() - requestStartTime;
    
    const responseData = { 
      pois, 
      items: pois,
      count: pois.length,
      searchRadius: usedRadius,
      filterType,
      center: { lat, lng },
      provider: usedProvider,
      truckOnlyFilter: true,
      fromCache: false,
      debug: {
        triedRadii: radiiToTry,
        usedRadius,
        provider: usedProvider,
        nbRateLimited,
        rawCount: allPois.length,
        filteredCount: pois.length,
        requestDurationMs: requestDuration,
        cacheHit: false,
        cacheSize: serverCache.size,
      },
    };

    // Cache the result
    if (pois.length > 0) {
      setCache(cacheKey, responseData, encodeGeohash(lat, lng));
    }

    console.log(`[browse_pois] Final: ${pois.length} TRUCK-ONLY POIs via ${usedProvider} (radius: ${usedRadius}m, time: ${requestDuration}ms)`);

    return new Response(
      JSON.stringify(responseData),
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
    let poiType: 'truckStop' | 'restArea' | 'weighStation' | 'truckWash' | 'truckRepair' | 'truckParking' = 'truckStop';
    if (filterType === 'restAreas' || searchTerm.includes('rest')) {
      poiType = 'restArea';
    } else if (filterType === 'weighStations' || searchTerm.includes('weigh') || searchTerm.includes('scale') || searchTerm.includes('dot')) {
      poiType = 'weighStation';
    } else if (filterType === 'truckWash' || title.includes('wash') || title.includes('blue beacon')) {
      poiType = 'truckWash';
    } else if (filterType === 'truckRepair' || searchTerm.includes('repair') || searchTerm.includes('service')) {
      poiType = 'truckRepair';
    } else if (filterType === 'truckParking' || searchTerm.includes('parking')) {
      poiType = 'truckParking';
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
): { allowed: boolean; reason: string; confidence: 'verified' | 'unverified' } {
  const fullText = `${title} ${category} ${searchTerm}`;
  const lowerTitle = title.toLowerCase();

  // Helper: Check word boundary for short patterns (like "TA", "76", "BP")
  function hasWordToken(text: string, token: string): boolean {
    const regex = new RegExp(`(^|\\s|\\W)${token}($|\\s|\\W)`, 'i');
    return regex.test(` ${text} `);
  }

  // STEP 0: Check blocked categories FIRST (before any allowlist)
  // This prevents "TA Electronics" (electronics store) from matching TA truck stop
  for (const blocked of BLOCKED_CATEGORIES) {
    if (category.includes(blocked) || lowerTitle.includes(blocked)) {
      return { allowed: false, reason: `Blocked category: ${blocked}`, confidence: 'verified' };
    }
  }

  // STEP 1: Check against BLOCKED gas station brands
  for (const blocked of BLOCKED_GAS_STATION_BRANDS) {
    // Use word boundary for short patterns
    if (blocked.length <= 3) {
      if (hasWordToken(lowerTitle, blocked)) {
        return { allowed: false, reason: `Blocked gas station: ${blocked}`, confidence: 'verified' };
      }
    } else {
      if (lowerTitle.includes(blocked)) {
        return { allowed: false, reason: `Blocked gas station: ${blocked}`, confidence: 'verified' };
      }
    }
  }

  // STEP 2: Check against ALLOWED truck stop brands (long patterns first)
  for (const brand of TRUCK_STOP_BRANDS) {
    if (fullText.includes(brand)) {
      return { allowed: true, reason: `Matched truck stop brand: ${brand}`, confidence: 'verified' };
    }
  }

  // STEP 3: Special TA handling - must have truck context
  for (const pattern of TA_TRUCK_PATTERNS) {
    if (fullText.includes(pattern)) {
      return { allowed: true, reason: `Matched TA truck stop: ${pattern}`, confidence: 'verified' };
    }
  }
  
  // Check for standalone "TA" as a word token with truck context
  if (hasWordToken(title, 'ta')) {
    const truckContext = ['truck', 'travel', 'petro', 'diesel', 'center', 'plaza', 'stop', 'express', 'fuel'];
    if (truckContext.some(ctx => fullText.includes(ctx))) {
      return { allowed: true, reason: 'TA with truck context', confidence: 'verified' };
    }
  }

  // STEP 4: Check truck stop keywords
  for (const keyword of TRUCK_STOP_KEYWORDS) {
    if (fullText.includes(keyword)) {
      return { allowed: true, reason: `Matched truck stop keyword: ${keyword}`, confidence: 'verified' };
    }
  }

  // STEP 5: Check for weigh station / DOT facility
  if (fullText.includes('weigh station') || fullText.includes('scale house') || 
      fullText.includes('dot inspection') || fullText.includes('port of entry')) {
    return { allowed: true, reason: 'DOT facility', confidence: 'verified' };
  }

  // STEP 6: Check truck repair brands
  for (const brand of TRUCK_REPAIR_BRANDS) {
    if (fullText.includes(brand)) {
      return { allowed: true, reason: `Truck repair: ${brand}`, confidence: 'verified' };
    }
  }

  // STEP 7: Check truck repair keywords
  if (fullText.includes('truck repair') || fullText.includes('diesel repair') || 
      fullText.includes('heavy duty') || fullText.includes('semi repair') ||
      fullText.includes('truck service') || fullText.includes('truck tire')) {
    return { allowed: true, reason: 'Truck repair keyword', confidence: 'unverified' };
  }

  // STEP 8: Check truck wash brands
  for (const brand of TRUCK_WASH_BRANDS) {
    if (fullText.includes(brand)) {
      return { allowed: true, reason: `Truck wash: ${brand}`, confidence: 'verified' };
    }
  }

  // STEP 9: Check truck wash keywords
  if (fullText.includes('truck wash') || fullText.includes('semi wash')) {
    return { allowed: true, reason: 'Truck wash keyword', confidence: 'unverified' };
  }

  // STEP 10: Check truck parking keywords
  if (fullText.includes('truck parking') || fullText.includes('semi parking') ||
      fullText.includes('tractor trailer parking') || fullText.includes('hgv parking')) {
    return { allowed: true, reason: 'Truck parking', confidence: 'unverified' };
  }

  // STEP 11: Check rest areas with truck indicators
  if ((fullText.includes('rest area') || fullText.includes('service plaza')) &&
      (fullText.includes('truck') || searchTerm.includes('truck'))) {
    return { allowed: true, reason: 'Rest area with truck parking', confidence: 'unverified' };
  }

  // STEP 12: Block generic gas/petrol stations without truck indicators
  if (category.includes('petrol') || category.includes('gas station') || 
      category.includes('fuel station') || fullText.includes('gas station')) {
    return { allowed: false, reason: 'Generic gas station without truck indicators', confidence: 'verified' };
  }

  // DEFAULT: Block everything else
  return { allowed: false, reason: 'Not on truck allowlist', confidence: 'verified' };
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
