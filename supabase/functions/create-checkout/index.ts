import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

// PRO Plan prices
const MONTHLY_PRICE_ID = "price_1SyR2S2MEO38NbGnf4yYBL5b"; // recurring/month $19.99
const ANNUAL_PRICE_ID = "price_1T0BQT2MEO38NbGn3UVcef9L";  // one-time $179.99
const REFERRAL_COUPON_ID = "1Obg7UIY";
const TRIAL_DAYS = 5;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    let priceId = MONTHLY_PRICE_ID;
    let referralCode: string | undefined;
    let planType: 'monthly' | 'annual' = 'monthly';
    
    try {
      const body = await req.json();
      if (body.priceId) {
        priceId = body.priceId;
      }
      if (body.referralCode) {
        referralCode = body.referralCode;
      }
      if (body.planType) {
        planType = body.planType;
      }
    } catch {
      // No body or invalid JSON, use defaults
    }

    // Determine mode based on price
    const isAnnual = priceId === ANNUAL_PRICE_ID || planType === 'annual';
    const mode = isAnnual ? 'payment' : 'subscription';
    
    logStep("Plan config", { priceId, mode, planType, referralCode: referralCode || 'none' });

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { email: user.email });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { 
      apiVersion: "2025-08-27.basil" 
    });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    }

    // Build checkout session config
    const sessionConfig: any = {
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode,
      success_url: `${req.headers.get("origin")}/subscription/success`,
      cancel_url: `${req.headers.get("origin")}/choose-plan?canceled=true`,
      metadata: {
        user_id: user.id,
        requested_price_id: priceId,
        plan_type: isAnnual ? 'annual' : 'monthly',
      },
    };

    // Only add subscription-specific options for monthly recurring
    if (mode === 'subscription') {
      sessionConfig.allow_promotion_codes = !referralCode;
      sessionConfig.subscription_data = {
        trial_period_days: TRIAL_DAYS,
        metadata: {
          user_id: user.id,
          user_email: user.email,
        },
      };

      // Apply referral coupon if valid code provided
      if (referralCode) {
        logStep("Applying referral coupon", { referralCode });
        sessionConfig.discounts = [{ coupon: REFERRAL_COUPON_ID }];
        sessionConfig.metadata.referral_code = referralCode;
      }
    }

    // For one-time payment (annual), add payment metadata
    if (mode === 'payment') {
      sessionConfig.payment_intent_data = {
        metadata: {
          user_id: user.id,
          user_email: user.email,
          plan_type: 'annual',
        },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);
    logStep("Checkout session created", { sessionId: session.id, mode });

    return new Response(JSON.stringify({ url: session.url }), {
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
