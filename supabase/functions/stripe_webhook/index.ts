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

// Referral status cycle map
const CYCLE_PROGRESSION: Record<string, string> = {
  'subscribed': 'cycle1',
  'cycle1': 'cycle2',
  'cycle2': 'cycle3',
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

  console.log(`[stripe_webhook] Upserting subscription: user=${userId}, tier=${planTier}, status=${status}, period_end=${currentPeriodEnd}`);

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

  console.log(`[stripe_webhook] Subscription updated successfully: user=${userId}, tier=${planTier}, status=${status}`);
}

async function deleteSubscription(userId: string) {
  console.log(`[stripe_webhook] Deleting subscription for user: ${userId}`);
  
  const { error } = await supabase
    .from('subscriptions')
    .delete()
    .eq('user_id', userId);

  if (error) {
    console.error('[stripe_webhook] Delete error:', error);
    throw error;
  }

  console.log(`[stripe_webhook] Subscription deleted for user: ${userId}`);
}

async function getUserIdFromSubscription(subscription: Stripe.Subscription): Promise<string | null> {
  // First try: Get user_id from subscription metadata (most reliable)
  const metadataUserId = subscription.metadata?.user_id;
  if (metadataUserId) {
    console.log(`[stripe_webhook] Found user_id in subscription metadata: ${metadataUserId}`);
    return metadataUserId;
  }

  // Second try: Get customer email and lookup user
  try {
    const customer = await stripe.customers.retrieve(subscription.customer as string);
    if (!customer || customer.deleted || !('email' in customer) || !customer.email) {
      console.error('[stripe_webhook] Customer not found or no email');
      return null;
    }

    const userId = await getUserIdByEmail(customer.email);
    if (userId) {
      console.log(`[stripe_webhook] Found user by email lookup: ${userId} (${customer.email})`);
    } else {
      console.error(`[stripe_webhook] No user found for email: ${customer.email}`);
    }
    return userId;
  } catch (err) {
    console.error('[stripe_webhook] Error looking up customer:', err);
    return null;
  }
}

async function handleSubscriptionEvent(subscription: Stripe.Subscription) {
  const userId = await getUserIdFromSubscription(subscription);
  if (!userId) {
    console.error('[stripe_webhook] Could not determine user_id for subscription:', subscription.id);
    return;
  }

  await upsertSubscription(userId, subscription);

  // Handle referral status update when user subscribes
  if (subscription.status === 'active' || subscription.status === 'trialing') {
    await updateReferralOnSubscribe(userId);
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = await getUserIdFromSubscription(subscription);
  if (!userId) {
    console.error('[stripe_webhook] Could not determine user_id for deleted subscription:', subscription.id);
    return;
  }

  // Delete the subscription record entirely
  await deleteSubscription(userId);
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  console.log(`[stripe_webhook] Processing checkout.session.completed: ${session.id}`);

  // Get user_id from session metadata
  const userId = session.metadata?.user_id;
  if (!userId) {
    console.error('[stripe_webhook] No user_id in checkout session metadata');
    return;
  }

  const subscriptionId = session.subscription as string | null;
  if (!subscriptionId) {
    console.log('[stripe_webhook] No subscription in checkout session (might be one-time payment)');
    return;
  }

  // Retrieve the subscription and update it with user_id in metadata
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    // Update subscription metadata with user_id if not already set
    if (!subscription.metadata?.user_id) {
      console.log(`[stripe_webhook] Adding user_id to subscription metadata: ${userId}`);
      await stripe.subscriptions.update(subscriptionId, {
        metadata: {
          user_id: userId,
          user_email: session.customer_email || session.metadata?.user_email || '',
        },
      });
    }

    // Immediately upsert the subscription to our database
    await upsertSubscription(userId, subscription);

    // Handle referral status
    if (subscription.status === 'active' || subscription.status === 'trialing') {
      await updateReferralOnSubscribe(userId);
    }

    console.log(`[stripe_webhook] Checkout completed and subscription activated for user: ${userId}`);
  } catch (err) {
    console.error('[stripe_webhook] Error processing checkout completion:', err);
  }
}

async function updateReferralOnSubscribe(userId: string) {
  // Check if this user was referred
  const { data: referral } = await supabase
    .from('referrals')
    .select('*')
    .eq('referred_user_id', userId)
    .eq('status', 'installed')
    .maybeSingle();

  if (referral) {
    // Update status to subscribed
    await supabase
      .from('referrals')
      .update({ status: 'subscribed' })
      .eq('id', referral.id);
    
    console.log(`[stripe_webhook] Referral ${referral.id} status updated to subscribed`);
  }
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  if (!invoice.subscription) return;
  
  const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
  await handleSubscriptionEvent(subscription);

  // Handle referral cycle counting
  const userId = await getUserIdFromSubscription(subscription);
  if (!userId) return;

  await processReferralCycle(userId);
}

async function processReferralCycle(userId: string) {
  // Check if this user was referred and is in a cycle-counting status
  const { data: referral } = await supabase
    .from('referrals')
    .select('*')
    .eq('referred_user_id', userId)
    .in('status', ['subscribed', 'cycle1', 'cycle2'])
    .maybeSingle();

  if (!referral) return;

  const nextStatus = CYCLE_PROGRESSION[referral.status];
  if (!nextStatus) return;

  // Update to next cycle
  const { error: updateError } = await supabase
    .from('referrals')
    .update({ status: nextStatus })
    .eq('id', referral.id);

  if (updateError) {
    console.error('[stripe_webhook] Failed to update referral cycle:', updateError);
    return;
  }

  console.log(`[stripe_webhook] Referral ${referral.id} cycle updated: ${referral.status} -> ${nextStatus}`);

  // If reached cycle3, grant reward to referrer
  if (nextStatus === 'cycle3') {
    await grantReferralReward(referral);
  }
}

async function grantReferralReward(referral: any) {
  console.log(`[stripe_webhook] Granting reward for referral ${referral.id}`);

  // Check if referrer can earn more rewards this month (max 2)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('user_credits')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', referral.referrer_user_id)
    .eq('source', 'referral')
    .gte('created_at', thirtyDaysAgo);

  if (count && count >= 2) {
    console.log(`[stripe_webhook] Referrer ${referral.referrer_user_id} has reached monthly reward limit`);
    await supabase
      .from('referrals')
      .update({ 
        status: 'reward_earned',
        notes: 'Reward not granted - monthly limit reached'
      })
      .eq('id', referral.id);
    return;
  }

  // Create credit for referrer
  const { error: creditError } = await supabase
    .from('user_credits')
    .insert({
      user_id: referral.referrer_user_id,
      amount_cents: referral.reward_amount_cents,
      currency: referral.reward_currency,
      source: 'referral',
      referral_id: referral.id,
      status: 'available',
    });

  if (creditError) {
    console.error('[stripe_webhook] Failed to create credit:', creditError);
    return;
  }

  // Update referral status
  await supabase
    .from('referrals')
    .update({ 
      status: 'reward_earned',
      reward_reason: '3 successful payment cycles completed'
    })
    .eq('id', referral.id);

  console.log(`[stripe_webhook] Credit of ${referral.reward_amount_cents} cents granted to ${referral.referrer_user_id}`);
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
      // Handle checkout completion FIRST - this is where we get user_id from metadata
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionEvent(event.data.object as Stripe.Subscription);
        break;
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
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
