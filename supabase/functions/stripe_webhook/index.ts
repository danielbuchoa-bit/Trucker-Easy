import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2025-08-27.basil",
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const endpointSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

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

async function getUserIdByEmail(email: string): Promise<string | null> {
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single();
  return data?.id || null;
}

async function upsertSubscription(
  userId: string,
  subscription: Stripe.Subscription
) {
  const priceId = subscription.items.data[0]?.price?.id;
  const productId = subscription.items.data[0]?.price?.product as string;
  
  const planTier = PRICE_TO_TIER[priceId] || PRODUCT_TO_TIER[productId] || 'silver';
  const status = mapStatusToDb(subscription.status);
  const currentPeriodEnd = subscription.current_period_end 
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null;

  const { error } = await supabase
    .from('subscriptions')
    .upsert({
      user_id: userId,
      provider: 'stripe',
      status,
      plan_tier: planTier,
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      source_id: subscription.id,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id',
    });

  if (error) {
    console.error('[stripe_webhook] Upsert error:', error);
    throw error;
  }

  console.log(`[stripe_webhook] Subscription updated: user=${userId}, tier=${planTier}, status=${status}`);
}

async function handleSubscriptionEvent(subscription: Stripe.Subscription) {
  // Get customer email
  const customer = await stripe.customers.retrieve(subscription.customer as string);
  if (!customer || customer.deleted || !('email' in customer) || !customer.email) {
    console.error('[stripe_webhook] Customer not found or no email');
    return;
  }

  const userId = await getUserIdByEmail(customer.email);
  if (!userId) {
    console.error('[stripe_webhook] No user found for email:', customer.email);
    return;
  }

  await upsertSubscription(userId, subscription);
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  if (!invoice.subscription) return;
  
  const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
  await handleSubscriptionEvent(subscription);
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  if (!invoice.subscription) return;
  
  const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
  await handleSubscriptionEvent(subscription);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'stripe-signature, content-type',
      },
    });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new Response(JSON.stringify({ error: 'Missing signature' }), { status: 400 });
  }

  if (!endpointSecret) {
    console.error('[stripe_webhook] STRIPE_WEBHOOK_SECRET not configured');
    return new Response(JSON.stringify({ error: 'Webhook secret not configured' }), { status: 500 });
  }

  try {
    const body = await req.text();
    const event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
    
    console.log(`[stripe_webhook] Received event: ${event.type}`);

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await handleSubscriptionEvent(event.data.object as Stripe.Subscription);
        break;
      
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      
      default:
        console.log(`[stripe_webhook] Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[stripe_webhook] Error:', message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
