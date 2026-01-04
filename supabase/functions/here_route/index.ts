import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RouteRequest {
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  transportMode?: string;
  avoidTolls?: boolean;
  avoidFerries?: boolean;
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

    const body: RouteRequest = await req.json();
    const { 
      originLat, 
      originLng, 
      destLat, 
      destLng, 
      transportMode = 'truck',
      avoidTolls = false,
      avoidFerries = false
    } = body;

    console.log('Route request:', { originLat, originLng, destLat, destLng, transportMode });

    // Build avoid features
    const avoidFeatures: string[] = [];
    if (avoidTolls) avoidFeatures.push('tollRoad');
    if (avoidFerries) avoidFeatures.push('ferry');

    // Build URL for HERE Routing API v8
    const params = new URLSearchParams({
      apiKey: HERE_API_KEY,
      origin: `${originLat},${originLng}`,
      destination: `${destLat},${destLng}`,
      transportMode: transportMode,
      return: 'polyline,summary,actions,instructions',
    });

    if (avoidFeatures.length > 0) {
      params.append('avoid[features]', avoidFeatures.join(','));
    }

    const hereUrl = `https://router.hereapi.com/v8/routes?${params.toString()}`;
    console.log('Calling HERE API:', hereUrl.replace(HERE_API_KEY, '***'));

    const response = await fetch(hereUrl);
    const data = await response.json();

    if (!response.ok) {
      console.error('HERE API error:', data);
      // If truck mode fails, try car mode as fallback
      if (transportMode === 'truck' && data.error) {
        console.log('Truck mode failed, trying car mode...');
        params.set('transportMode', 'car');
        const fallbackUrl = `https://router.hereapi.com/v8/routes?${params.toString()}`;
        const fallbackResponse = await fetch(fallbackUrl);
        const fallbackData = await fallbackResponse.json();
        
        if (!fallbackResponse.ok) {
          return new Response(
            JSON.stringify({ error: 'Route calculation failed', details: fallbackData }),
            { status: fallbackResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        return processRouteResponse(fallbackData, 'car');
      }
      
      return new Response(
        JSON.stringify({ error: 'Route calculation failed', details: data }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return processRouteResponse(data, transportMode);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in here_route:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function processRouteResponse(data: any, usedMode: string) {
  const route = data.routes?.[0];
  if (!route) {
    return new Response(
      JSON.stringify({ error: 'No route found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const section = route.sections?.[0];
  const summary = section?.summary || {};
  const polyline = section?.polyline || '';
  
  // Extract instructions
  const instructions = section?.actions?.map((action: any) => ({
    instruction: action.instruction,
    duration: action.duration,
    length: action.length,
    direction: action.direction,
  })) || [];

  const result = {
    polyline,
    distance: summary.length || 0, // meters
    duration: summary.duration || 0, // seconds
    instructions,
    transportMode: usedMode,
  };

  console.log('Route calculated:', { distance: result.distance, duration: result.duration });

  return new Response(
    JSON.stringify(result),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
