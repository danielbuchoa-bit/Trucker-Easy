import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReverseGeocodeRequest {
  lat: number;
  lng: number;
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

    const body: ReverseGeocodeRequest = await req.json();
    const { lat, lng } = body;

    if (lat === undefined || lng === undefined) {
      return new Response(
        JSON.stringify({ error: 'lat and lng are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Reverse geocode request:', { lat, lng });

    const params = new URLSearchParams({
      apiKey: HERE_API_KEY,
      at: `${lat},${lng}`,
      lang: 'en-US',
    });

    const hereUrl = `https://revgeocode.search.hereapi.com/v1/revgeocode?${params.toString()}`;
    const response = await fetch(hereUrl);
    const data = await response.json();

    if (!response.ok) {
      console.error('HERE API error:', data);
      return new Response(
        JSON.stringify({ error: 'Reverse geocoding failed', details: data }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const item = data.items?.[0];
    
    const result = {
      city: item?.address?.city || item?.address?.town || item?.address?.village || null,
      state: item?.address?.state || item?.address?.stateCode || null,
      stateCode: item?.address?.stateCode || null,
      road: item?.address?.street || null,
      county: item?.address?.county || null,
      district: item?.address?.district || null,
      label: item?.address?.label || null,
    };

    console.log('Reverse geocode result:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in here_reverse_geocode:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
