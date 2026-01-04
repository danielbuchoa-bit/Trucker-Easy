import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GeocodeRequest {
  query: string;
  limit?: number;
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

    const body: GeocodeRequest = await req.json();
    const { query, limit = 5 } = body;

    if (!query || query.trim().length < 3) {
      return new Response(
        JSON.stringify({ error: 'Query must be at least 3 characters', results: [] }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Geocode request:', { query, limit });

    const params = new URLSearchParams({
      apiKey: HERE_API_KEY,
      q: query,
      limit: limit.toString(),
    });

    const hereUrl = `https://geocode.search.hereapi.com/v1/geocode?${params.toString()}`;
    console.log('Calling HERE Geocoding API');

    const response = await fetch(hereUrl);
    const data = await response.json();

    if (!response.ok) {
      console.error('HERE API error:', data);
      return new Response(
        JSON.stringify({ error: 'Geocoding failed', details: data }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = data.items?.map((item: any) => ({
      id: item.id,
      title: item.title,
      address: item.address?.label || item.title,
      lat: item.position?.lat,
      lng: item.position?.lng,
      city: item.address?.city,
      state: item.address?.state,
      country: item.address?.countryName,
    })) || [];

    console.log('Geocode results:', results.length);

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in here_geocode:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
