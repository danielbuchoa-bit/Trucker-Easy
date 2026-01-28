import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

// Map Stripe price IDs to plan tiers
const PRICE_TO_TIER: Record<string, 'silver' | 'gold' | 'diamond'> = {
  // Silver prices
  'price_1Ssvqk2MEO38NbGnrwicv0nZ': 'silver', // monthly
  'price_1Ssvr02MEO38NbGnHCesYJTW': 'silver', // annual
  // Gold prices
  'price_1SsvrH2MEO38NbGnotCQ0O6t': 'gold', // monthly
  'price_1Ssvra2MEO38NbGnQlRov7sI': 'gold', // annual
  // Diamond prices
  'price_1SsvsT2MEO38NbGnVvDveuJ4': 'diamond', // monthly
  'price_1Ssvsd2MEO38NbGnsBl3ne5X': 'diamond', // annual
};

// Map Stripe product IDs to plan tiers (fallback)
const PRODUCT_TO_TIER: Record<string, 'silver' | 'gold' | 'diamond'> = {
  'prod_Tqd6KgfSHZl70M': 'silver',
  'prod_Tqd7gxOqCVfQfZ': 'silver',
  'prod_Tqd7XjlDhI502Y': 'gold',
  'prod_Tqd7fgQhIoNao2': 'gold',
  'prod_Tqd8Zl3fQQuQ4Z': 'diamond',
  'prod_Tqd8hhSX3tN1xF': 'diamond',
};

function getTierFromSubscription(subscription: Stripe.Subscription): 'silver' | 'gold' | 'diamond' {
  const priceId = subscription.items.data[0]?.price?.id;
  const productId = subscription.items.data[0]?.price?.product as string;
  
  if (priceId && PRICE_TO_TIER[priceId]) {
    return PRICE_TO_TIER[priceId];
  }
  if (productId && PRODUCT_TO_TIER[productId]) {
    return PRODUCT_TO_TIER[productId];
  }
  return 'silver';
}

function mapStatusToDb(stripeStatus: string): string {
  switch (stripeStatus) {
    case 'active': return 'active';
    case 'trialing': return 'trialing';
    case 'past_due': return 'past_due';
    case 'canceled': return 'canceled';
    case 'unpaid': return 'past_due';
    case 'incomplete': return 'past_due';
    case 'incomplete_expired': return 'expired';
    default: return 'expired';
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    if (customers.data.length === 0) {
      logStep("No Stripe customer found - clearing any local subscription");
      
      // Remove any existing subscription for this user
      await supabaseClient
        .from('subscriptions')
        .delete()
        .eq('user_id', user.id);
      
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // Check for active or trialing subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 10,
    });

    // Find the first active or trialing subscription
    const activeSubscription = subscriptions.data.find(
      (sub: Stripe.Subscription) => sub.status === "active" || sub.status === "trialing"
    );

    if (!activeSubscription) {
      logStep("No active subscription found - clearing local subscription");
      
      // Check for canceled/expired subscriptions
      const canceledSub = subscriptions.data.find(
        (sub: Stripe.Subscription) => sub.status === "canceled"
      );
      
      if (canceledSub) {
        // Update local subscription to canceled status
        await supabaseClient
          .from('subscriptions')
          .upsert({
            user_id: user.id,
            provider: 'stripe',
            status: 'canceled',
            plan_tier: getTierFromSubscription(canceledSub),
            source_id: canceledSub.id,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });
      } else {
        // No subscription at all - remove local record
        await supabaseClient
          .from('subscriptions')
          .delete()
          .eq('user_id', user.id);
      }
      
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // We have an active subscription - sync it to database
    const planTier = getTierFromSubscription(activeSubscription);
    const status = mapStatusToDb(activeSubscription.status);
    
    // Safely handle the period end date
    let subscriptionEnd: string | null = null;
    const periodEnd = activeSubscription.current_period_end;
    if (periodEnd && typeof periodEnd === 'number') {
      subscriptionEnd = new Date(periodEnd * 1000).toISOString();
    } else if (activeSubscription.trial_end && typeof activeSubscription.trial_end === 'number') {
      subscriptionEnd = new Date(activeSubscription.trial_end * 1000).toISOString();
    }

    logStep("Syncing active subscription to database", { 
      tier: planTier, 
      status, 
      subscriptionId: activeSubscription.id,
      endDate: subscriptionEnd 
    });

    // ALWAYS sync the subscription to our database
    const { error: upsertError } = await supabaseClient
      .from('subscriptions')
      .upsert({
        user_id: user.id,
        provider: 'stripe',
        status,
        plan_tier: planTier,
        current_period_end: subscriptionEnd,
        cancel_at_period_end: activeSubscription.cancel_at_period_end || false,
        source_id: activeSubscription.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (upsertError) {
      logStep("ERROR syncing subscription to database", { error: upsertError.message });
    } else {
      logStep("Successfully synced subscription to database");
    }

    const priceProduct = activeSubscription.items.data[0]?.price?.product;
    const productId = typeof priceProduct === 'string' ? priceProduct : priceProduct?.id;

    return new Response(JSON.stringify({
      subscribed: true,
      product_id: productId,
      plan_tier: planTier,
      subscription_end: subscriptionEnd
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
