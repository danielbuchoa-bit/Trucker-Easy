import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple in-memory cache (10 minutes TTL)
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000;

interface WeatherRequest {
  routePolyline: string;
  language?: string;
}

// Decode HERE flexible polyline format
function decodeFlexiblePolyline(encoded: string): Array<{ lat: number; lng: number }> {
  const coords: Array<{ lat: number; lng: number }> = [];
  
  if (!encoded || encoded.length < 2) {
    return coords;
  }
  
  try {
    // HERE Flexible Polyline Encoding
    // Format: header byte + encoded deltas
    const DECODING_TABLE = [
      62, -1, -1, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, -1, -1, -1, -1, -1, -1, -1,
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
      22, 23, 24, 25, -1, -1, -1, -1, 63, -1, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35,
      36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51
    ];

    const decodeChar = (char: string): number => {
      const charCode = char.charCodeAt(0);
      if (charCode >= 45 && charCode < 45 + DECODING_TABLE.length) {
        return DECODING_TABLE[charCode - 45];
      }
      return -1;
    };

    const decodeUnsignedValue = (encoded: string, startIndex: { value: number }): number => {
      let result = 0;
      let shift = 0;
      
      while (startIndex.value < encoded.length) {
        const value = decodeChar(encoded[startIndex.value++]);
        if (value < 0) continue;
        result |= (value & 0x1F) << shift;
        if ((value & 0x20) === 0) break;
        shift += 5;
      }
      
      return result;
    };

    const decodeSignedValue = (encoded: string, startIndex: { value: number }): number => {
      const unsigned = decodeUnsignedValue(encoded, startIndex);
      return (unsigned & 1) ? ~(unsigned >> 1) : (unsigned >> 1);
    };

    // Decode header
    const index = { value: 0 };
    const header = decodeUnsignedValue(encoded, index);
    
    // Extract precision from header
    const precision = header & 0x0F;
    const thirdDim = (header >> 4) & 0x07;
    const thirdDimPrecision = (header >> 7) & 0x0F;
    
    const factor = Math.pow(10, precision);
    
    let lat = 0;
    let lng = 0;
    
    while (index.value < encoded.length) {
      const deltaLat = decodeSignedValue(encoded, index);
      const deltaLng = decodeSignedValue(encoded, index);
      
      // Skip third dimension if present
      if (thirdDim !== 0) {
        decodeSignedValue(encoded, index);
      }
      
      lat += deltaLat;
      lng += deltaLng;
      
      coords.push({
        lat: lat / factor,
        lng: lng / factor,
      });
    }
    
    console.log('[WEATHER] Decoded', coords.length, 'coordinates from polyline');
    
  } catch (e) {
    console.error('[WEATHER] Error decoding polyline:', e);
  }
  
  return coords;
}

// Sample points along the route
function sampleRoutePoints(coords: Array<{ lat: number; lng: number }>, maxPoints: number = 5): Array<{ lat: number; lng: number }> {
  if (coords.length === 0) return [];
  if (coords.length <= maxPoints) return coords;
  
  const result: Array<{ lat: number; lng: number }> = [coords[0]];
  const step = Math.floor((coords.length - 1) / (maxPoints - 1));
  
  for (let i = step; i < coords.length - 1; i += step) {
    result.push(coords[i]);
    if (result.length >= maxPoints - 1) break;
  }
  
  result.push(coords[coords.length - 1]);
  return result;
}

// Simple hash for cache key
function hashPolyline(polyline: string): string {
  let hash = 0;
  for (let i = 0; i < Math.min(polyline.length, 1000); i++) {
    hash = ((hash << 5) - hash) + polyline.charCodeAt(i);
    hash = hash & hash;
  }
  return hash.toString(36);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const HERE_API_KEY = Deno.env.get('HERE_API_KEY');
    if (!HERE_API_KEY) {
      console.error('[WEATHER] HERE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'HERE API not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: WeatherRequest = await req.json();
    const { routePolyline, language = 'en-US' } = body;

    if (!routePolyline) {
      return new Response(
        JSON.stringify({ error: 'routePolyline is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[WEATHER] Request for polyline length:', routePolyline.length);

    // Check cache
    const cacheKey = `${hashPolyline(routePolyline)}_${language}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      console.log('[WEATHER] Returning cached alerts');
      return new Response(
        JSON.stringify({ ...cached.data, cached: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Decode polyline and sample points
    const allCoords = decodeFlexiblePolyline(routePolyline);
    
    // Validate decoded coordinates
    const validCoords = allCoords.filter(c => 
      c.lat >= -90 && c.lat <= 90 && 
      c.lng >= -180 && c.lng <= 180
    );
    
    console.log('[WEATHER] Valid coordinates:', validCoords.length, 'of', allCoords.length);
    
    if (validCoords.length === 0) {
      console.log('[WEATHER] No valid coordinates, returning empty');
      return new Response(
        JSON.stringify({
          alerts: [],
          available: false,
          message: 'Could not decode route coordinates',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const samplePoints = sampleRoutePoints(validCoords, 5);
    console.log('[WEATHER] Sampled points:', samplePoints.map(p => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`));

    // Fetch weather alerts using HERE Weather API V3
    const allAlerts: any[] = [];
    const seenAlerts = new Set<string>();

    for (const point of samplePoints) {
      try {
        // HERE Weather API V3 - alerts product
        const weatherParams = new URLSearchParams({
          apiKey: HERE_API_KEY,
          products: 'alerts',
          latitude: point.lat.toString(),
          longitude: point.lng.toString(),
          lang: language.split('-')[0], // 'en' from 'en-US'
        });
        
        const weatherUrl = `https://weather.hereapi.com/v3/report?${weatherParams.toString()}`;
        
        const response = await fetch(weatherUrl);
        
        if (!response.ok) {
          console.log(`[WEATHER] API returned ${response.status} for ${point.lat.toFixed(4)},${point.lng.toFixed(4)}`);
          continue;
        }

        const data = await response.json();
        const alerts = processWeatherAlerts(data);
        
        // Deduplicate alerts
        for (const alert of alerts) {
          const key = `${alert.type}_${alert.headline}`;
          if (!seenAlerts.has(key)) {
            seenAlerts.add(key);
            allAlerts.push(alert);
          }
        }
      } catch (pointError) {
        console.error(`[WEATHER] Error for point ${point.lat},${point.lng}:`, pointError);
      }
    }

    const result = {
      alerts: allAlerts,
      available: true,
      count: allAlerts.length,
      pointsChecked: samplePoints.length,
    };

    // Store in cache
    cache.set(cacheKey, { data: result, timestamp: Date.now() });
    console.log('[WEATHER] Processed', result.count, 'alerts from', result.pointsChecked, 'points');

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[WEATHER] Error:', error);
    
    return new Response(
      JSON.stringify({
        alerts: [],
        available: false,
        message: 'Weather alerts temporarily unavailable',
        error: errorMessage,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function processWeatherAlerts(data: any): any[] {
  const alerts: any[] = [];
  
  try {
    // HERE Weather API V3 response structure
    // places[].alerts[].alerts[]
    const places = data?.places || [];
    
    for (const place of places) {
      const alertsWrapper = place?.alerts;
      if (!alertsWrapper) continue;
      
      const alertsList = alertsWrapper.alerts || [];
      
      for (const warning of alertsList) {
        alerts.push({
          type: warning.type || warning.phenomenonType || 'weather',
          severity: warning.severity || 'unknown',
          headline: warning.description || warning.headline || 'Weather Alert',
          description: warning.message || warning.text || '',
          affectedAreas: warning.affectedAreas || [],
          validFrom: warning.validFromTimeLocal || warning.time?.start || null,
          validTo: warning.validUntilTimeLocal || warning.time?.end || null,
        });
      }
    }
    
    console.log('[WEATHER] Extracted', alerts.length, 'alerts from response');
    
  } catch (e) {
    console.error('[WEATHER] Error processing alerts:', e);
  }
  
  return alerts;
}
