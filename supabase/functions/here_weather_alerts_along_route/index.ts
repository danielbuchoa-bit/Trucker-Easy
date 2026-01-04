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

// Simple hash function for cache key
function hashPolyline(polyline: string): string {
  let hash = 0;
  for (let i = 0; i < polyline.length; i++) {
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

    // HERE Destination Weather API v3 - Alerts along route
    // Note: This requires Weather Premium subscription
    const params = new URLSearchParams({
      apiKey: HERE_API_KEY,
      route: routePolyline,
      language: language,
    });

    const hereUrl = `https://weather.ls.hereapi.com/weather/1.0/report.json?product=alerts&${params.toString()}`;
    console.log('Calling HERE Weather API');

    const response = await fetch(hereUrl);
    const data = await response.json();

    if (!response.ok) {
      console.error('HERE Weather API error:', data);
      
      // Check if it's a permission/subscription issue
      if (response.status === 403 || response.status === 401) {
        const result = {
          alerts: [],
          available: false,
          message: 'Weather alerts indisponível no plano atual',
        };
        return new Response(
          JSON.stringify(result),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Weather alerts request failed', details: data }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process alerts
    const alerts = processWeatherAlerts(data);
    
    const result = {
      alerts,
      available: true,
      count: alerts.length,
    };

    // Store in cache
    cache.set(cacheKey, { data: result, timestamp: Date.now() });
    console.log('Weather alerts processed:', result.count);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in here_weather_alerts:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function processWeatherAlerts(data: any): any[] {
  const alerts: any[] = [];
  
  // Handle different response structures from HERE Weather API
  const warnings = data.alerts?.alerts || data.warnings || data.advisories || [];
  
  for (const warning of warnings) {
    alerts.push({
      type: warning.type || warning.phenomenonType || 'weather',
      severity: warning.severity || warning.severityLevel || 'unknown',
      headline: warning.headline || warning.title || warning.description?.substring(0, 100),
      description: warning.description || warning.text || '',
      affectedAreas: warning.affectedAreas || warning.areas || [],
      validFrom: warning.validTimeStart || warning.onset || null,
      validTo: warning.validTimeEnd || warning.expires || null,
      geometry: warning.geometry || warning.shape || null,
    });
  }
  
  return alerts;
}
