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
    console.log('[redeem_invite] Starting invite redemption');
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { invite_code } = await req.json();
    
    if (!invite_code) {
      return new Response(
        JSON.stringify({ error: 'Invite code is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
      console.error('[redeem_invite] Auth error:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[redeem_invite] User verified: ${user.id.substring(0, 8)}...`);

    // Check if user has already been referred
    const { data: existingReferral } = await supabase
      .from('referrals')
      .select('id')
      .eq('referred_user_id', user.id)
      .maybeSingle();

    if (existingReferral) {
      console.warn(`[redeem_invite] User already referred: ${user.id.substring(0, 8)}`);
      return new Response(
        JSON.stringify({ error: 'You have already been referred by someone' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find the referral by invite code
    const { data: referral, error: findError } = await supabase
      .from('referrals')
      .select('*')
      .eq('invite_code', invite_code.toUpperCase())
      .maybeSingle();

    if (findError || !referral) {
      console.warn(`[redeem_invite] Invalid invite code: ${invite_code}`);
      return new Response(
        JSON.stringify({ error: 'Invalid invite code' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if referral is already claimed
    if (referral.referred_user_id) {
      console.warn(`[redeem_invite] Invite already claimed: ${invite_code}`);
      return new Response(
        JSON.stringify({ error: 'This invite has already been used' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for self-referral
    if (referral.referrer_user_id === user.id) {
      console.warn(`[redeem_invite] Self-referral attempt: ${user.id.substring(0, 8)}`);
      return new Response(
        JSON.stringify({ error: 'You cannot use your own invite code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for same email (anti-fraud)
    const { data: referrerProfile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', referral.referrer_user_id)
      .maybeSingle();

    if (referrerProfile?.email && referrerProfile.email === user.email) {
      console.warn(`[redeem_invite] Same email fraud attempt: ${user.email}`);
      
      // Mark as fraud
      await supabase
        .from('referrals')
        .update({ fraud_flag: true, notes: 'Same email as referrer' })
        .eq('id', referral.id);

      return new Response(
        JSON.stringify({ error: 'Invalid referral' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update referral with referred user
    const { error: updateError } = await supabase
      .from('referrals')
      .update({
        referred_user_id: user.id,
        referred_email: user.email,
        status: 'installed',
      })
      .eq('id', referral.id);

    if (updateError) {
      console.error('[redeem_invite] Update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to redeem invite' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[redeem_invite] Successfully redeemed invite ${invite_code} for user ${user.id.substring(0, 8)}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Invite redeemed successfully',
        referrer_id: referral.referrer_user_id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[redeem_invite] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
