import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SpeedLimitRequest {
  lat: number;
  lng: number;
  heading?: number; // Optional heading in degrees (0-360)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const HERE_API_KEY = Deno.env.get('HERE_API_KEY');
    if (!HERE_API_KEY) {
      console.error('[SPEED_LIMIT] HERE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'HERE API not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: SpeedLimitRequest = await req.json();
    const { lat, lng, heading } = body;

    if (lat === undefined || lng === undefined) {
      return new Response(
        JSON.stringify({ error: 'lat and lng are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[SPEED_LIMIT] Request:', { lat, lng, heading });

    // Use HERE Fleet Telematics API for speed limits
    // This API provides current road speed limits based on position
    const params = new URLSearchParams({
      apiKey: HERE_API_KEY,
      waypoint: heading !== undefined 
        ? `${lat},${lng};${heading}` // Include heading for better accuracy
        : `${lat},${lng}`,
      mode: 'fastest;truck',
      linkattributes: 'speedLimit',
      routeattributes: 'none',
      maneuverattributes: 'none',
    });

    // Try Route Match Extension API first (for real-time position matching)
    const matchUrl = `https://routematch.hereapi.com/v8/match/routelinks?${new URLSearchParams({
      apiKey: HERE_API_KEY,
      waypoint: `${lat},${lng}`,
      attributes: 'SPEED_LIMITS_FCn(*)',
      routeMode: 'truck',
    }).toString()}`;

    console.log('[SPEED_LIMIT] Trying Route Match API...');
    
    let speedLimitMph: number | null = null;
    let roadName: string | null = null;
    let roadClass: string | null = null;

    try {
      const matchResponse = await fetch(matchUrl);
      
      if (matchResponse.ok) {
        const matchData = await matchResponse.json();
        console.log('[SPEED_LIMIT] Route Match response:', JSON.stringify(matchData).slice(0, 500));
        
        // Extract speed limit from matched link
        const link = matchData.response?.route?.[0]?.leg?.[0]?.link?.[0];
        if (link) {
          // Speed limit is in km/h, convert to mph
          const speedLimitKmh = link.speedLimit || link.attributes?.SPEED_LIMITS_FCn?.[0]?.FROM_REF_SPEED_LIMIT;
          if (speedLimitKmh) {
            speedLimitMph = Math.round(speedLimitKmh * 0.621371);
          }
          roadName = link.roadName || null;
          roadClass = link.functionalClass || null;
        }
      }
    } catch (matchError) {
      console.log('[SPEED_LIMIT] Route Match failed, trying alternative...', matchError);
    }

    // If Route Match didn't work, try Discover API with speed limit attributes
    if (!speedLimitMph) {
      try {
        const discoverUrl = `https://discover.search.hereapi.com/v1/discover?${new URLSearchParams({
          apiKey: HERE_API_KEY,
          at: `${lat},${lng}`,
          q: 'road',
          limit: '1',
        }).toString()}`;

        console.log('[SPEED_LIMIT] Trying Discover API...');
        const discoverResponse = await fetch(discoverUrl);
        
        if (discoverResponse.ok) {
          const discoverData = await discoverResponse.json();
          const item = discoverData.items?.[0];
          
          if (item?.address?.street) {
            roadName = item.address.street;
          }
        }
      } catch (discoverError) {
        console.log('[SPEED_LIMIT] Discover API error:', discoverError);
      }
    }

    // If still no speed limit, estimate based on road type from reverse geocode
    if (!speedLimitMph) {
      try {
        const revGeoUrl = `https://revgeocode.search.hereapi.com/v1/revgeocode?${new URLSearchParams({
          apiKey: HERE_API_KEY,
          at: `${lat},${lng}`,
          types: 'street',
          lang: 'en-US',
        }).toString()}`;

        const revGeoResponse = await fetch(revGeoUrl);
        
        if (revGeoResponse.ok) {
          const revGeoData = await revGeoResponse.json();
          const item = revGeoData.items?.[0];
          
          if (item) {
            roadName = item.address?.street || null;
            
            // Estimate speed limit based on road type and name
            const street = (item.address?.street || '').toLowerCase();
            const label = (item.address?.label || '').toLowerCase();
            
            if (street.includes('interstate') || street.includes('i-') || label.includes('interstate')) {
              speedLimitMph = 70; // Interstate highways
            } else if (street.includes('highway') || street.includes('hwy') || street.includes('us-') || street.includes('state route')) {
              speedLimitMph = 65; // US/State highways
            } else if (street.includes('expressway') || street.includes('freeway') || street.includes('pkwy') || street.includes('parkway')) {
              speedLimitMph = 55; // Expressways
            } else if (street.includes('avenue') || street.includes('boulevard') || street.includes('blvd')) {
              speedLimitMph = 35; // Major city streets
            } else if (street.includes('street') || street.includes('road') || street.includes('rd') || street.includes('drive') || street.includes('lane')) {
              speedLimitMph = 30; // Local roads
            } else {
              // Default based on position (rural areas tend to have higher limits)
              speedLimitMph = 55;
            }
            
            console.log('[SPEED_LIMIT] Estimated from road type:', { street, speedLimitMph });
          }
        }
      } catch (revGeoError) {
        console.log('[SPEED_LIMIT] RevGeo error:', revGeoError);
      }
    }

    // Final fallback
    if (!speedLimitMph) {
      speedLimitMph = 55; // Default fallback
      console.log('[SPEED_LIMIT] Using default fallback: 55 mph');
    }

    const result = {
      speedLimitMph,
      speedLimitKmh: Math.round(speedLimitMph * 1.60934),
      roadName,
      roadClass,
      source: speedLimitMph === 55 && !roadName ? 'fallback' : 'estimated',
    };

    console.log('[SPEED_LIMIT] Result:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SPEED_LIMIT] Error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
