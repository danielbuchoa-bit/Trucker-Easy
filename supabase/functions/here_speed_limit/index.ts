import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SpeedLimitRequest {
  lat: number;
  lng: number;
  heading?: number;
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

    let speedLimitMph: number | null = null;
    let roadName: string | null = null;
    let roadClass: string | null = null;
    let source = 'estimated';

    // Try HERE Route Matching API v8 (correct endpoint)
    // Uses routematching.hereapi.com (NOT routematch)
    try {
      const waypoint0 = heading !== undefined 
        ? `${lat},${lng};${heading}`
        : `${lat},${lng}`;
      
      // Need two waypoints for route matching - use same point twice
      const waypoint1 = waypoint0;
      
      const matchParams = new URLSearchParams({
        apikey: HERE_API_KEY,
        waypoint0,
        waypoint1,
        mode: 'fastest;truck',
        routeMatch: '1',
        attributes: 'SPEED_LIMITS_FCn(*)',
      });

      const matchUrl = `https://routematching.hereapi.com/v8/match/routelinks?${matchParams.toString()}`;
      console.log('[SPEED_LIMIT] Trying Route Matching API v8...');
      
      const matchResponse = await fetch(matchUrl);
      
      if (matchResponse.ok) {
        const matchData = await matchResponse.json();
        console.log('[SPEED_LIMIT] Route Matching response:', JSON.stringify(matchData).slice(0, 800));
        
        // Extract speed limit from matched link
        const route = matchData.response?.route?.[0];
        const link = route?.leg?.[0]?.link?.[0];
        
        if (link) {
          // SPEED_LIMITS_FCn contains speed limit info
          const speedLimits = link.attributes?.SPEED_LIMITS_FCn;
          if (speedLimits && speedLimits.length > 0) {
            // FROM_REF_SPEED_LIMIT is in km/h
            const speedLimitKmh = speedLimits[0]?.FROM_REF_SPEED_LIMIT || speedLimits[0]?.TO_REF_SPEED_LIMIT;
            if (speedLimitKmh) {
              speedLimitMph = Math.round(speedLimitKmh * 0.621371);
              source = 'here_routematch';
              console.log('[SPEED_LIMIT] Got speed from Route Matching:', { speedLimitKmh, speedLimitMph });
            }
          }
          
          roadName = link.roadName || route.leg?.[0]?.roadName || null;
          roadClass = link.functionalClass || null;
        }
      } else {
        const errorText = await matchResponse.text();
        console.log('[SPEED_LIMIT] Route Matching API error:', matchResponse.status, errorText.slice(0, 200));
      }
    } catch (matchError) {
      console.log('[SPEED_LIMIT] Route Matching failed:', matchError);
    }

    // Fallback: Use reverse geocode to get road info and estimate speed
    if (!speedLimitMph) {
      try {
        const revGeoUrl = `https://revgeocode.search.hereapi.com/v1/revgeocode?${new URLSearchParams({
          apiKey: HERE_API_KEY,
          at: `${lat},${lng}`,
          types: 'street',
          lang: 'en-US',
        }).toString()}`;

        console.log('[SPEED_LIMIT] Trying reverse geocode...');
        const revGeoResponse = await fetch(revGeoUrl);
        
        if (revGeoResponse.ok) {
          const revGeoData = await revGeoResponse.json();
          const item = revGeoData.items?.[0];
          
          if (item) {
            roadName = item.address?.street || null;
            
            // Estimate speed limit based on road type and name
            const street = (item.address?.street || '').toLowerCase();
            const label = (item.address?.label || '').toLowerCase();
            
            if (street.includes('interstate') || street.match(/\bi-\d+/) || label.includes('interstate')) {
              speedLimitMph = 70; // Interstate highways
            } else if (street.includes('highway') || street.includes('hwy') || street.match(/\bus-\d+/) || street.includes('state route')) {
              speedLimitMph = 65; // US/State highways
            } else if (street.includes('expressway') || street.includes('freeway') || street.includes('pkwy') || street.includes('parkway')) {
              speedLimitMph = 55; // Expressways
            } else if (street.includes('avenue') || street.includes('boulevard') || street.includes('blvd')) {
              speedLimitMph = 35; // Major city streets
            } else if (street.includes('street') || street.includes('road') || street.includes('drive') || street.includes('lane')) {
              speedLimitMph = 30; // Local roads
            } else {
              speedLimitMph = 55; // Default for unknown roads
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
      speedLimitMph = 55;
      source = 'fallback';
      console.log('[SPEED_LIMIT] Using default fallback: 55 mph');
    }

    const result = {
      speedLimitMph,
      speedLimitKmh: Math.round(speedLimitMph * 1.60934),
      roadName,
      roadClass,
      source,
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
