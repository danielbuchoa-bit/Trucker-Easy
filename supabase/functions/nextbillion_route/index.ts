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

    // ===== HERE Routing v8 response processing =====
    function mapHereRoute(r: any) {
      const sections = r.sections || [];
      // Use first section's polyline as primary (HERE v8 returns one section per leg).
      // For multi-section routes, concatenate; client decodes flexible polyline.
      const polyline = sections.length === 1
        ? (sections[0].polyline || '')
        : sections.map((s: any) => s.polyline || '').join('');

      let totalDistance = 0;
      let totalDuration = 0;
      const instructions: any[] = [];

      for (const s of sections) {
        const sum = s.summary || s.travelSummary || {};
        totalDistance += sum.length || 0;
        totalDuration += sum.duration || 0;

        for (const a of (s.actions || [])) {
          const dir = a.direction || '';
          const kind = a.action || '';
          // Map HERE action -> normalized maneuverType
          let maneuverType = 'continue';
          if (kind === 'depart') maneuverType = 'depart';
          else if (kind === 'arrive') maneuverType = 'arrive';
          else if (kind === 'turn') maneuverType = 'turn';
          else if (kind === 'uTurn') maneuverType = 'uturn';
          else if (kind === 'roundaboutEnter' || kind === 'roundaboutExit' || kind === 'roundaboutPass') maneuverType = 'roundabout';
          else if (kind === 'ramp' || kind === 'exit') maneuverType = 'exit';
          else if (kind === 'merge') maneuverType = 'merge';
          else if (kind === 'keep') maneuverType = 'fork';

          // Map direction -> modifier
          const modifier = dir
            .replace('slightlyLeft', 'slight left')
            .replace('slightlyRight', 'slight right')
            .replace('sharpLeft', 'sharp left')
            .replace('sharpRight', 'sharp right')
            .toLowerCase();

          const roadName = a.nextRoad?.name?.[0]?.value
            || a.currentRoad?.name?.[0]?.value
            || '';

          const exitInfo = a.exit !== undefined ? String(a.exit) : (a.nextRoad?.number?.[0]?.value || null);
          const instructionText = a.instruction || `${maneuverType}${modifier ? ' ' + modifier : ''}${roadName ? ' onto ' + roadName : ''}`;

          instructions.push({
            instruction: instructionText,
            duration: a.duration || 0,
            distance: a.length || 0,
            length: a.length || 0,
            maneuverType,
            modifier,
            roadName,
            geometry: '',
            exitInfo,
            voiceInstruction: instructionText,
          });
        }
      }

      return { polyline, distance: totalDistance, duration: totalDuration, instructions };
    }

    const primary = mapHereRoute(data.routes[0]);
    const alternatives = data.routes.slice(1).map((alt: any) => {
      const m = mapHereRoute(alt);
      return { polyline: m.polyline, distance: m.distance, duration: m.duration };
    });

    const result = {
      polyline: primary.polyline,
      distance: primary.distance,
      duration: primary.duration,
      instructions: primary.instructions,
      transportMode: 'truck',
      truckProfile: {
        length: totalLengthCm,
        width: widthCm,
        height: heightCm,
        weight: weightKg,
        axles: profile.axles,
      },
      alternatives,
    };

    console.log('[HERE_ROUTE] Route calculated:', { 
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
    console.error('[HERE_ROUTE] Error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
