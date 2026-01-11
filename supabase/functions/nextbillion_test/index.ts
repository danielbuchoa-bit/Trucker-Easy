import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('NEXTBILLION_API_KEY');
    
    if (!apiKey) {
      console.error('NEXTBILLION_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Testing NextBillion.ai connectivity...');

    // Test with a simple geocode request
    const testUrl = `https://api.nextbillion.io/geocode?q=New+York&key=${apiKey}`;
    
    const response = await fetch(testUrl);
    const data = await response.json();

    console.log('NextBillion.ai response status:', response.status);
    console.log('NextBillion.ai response:', JSON.stringify(data));

    if (response.ok && data.items && data.items.length > 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'NextBillion.ai API is connected and working!',
          testResult: {
            resultsCount: data.items.length,
            sampleResult: data.items[0]?.title || 'N/A'
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: data.title || data.message || 'API test failed',
          details: data
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error testing NextBillion.ai:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
