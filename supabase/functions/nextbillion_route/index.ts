import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TruckProfile {
  // Length in feet (will be converted to cm)
  trailerLengthFt?: number;
  // Height in feet (will be converted to cm)
  heightFt?: number;
  // Width in feet (will be converted to cm)
  widthFt?: number;
  // Weight in pounds (will be converted to kg)
  weightLbs?: number;
  // Number of axles
  axles?: number;
  // Hazmat type (if carrying hazardous materials)
  hazmatType?: string;
}

interface RouteRequest {
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  avoidTolls?: boolean;
  avoidHighways?: boolean;
  avoidFerries?: boolean;
  truckProfile?: TruckProfile;
  // Optional waypoints
  waypoints?: Array<{ lat: number; lng: number }>;
}

// Convert feet to centimeters
function feetToCm(feet: number): number {
  return Math.round(feet * 30.48);
}

// Convert pounds to kilograms
function poundsToKg(lbs: number): number {
  return Math.round(lbs * 0.453592);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('NEXTBILLION_API_KEY');
    if (!apiKey) {
      console.error('NEXTBILLION_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'NextBillion API not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: RouteRequest = await req.json();
    const { 
      originLat, 
      originLng, 
      destLat, 
      destLng, 
      avoidTolls = false,
      avoidHighways = false,
      avoidFerries = false,
      truckProfile,
      waypoints = []
    } = body;

    console.log('[NEXTBILLION_ROUTE] Request:', { 
      origin: `${originLat},${originLng}`, 
      destination: `${destLat},${destLng}`,
      waypoints: waypoints.length,
      truckProfile 
    });

    // Build avoid features
    const avoidFeatures: string[] = [];
    if (avoidTolls) avoidFeatures.push('toll');
    if (avoidHighways) avoidFeatures.push('highway');
    if (avoidFerries) avoidFeatures.push('ferry');

    // Default truck profile for 53' semi-truck
    const profile = {
      trailerLengthFt: truckProfile?.trailerLengthFt ?? 53,
      heightFt: truckProfile?.heightFt ?? 13.6,
      widthFt: truckProfile?.widthFt ?? 8.5,
      weightLbs: truckProfile?.weightLbs ?? 80000,
      axles: truckProfile?.axles ?? 5,
      hazmatType: truckProfile?.hazmatType,
    };

    // Total truck length (tractor ~25ft + trailer)
    const totalLengthCm = feetToCm(profile.trailerLengthFt + 25);
    const heightCm = feetToCm(profile.heightFt);
    const widthCm = feetToCm(profile.widthFt);
    const weightKg = poundsToKg(profile.weightLbs);

    // Build request parameters
    const params = new URLSearchParams({
      key: apiKey,
      origin: `${originLat},${originLng}`,
      destination: `${destLat},${destLng}`,
      mode: 'truck',
      option: 'flexible', // Use flexible for truck-specific features
      altcount: '2', // Get alternative routes
      // Truck dimensions: height,width,length in cm (per NextBillion docs)
      truck_size: `${heightCm},${widthCm},${totalLengthCm}`,
      // Truck weight in kg
      truck_weight: weightKg.toString(),
      // Number of axles
      truck_axle_count: profile.axles.toString(),
    });

    // Add waypoints if provided
    if (waypoints.length > 0) {
      const waypointsStr = waypoints.map(wp => `${wp.lat},${wp.lng}`).join('|');
      params.append('waypoints', waypointsStr);
    }

    // Add avoid features
    if (avoidFeatures.length > 0) {
      params.append('avoid', avoidFeatures.join('|'));
    }

    // Add hazmat type if specified
    if (profile.hazmatType) {
      params.append('hazmat_type', profile.hazmatType);
    }

    const apiUrl = `https://api.nextbillion.io/directions/json?${params.toString()}`;
    console.log('[NEXTBILLION_ROUTE] API URL:', apiUrl.replace(apiKey, '***'));
    console.log('[NEXTBILLION_ROUTE] Truck profile:', {
      length: `${totalLengthCm} cm`,
      width: `${widthCm} cm`,
      height: `${heightCm} cm`,
      weight: `${weightKg} kg`,
      axles: profile.axles,
    });

    const response = await fetch(apiUrl);
    const data = await response.json();

    console.log('[NEXTBILLION_ROUTE] Response status:', response.status);
    
    // Debug: Log the full response structure to understand the format
    console.log('[NEXTBILLION_ROUTE] Full response keys:', Object.keys(data));
    if (data.routes && data.routes[0]) {
      const route = data.routes[0];
      console.log('[NEXTBILLION_ROUTE] Route keys:', Object.keys(route));
      if (route.legs && route.legs[0]) {
        console.log('[NEXTBILLION_ROUTE] Leg keys:', Object.keys(route.legs[0]));
        console.log('[NEXTBILLION_ROUTE] Leg values:', {
          distance: route.legs[0].distance,
          duration: route.legs[0].duration,
        });
      }
    }

    if (!response.ok || data.status !== 'Ok') {
      console.error('[NEXTBILLION_ROUTE] API Error:', data);
      return new Response(
        JSON.stringify({ 
          error: 'Route calculation failed', 
          details: data.msg || data.message || data.status 
        }),
        { status: response.status === 200 ? 400 : response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process the response
    const route = data.routes?.[0];
    if (!route) {
      console.error('[NEXTBILLION_ROUTE] No route in response:', JSON.stringify(data).substring(0, 500));
      return new Response(
        JSON.stringify({ error: 'No route found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const leg = route.legs?.[0];
    
    // Helper to extract value from NextBillion's format (can be { value: number } or number)
    const extractValue = (val: any): number => {
      if (val === null || val === undefined) return 0;
      if (typeof val === 'number') return val;
      if (typeof val === 'object' && 'value' in val) return val.value || 0;
      return 0;
    };
    
    // Extract turn-by-turn instructions
    const instructions = leg?.steps?.map((step: any) => ({
      instruction: step.maneuver?.instruction || '',
      duration: extractValue(step.duration),
      distance: extractValue(step.distance),
      maneuverType: step.maneuver?.type || '',
      modifier: step.maneuver?.modifier || '',
      roadName: step.name || '',
      // Geometry for this step (if available)
      geometry: step.geometry || '',
    })) || [];

    // Calculate distance and duration from legs
    // NextBillion uses { value: number } format for distance/duration
    let totalDistance = 0;
    let totalDuration = 0;
    
    if (route.legs && Array.isArray(route.legs)) {
      for (const l of route.legs) {
        totalDistance += extractValue(l.distance);
        totalDuration += extractValue(l.duration);
      }
    }
    
    // Fallback to route-level values if available
    if (totalDistance === 0) totalDistance = extractValue(route.distance);
    if (totalDuration === 0) totalDuration = extractValue(route.duration);

    // Build result
    const result = {
      // Encoded polyline for the full route
      polyline: route.geometry || '',
      // Total distance in meters
      distance: totalDistance,
      // Total duration in seconds
      duration: totalDuration,
      // Turn-by-turn instructions
      instructions,
      // Transport mode used
      transportMode: 'truck',
      // Truck profile applied
      truckProfile: {
        length: totalLengthCm,
        width: widthCm,
        height: heightCm,
        weight: weightKg,
        axles: profile.axles,
      },
      // Alternative routes if available
      alternatives: data.routes?.slice(1).map((alt: any) => ({
        polyline: alt.geometry || '',
        distance: extractValue(alt.legs?.[0]?.distance) || extractValue(alt.distance),
        duration: extractValue(alt.legs?.[0]?.duration) || extractValue(alt.duration),
      })) || [],
    };

    console.log('[NEXTBILLION_ROUTE] Route calculated:', { 
      distance: `${(result.distance / 1609.34).toFixed(1)} miles`,
      duration: `${Math.round(result.duration / 60)} min`,
      instructionCount: result.instructions.length,
      alternatives: result.alternatives.length,
    });

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[NEXTBILLION_ROUTE] Error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
