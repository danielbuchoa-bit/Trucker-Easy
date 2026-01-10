import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple in-memory cache (10 minutes TTL)
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface WeatherRequest {
  routePolyline: string;
  language?: string;
}

// Decode HERE flexible polyline to get coordinates
function decodeFlexiblePolyline(encoded: string): Array<{ lat: number; lng: number }> {
  const coords: Array<{ lat: number; lng: number }> = [];
  
  try {
    // HERE Flexible Polyline format
    // Skip header byte and decode
    let index = 0;
    let lat = 0;
    let lng = 0;
    
    // Skip header (first char indicates precision)
    const header = encoded.charCodeAt(0) - 45;
    const precision = Math.pow(10, -(header & 15));
    index = 1;
    
    // Decoding table
    const decodeChar = (c: string): number => {
      const code = c.charCodeAt(0);
      if (code >= 45 && code <= 122) {
        return code - 45;
      }
      return -1;
    };
    
    while (index < encoded.length) {
      // Decode latitude
      let shift = 0;
      let result = 0;
      let byte: number;
      
      do {
        byte = decodeChar(encoded[index++]);
        if (byte < 0) break;
        result |= (byte & 0x1F) << shift;
        shift += 5;
      } while (byte >= 32 && index < encoded.length);
      
      const deltaLat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += deltaLat;
      
      // Decode longitude
      shift = 0;
      result = 0;
      
      do {
        byte = decodeChar(encoded[index++]);
        if (byte < 0) break;
        result |= (byte & 0x1F) << shift;
        shift += 5;
      } while (byte >= 32 && index < encoded.length);
      
      const deltaLng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += deltaLng;
      
      coords.push({
        lat: lat * precision,
        lng: lng * precision,
      });
    }
  } catch (e) {
    console.error('Error decoding polyline:', e);
  }
  
  return coords;
}

// Sample points along the route (every ~100km or so)
function sampleRoutePoints(coords: Array<{ lat: number; lng: number }>, maxPoints: number = 5): Array<{ lat: number; lng: number }> {
  if (coords.length === 0) return [];
  if (coords.length <= maxPoints) return coords;
  
  const result: Array<{ lat: number; lng: number }> = [];
  const step = Math.floor(coords.length / (maxPoints - 1));
  
  for (let i = 0; i < coords.length; i += step) {
    result.push(coords[i]);
    if (result.length >= maxPoints - 1) break;
  }
  
  // Always include the last point
  result.push(coords[coords.length - 1]);
  
  return result;
}

// Simple hash function for cache key
function hashPolyline(polyline: string): string {
  let hash = 0;
  for (let i = 0; i < Math.min(polyline.length, 1000); i++) {
    const char = polyline.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
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
      console.error('HERE_API_KEY not configured');
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

    console.log('Weather alerts request for polyline length:', routePolyline.length);

    // Check cache
    const cacheKey = `${hashPolyline(routePolyline)}_${language}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      console.log('Returning cached weather alerts');
      return new Response(
        JSON.stringify({ ...cached.data, cached: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Decode polyline and sample points along the route
    const allCoords = decodeFlexiblePolyline(routePolyline);
    console.log('Decoded coordinates count:', allCoords.length);
    
    if (allCoords.length === 0) {
      console.log('Could not decode polyline, using fallback response');
      return new Response(
        JSON.stringify({
          alerts: [],
          available: false,
          message: 'Could not decode route polyline',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sample a few key points along the route
    const samplePoints = sampleRoutePoints(allCoords, 5);
    console.log('Sampled points for weather check:', samplePoints.length);

    // Fetch weather alerts for each sample point
    const allAlerts: any[] = [];
    const seenAlerts = new Set<string>();

    for (const point of samplePoints) {
      try {
        // Use HERE Weather API with lat/lng
        const weatherUrl = `https://weather.ls.hereapi.com/weather/1.0/report.json?product=alerts&latitude=${point.lat}&longitude=${point.lng}&apiKey=${HERE_API_KEY}`;
        
        const response = await fetch(weatherUrl);
        
        if (!response.ok) {
          console.log(`Weather API returned ${response.status} for point ${point.lat},${point.lng}`);
          continue;
        }

        const data = await response.json();
        const alerts = processWeatherAlerts(data);
        
        // Deduplicate alerts by headline
        for (const alert of alerts) {
          const key = `${alert.type}_${alert.headline}`;
          if (!seenAlerts.has(key)) {
            seenAlerts.add(key);
            allAlerts.push(alert);
          }
        }
      } catch (pointError) {
        console.error(`Error fetching weather for point ${point.lat},${point.lng}:`, pointError);
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
    console.log('Weather alerts processed:', result.count, 'from', result.pointsChecked, 'points');

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in here_weather_alerts:', error);
    
    // Return empty alerts instead of error so UI doesn't break
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
    // HERE Weather API v1 response structure
    const alertsData = data?.alerts?.alerts || 
                       data?.weatherAlerts?.alerts ||
                       data?.alerts ||
                       [];
    
    if (!Array.isArray(alertsData)) {
      return alerts;
    }
    
    for (const warning of alertsData) {
      alerts.push({
        type: warning.type || warning.phenomenonType || 'weather',
        severity: warning.severity || warning.severityLevel || 'unknown',
        headline: warning.description || warning.headline || warning.title || 'Weather Alert',
        description: warning.message || warning.text || warning.description || '',
        affectedAreas: warning.affectedAreas || warning.areas || [],
        validFrom: warning.validTimeStart || warning.timeSegment?.startTime || null,
        validTo: warning.validTimeEnd || warning.timeSegment?.endTime || null,
      });
    }
  } catch (e) {
    console.error('Error processing weather alerts:', e);
  }
  
  return alerts;
}
