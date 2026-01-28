import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Generate a short unique invite code
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding similar chars
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[create_invite] Starting invite creation');
    
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
      console.error('[create_invite] Auth error:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[create_invite] User verified: ${user.id.substring(0, 8)}...`);

    // Rate limit: max 10 invites per day per user
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('referrals')
      .select('*', { count: 'exact', head: true })
      .eq('referrer_user_id', user.id)
      .gte('created_at', oneDayAgo);

    if (count && count >= 10) {
      console.warn(`[create_invite] Rate limit exceeded for user ${user.id.substring(0, 8)}`);
      return new Response(
        JSON.stringify({ error: 'Daily invite limit reached (10/day)' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate unique invite code
    let inviteCode = generateInviteCode();
    let attempts = 0;
    
    while (attempts < 5) {
      const { data: existing } = await supabase
        .from('referrals')
        .select('id')
        .eq('invite_code', inviteCode)
        .maybeSingle();
      
      if (!existing) break;
      inviteCode = generateInviteCode();
      attempts++;
    }

    // Create invite link
    const baseUrl = 'https://trucker-pathfinder-buddy.lovable.app';
    const inviteLink = `${baseUrl}/invite?code=${inviteCode}`;

    // Insert referral record
    const { data: referral, error: insertError } = await supabase
      .from('referrals')
      .insert({
        referrer_user_id: user.id,
        invite_code: inviteCode,
        invite_link: inviteLink,
        status: 'invited',
        reward_amount_cents: 350,
        reward_currency: 'usd',
      })
      .select()
      .single();

    if (insertError) {
      console.error('[create_invite] Insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create invite' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[create_invite] Created invite: ${inviteCode} for user ${user.id.substring(0, 8)}`);

    return new Response(
      JSON.stringify({
        success: true,
        invite_code: inviteCode,
        invite_link: inviteLink,
        referral_id: referral.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[create_invite] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
