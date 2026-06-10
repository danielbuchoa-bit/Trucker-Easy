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
    const apiKey = Deno.env.get('HERE_API_KEY');
    if (!apiKey) {
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
      avoidTolls = false,
      avoidHighways = false,
      avoidFerries = false,
      truckProfile,
      waypoints = []
    } = body;

    console.log('[HERE_ROUTE] Request:', { 
      origin: `${originLat},${originLng}`, 
      destination: `${destLat},${destLng}`,
      waypoints: waypoints.length,
      truckProfile 
    });

    // HERE v8 avoid features
    const avoidFeatures: string[] = [];
    if (avoidTolls) avoidFeatures.push('tollRoad');
    if (avoidHighways) avoidFeatures.push('controlledAccessHighway');
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

    // HERE uses meters/kg
    const totalLengthCm = feetToCm(profile.trailerLengthFt + 25);
    const heightCm = feetToCm(profile.heightFt);
    const widthCm = feetToCm(profile.widthFt);
    const weightKg = poundsToKg(profile.weightLbs);
    const heightM = (heightCm / 100).toFixed(2);
    const widthM = (widthCm / 100).toFixed(2);
    const lengthM = (totalLengthCm / 100).toFixed(2);

    // Build HERE Routing v8 URL
    const params = new URLSearchParams({
      apikey: apiKey,
      transportMode: 'truck',
      origin: `${originLat},${originLng}`,
      destination: `${destLat},${destLng}`,
      return: 'polyline,summary,actions,instructions,travelSummary',
      alternatives: '2',
      'vehicle[height]': heightM,
      'vehicle[width]': widthM,
      'vehicle[length]': lengthM,
      'vehicle[grossWeight]': String(weightKg),
      'vehicle[axleCount]': String(profile.axles),
      units: 'metric',
      lang: 'en-US',
    });

    // Waypoints as repeated 'via'
    for (const wp of waypoints) {
      params.append('via', `${wp.lat},${wp.lng}`);
    }

    if (avoidFeatures.length > 0) {
      params.append('avoid[features]', avoidFeatures.join(','));
    }

    if (profile.hazmatType) {
      params.append('vehicle[shippedHazardousGoods]', profile.hazmatType);
    }

    const apiUrl = `https://router.hereapi.com/v8/routes?${params.toString()}`;
    console.log('[HERE_ROUTE] API URL:', apiUrl.replace(apiKey, '***'));

    const response = await fetch(apiUrl);
    const data = await response.json();

    console.log('[HERE_ROUTE] Response status:', response.status);

    if (!response.ok || !data.routes || data.routes.length === 0) {
      console.error('[HERE_ROUTE] API Error:', data);
      return new Response(
        JSON.stringify({ 
          error: 'Route calculation failed', 
          details: data.title || data.cause || data.message || JSON.stringify(data).slice(0, 300) 
        }),
        { status: response.status === 200 ? 400 : response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // HERE Route processing: routes[].sections[].{polyline,summary,actions}
    const route = data.routes[0];
    const sections = route.sections || [];

    // Concatenate polylines (flexible polyline format). Client decoder detects 'B' prefix.
    const polyline = sections.map((s: any) => s.polyline).filter(Boolean).join('');
    // Note: joining flexible polylines is not strictly clean, but decoder handles each segment via context.
    // For simplicity, use first section's polyline if only one section.
    const fullPolyline = sections.length === 1 ? sections[0].polyline : polyline;
    
  // Validate if a roundabout instruction is real based on step metadata
  function isValidRoundabout(step: any): boolean {
    const type = step.maneuver?.type || '';
    
    // Only check for roundabout/rotary types
    if (type !== 'roundabout' && type !== 'rotary') return true;
    
    // Roundabouts should have exit info
    const hasExit = step.maneuver?.exit !== undefined && step.maneuver?.exit !== null;
    
    // Roundabouts typically have longer distances (at least 20 meters to traverse)
    const distance = typeof step.distance === 'object' ? step.distance?.value : step.distance;
    const hasReasonableDistance = distance > 15;
    
    // If instruction mentions "roundabout" or "rotary" explicitly, trust it
    const instruction = (step.maneuver?.instruction || step.html_instructions || '').toLowerCase();
    const mentionsRoundabout = instruction.includes('roundabout') || instruction.includes('rotary') || instruction.includes('traffic circle');
    
    // Valid if: has exit OR has reasonable distance OR explicitly mentions roundabout
    return hasExit || hasReasonableDistance || mentionsRoundabout;
  }
  
  // Generate human-readable instruction from modifier and maneuver type
  function generateInstruction(step: any): string {
    const type = step.maneuver?.type || '';
    const modifier = step.maneuver?.modifier || '';
    const roadName = step.name || step.ref || '';
    const exit = step.maneuver?.exit;
    
    // Handle different maneuver types
    if (type === 'depart') {
      return roadName ? `Head towards ${roadName}` : 'Depart';
    }
    if (type === 'arrive') {
      return 'Arrive at destination';
    }
    
    // Validate roundabout - if invalid, treat as regular turn
    if (type === 'roundabout' || type === 'rotary') {
      if (!isValidRoundabout(step)) {
        // Convert to regular turn based on modifier
        if (modifier.includes('left')) {
          return roadName ? `Turn left onto ${roadName}` : 'Turn left';
        } else if (modifier.includes('right')) {
          return roadName ? `Turn right onto ${roadName}` : 'Turn right';
        } else if (modifier.includes('straight')) {
          return roadName ? `Continue straight onto ${roadName}` : 'Continue straight';
        }
        return roadName ? `Continue onto ${roadName}` : 'Continue';
      }
      return exit ? `Take exit ${exit} from roundabout` : 'Enter roundabout';
    }
    
    if (type === 'off ramp' || type === 'exit') {
      return exit ? `Take exit ${exit}${roadName ? ` onto ${roadName}` : ''}` : `Exit${roadName ? ` onto ${roadName}` : ''}`;
    }
    if (type === 'on ramp' || type === 'merge') {
      return roadName ? `Merge onto ${roadName}` : 'Merge';
    }
    if (type === 'fork') {
      const direction = modifier === 'left' ? 'left' : modifier === 'right' ? 'right' : '';
      return `Keep ${direction}${roadName ? ` onto ${roadName}` : ''}`.trim();
    }
    
    // Standard turn instructions
    let action = 'Continue';
    if (modifier === 'left') action = 'Turn left';
    else if (modifier === 'right') action = 'Turn right';
    else if (modifier === 'slight left') action = 'Slight left';
    else if (modifier === 'slight right') action = 'Slight right';
    else if (modifier === 'sharp left') action = 'Sharp left';
    else if (modifier === 'sharp right') action = 'Sharp right';
    else if (modifier === 'uturn') action = 'Make a U-turn';
    else if (modifier === 'straight') action = 'Continue straight';
    
    return roadName ? `${action} onto ${roadName}` : action;
  }
    
    // Extract exit number from various sources
    function extractExitInfo(step: any): string | null {
      // Check maneuver.exit directly
      if (step.maneuver?.exit) {
        return String(step.maneuver.exit);
      }
      
      // Check instruction text
      const instruction = step.maneuver?.instruction || step.html_instructions || '';
      if (instruction) {
        const exitMatch = instruction.match(/exit\s*(?:onto\s*)?(\d+[A-Za-z]?)/i);
        if (exitMatch) return exitMatch[1];
      }
      
      // Check road reference for exit numbers (e.g., "Exit 126A")
      const ref = step.ref || '';
      if (ref) {
        const refMatch = ref.match(/exit\s*(\d+[A-Za-z]?)/i);
        if (refMatch) return refMatch[1];
      }
      
      // Check if it's an off-ramp with numbered exit
      if ((step.maneuver?.type === 'off ramp' || step.maneuver?.type === 'exit') && step.ref) {
        const numMatch = step.ref.match(/(\d+[A-Za-z]?)/);
        if (numMatch) return numMatch[1];
      }
      
      return null;
    }
    
    // Extract turn-by-turn instructions from ALL legs
    const instructions: any[] = [];
    for (const l of route.legs || []) {
      for (const step of l.steps || []) {
        const exitInfo = extractExitInfo(step);
        const generatedInstruction = generateInstruction(step);
        
        // Determine the actual maneuver type (may be corrected for invalid roundabouts)
        let maneuverType = step.maneuver?.type || '';
        const isRoundaboutType = maneuverType === 'roundabout' || maneuverType === 'rotary';
        
        // If it's a roundabout but invalid, change the type to 'turn'
        if (isRoundaboutType && !isValidRoundabout(step)) {
          const modifier = step.maneuver?.modifier || '';
          if (modifier.includes('left') || modifier.includes('right')) {
            maneuverType = 'turn';
          } else {
            maneuverType = 'continue';
          }
          console.log('[NEXTBILLION_ROUTE] Corrected invalid roundabout to:', maneuverType);
        }
        
        instructions.push({
          instruction: step.maneuver?.instruction || step.html_instructions || generatedInstruction,
          duration: extractValue(step.duration),
          distance: extractValue(step.distance),
          length: extractValue(step.distance), // Alias for compatibility
          maneuverType: maneuverType,
          modifier: step.maneuver?.modifier || '',
          roadName: step.name || step.ref || '',
          // Geometry for this step
          geometry: step.geometry || '',
          // Exit info if available
          exitInfo,
          // Voice instruction if available
          voiceInstruction: step.voiceInstructions?.[0]?.announcement || generatedInstruction,
        });
      }
    }
    
    console.log('[NEXTBILLION_ROUTE] Extracted instructions:', instructions.length, 
      'with exits:', instructions.filter((i: any) => i.exitInfo).length,
      'sample:', instructions[0]?.instruction?.substring(0, 50));

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
