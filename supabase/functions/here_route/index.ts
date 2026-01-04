import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TruckProfile {
  // Length in feet (will be converted to meters)
  trailerLengthFt?: number;
  // Height in feet (will be converted to meters)
  heightFt?: number;
  // Weight in pounds (will be converted to metric tons)
  weightLbs?: number;
  // Number of axles
  axles?: number;
}

interface RouteRequest {
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  transportMode?: string;
  avoidTolls?: boolean;
  avoidFerries?: boolean;
  // Truck-specific options
  truckProfile?: TruckProfile;
}

// Convert feet to meters
function feetToMeters(feet: number): number {
  return feet * 0.3048;
}

// Convert pounds to metric tons
function poundsToTons(lbs: number): number {
  return lbs * 0.000453592;
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
      avoidFerries = false,
      truckProfile
    } = body;

    console.log('Route request:', { originLat, originLng, destLat, destLng, transportMode, truckProfile });

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
      return: 'polyline,summary,actions,instructions,turnByTurnActions',
      lang: 'en-US',
    });

    if (avoidFeatures.length > 0) {
      params.append('avoid[features]', avoidFeatures.join(','));
    }

    // Add truck-specific parameters for 53' trailer
    if (transportMode === 'truck') {
      // Default truck profile for 53' semi-truck
      const profile = {
        trailerLengthFt: truckProfile?.trailerLengthFt ?? 53,
        heightFt: truckProfile?.heightFt ?? 13.6,
        weightLbs: truckProfile?.weightLbs ?? 80000,
        axles: truckProfile?.axles ?? 5,
      };

      // Total truck length (tractor ~25ft + trailer 53ft = ~78ft total)
      const totalLengthMeters = feetToMeters(profile.trailerLengthFt + 25);
      const heightMeters = feetToMeters(profile.heightFt);
      const grossWeightTons = poundsToTons(profile.weightLbs);

      // HERE API truck parameters (values must be integers in cm for height/length/width)
      const heightCm = Math.round(heightMeters * 100);
      const lengthCm = Math.round(totalLengthMeters * 100);
      const widthCm = 260; // Standard truck width ~8.5ft = 2.6m = 260cm
      
      params.append('truck[grossWeight]', Math.round(grossWeightTons * 1000).toString()); // kg
      params.append('truck[height]', heightCm.toString()); // centimeters
      params.append('truck[length]', lengthCm.toString()); // centimeters
      params.append('truck[width]', widthCm.toString()); // centimeters
      params.append('truck[axleCount]', profile.axles.toString());

      // Note: do NOT send truck[type] - HERE rejects some values depending on region/plan.
      // Note: trailerCount is optional; keeping request minimal improves compatibility.

      console.log('Truck profile applied:', {
        grossWeight: `${Math.round(grossWeightTons * 1000)} kg`,
        height: `${heightCm} cm`,
        length: `${lengthCm} cm`,
        axles: profile.axles,
      });
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
        // Remove truck params for car mode
        for (const key of [...params.keys()]) {
          if (key.startsWith('truck[')) {
            params.delete(key);
          }
        }
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
  
  // Extract turn-by-turn instructions with road names
  const instructions = section?.actions?.map((action: any, index: number) => {
    // Build a clean instruction text without coordinates
    let instruction = action.instruction || '';
    
    // Get road/street name
    const roadName = action.nextRoad?.name?.[0]?.value || 
                     action.currentRoad?.name?.[0]?.value || 
                     '';
    
    // Get exit info if available
    const exitInfo = action.exit?.name?.[0]?.value || 
                     action.exit?.number || 
                     '';

    return {
      instruction: instruction,
      duration: action.duration || 0,
      length: action.length || 0,
      direction: action.direction || '',
      action: action.action || '',
      roadName: roadName,
      exitInfo: exitInfo,
      // Offset in meters from start for timing voice prompts
      offset: action.offset || 0,
    };
  }) || [];

  const result = {
    polyline,
    distance: summary.length || 0, // meters
    duration: summary.duration || 0, // seconds
    instructions,
    transportMode: usedMode,
    // Include notices about route (e.g., truck restrictions bypassed)
    notices: route.notices || [],
  };

  console.log('Route calculated:', { 
    distance: result.distance, 
    duration: result.duration,
    instructionCount: result.instructions.length,
  });

  return new Response(
    JSON.stringify(result),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
