import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[list_referrals] Fetching referrals');
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('[list_referrals] Auth error:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[list_referrals] User verified: ${user.id.substring(0, 8)}...`);

    // Fetch user's referrals
    const { data: referrals, error: fetchError } = await supabase
      .from('referrals')
      .select('*')
      .eq('referrer_user_id', user.id)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('[list_referrals] Fetch error:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch referrals' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch user's available credits
    const { data: credits } = await supabase
      .from('user_credits')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'available');

    const totalCredits = credits?.reduce((sum, c) => sum + c.amount_cents, 0) || 0;

    // Calculate stats
    const stats = {
      total_invites: referrals?.length || 0,
      pending: referrals?.filter(r => r.status === 'invited').length || 0,
      installed: referrals?.filter(r => r.status === 'installed').length || 0,
      subscribed: referrals?.filter(r => ['subscribed', 'cycle1', 'cycle2', 'cycle3'].includes(r.status)).length || 0,
      rewards_earned: referrals?.filter(r => ['reward_earned', 'reward_applied'].includes(r.status)).length || 0,
      available_credits_cents: totalCredits,
    };

    console.log(`[list_referrals] Found ${referrals?.length || 0} referrals for user ${user.id.substring(0, 8)}`);

    return new Response(
      JSON.stringify({
        referrals: referrals || [],
        stats,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[list_referrals] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
