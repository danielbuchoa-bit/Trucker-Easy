import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const webhookAuthKey = Deno.env.get("REVENUECAT_WEBHOOK_AUTH_KEY");

// Map RevenueCat entitlement IDs to plan tiers
const ENTITLEMENT_TO_TIER: Record<string, 'silver' | 'gold' | 'diamond'> = {
  'silver': 'silver',
  'gold': 'gold',
  'diamond': 'diamond',
  'trucker_silver': 'silver',
  'trucker_gold': 'gold',
  'trucker_diamond': 'diamond',
};

function mapEventToStatus(eventType: string): string | null {
  switch (eventType) {
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
    case 'PRODUCT_CHANGE':
    case 'UNCANCELLATION':
      return 'active';
    case 'CANCELLATION':
      return 'canceled';
    case 'BILLING_ISSUE':
      return 'past_due';
    case 'EXPIRATION':
      return 'expired';
    case 'SUBSCRIPTION_PAUSED':
      return 'canceled';
    default:
      return null;
  }
}

function getProviderFromStore(store: string): 'apple' | 'google' {
  return store === 'APP_STORE' || store === 'MAC_APP_STORE' ? 'apple' : 'google';
}

function getPlanTierFromEntitlements(entitlements: Record<string, unknown>): 'silver' | 'gold' | 'diamond' {
  for (const tier of ['diamond', 'gold', 'silver'] as const) {
    for (const [entitlementId] of Object.entries(entitlements)) {
      const mappedTier = ENTITLEMENT_TO_TIER[entitlementId.toLowerCase()];
      if (mappedTier === tier) {
        return tier;
      }
    }
  }
  return 'silver';
}

async function getUserIdByAppUserId(appUserId: string): Promise<string | null> {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(appUserId)) {
    return appUserId;
  }
  
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', appUserId)
    .single();
  
  return data?.id || null;
}

async function upsertSubscription(
  userId: string,
  provider: 'apple' | 'google',
  status: string,
  planTier: 'silver' | 'gold' | 'diamond',
  expirationDate: string | null,
  sourceId: string
) {
  const { error } = await supabase
    .from('subscriptions')
    .upsert({
      user_id: userId,
      provider,
      status,
      plan_tier: planTier,
      current_period_end: expirationDate,
      cancel_at_period_end: status === 'canceled',
      source_id: sourceId,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id',
    });

  if (error) {
    console.error('[revenuecat_webhook] Upsert error:', error);
    throw error;
  }

  console.log(`[revenuecat_webhook] Updated: user=${userId}, tier=${planTier}, status=${status}`);
}

function verifyWebhookSignature(authHeader: string | null, authKey: string): boolean {
  if (!authHeader) return false;
  return authHeader === authKey || authHeader === `Bearer ${authKey}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    });
  }

  const authHeader = req.headers.get('authorization');
  
  if (!webhookAuthKey) {
    console.error('[revenuecat_webhook] REVENUECAT_WEBHOOK_AUTH_KEY not configured');
    return new Response(JSON.stringify({ error: 'Webhook not configured' }), { status: 500 });
  }

  if (!verifyWebhookSignature(authHeader, webhookAuthKey)) {
    console.error('[revenuecat_webhook] Invalid authorization');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const body = await req.json();
    const { event } = body;
    
    if (!event) {
      return new Response(JSON.stringify({ error: 'No event' }), { status: 400 });
    }

    console.log(`[revenuecat_webhook] Event: ${event.type}`);

    const status = mapEventToStatus(event.type);
    if (!status) {
      return new Response(JSON.stringify({ received: true }), { status: 200 });
    }

    const appUserId = event.app_user_id;
    if (!appUserId) {
      return new Response(JSON.stringify({ error: 'No app_user_id' }), { status: 400 });
    }

    const userId = await getUserIdByAppUserId(appUserId);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
    }

    const store = event.store || 'PLAY_STORE';
    const provider = getProviderFromStore(store);
    
    let planTier: 'silver' | 'gold' | 'diamond' = 'silver';
    
    if (Array.isArray(event.entitlement_ids)) {
      for (const entId of event.entitlement_ids) {
        const tier = ENTITLEMENT_TO_TIER[entId.toLowerCase()];
        if (tier) {
          planTier = tier;
          break;
        }
      }
    } else if (typeof event.entitlements === 'object' && event.entitlements) {
      planTier = getPlanTierFromEntitlements(event.entitlements);
    }

    const expirationDate = event.expiration_at_ms 
      ? new Date(event.expiration_at_ms).toISOString()
      : null;

    const sourceId = event.original_transaction_id || event.transaction_id || `rc_${appUserId}`;

    await upsertSubscription(userId, provider, status, planTier, expirationDate, sourceId);

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[revenuecat_webhook] Error:', message);
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
});
