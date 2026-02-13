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
const telegramBotToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
const telegramChatId = Deno.env.get("TELEGRAM_CHAT_ID");

const REFERRAL_COUPON_ID = "1Obg7UIY";

async function sendTelegramAlert(message: string) {
  if (!telegramBotToken || !telegramChatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: telegramChatId, text: message, parse_mode: 'HTML' }),
    });
  } catch (err) {
    console.error('[stripe_webhook] Telegram error:', err);
  }
}

// Referral cycle progression
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
  const { data } = await supabase.from('profiles').select('id').eq('email', email).single();
  return data?.id || null;
}

async function upsertSubscription(userId: string, subscription: Stripe.Subscription) {
  const status = mapStatusToDb(subscription.status);
  const currentPeriodEnd = subscription.current_period_end 
    ? new Date(subscription.current_period_end * 1000).toISOString() : null;

  console.log(`[stripe_webhook] Upserting: user=${userId}, tier=pro, status=${status}`);

  const { error } = await supabase.from('subscriptions').upsert({
    user_id: userId, provider: 'stripe', status, plan_tier: 'pro',
    current_period_end: currentPeriodEnd,
    cancel_at_period_end: subscription.cancel_at_period_end || false,
    source_id: subscription.id, updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });

  if (error) {
    console.error('[stripe_webhook] Upsert error:', error);
    throw error;
  }
}

async function deleteSubscription(userId: string) {
  await supabase.from('subscriptions').delete().eq('user_id', userId);
}

async function getUserIdFromSubscription(subscription: Stripe.Subscription): Promise<string | null> {
  const metadataUserId = subscription.metadata?.user_id;
  if (metadataUserId) return metadataUserId;

  try {
    const customer = await stripe.customers.retrieve(subscription.customer as string);
    if (!customer || customer.deleted || !('email' in customer) || !customer.email) return null;
    return await getUserIdByEmail(customer.email);
  } catch {
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
  if (subscription.status === 'active' || subscription.status === 'trialing') {
    await updateReferralOnSubscribe(userId);
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = await getUserIdFromSubscription(subscription);
  if (!userId) return;
  await deleteSubscription(userId);

  // Expire pending referrals
  await supabase.from('referrals').update({ status: 'invalid' })
    .eq('referred_user_id', userId)
    .in('status', ['subscribed', 'cycle1', 'cycle2']);
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  console.log(`[stripe_webhook] Checkout completed: ${session.id}, mode: ${session.mode}`);
  const userId = session.metadata?.user_id;
  if (!userId) return;

  const subscriptionId = session.subscription as string | null;
  const planType = session.metadata?.plan_type || 'monthly';

  try {
    if (subscriptionId) {
      // --- Monthly recurring subscription ---
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      
      if (!subscription.metadata?.user_id) {
        await stripe.subscriptions.update(subscriptionId, {
          metadata: {
            user_id: userId,
            user_email: session.customer_email || session.metadata?.user_email || '',
          },
        });
      }

      await upsertSubscription(userId, subscription);
      
      if (subscription.status === 'active' || subscription.status === 'trialing') {
        await updateReferralOnSubscribe(userId);
      }
    } else if (session.mode === 'payment' || planType === 'annual') {
      // --- Annual one-time payment ---
      console.log(`[stripe_webhook] One-time annual payment for user ${userId}`);
      
      // Calculate 1 year from now
      const oneYearFromNow = new Date();
      oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

      const { error } = await supabase.from('subscriptions').upsert({
        user_id: userId,
        provider: 'stripe',
        status: 'active',
        plan_tier: 'pro',
        current_period_end: oneYearFromNow.toISOString(),
        cancel_at_period_end: false,
        source_id: (session.payment_intent as string) || session.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

      if (error) {
        console.error('[stripe_webhook] Annual upsert error:', error);
        throw error;
      }

      await updateReferralOnSubscribe(userId);
    }

    // Handle referral code from checkout metadata
    const referralCode = session.metadata?.referral_code;
    if (referralCode) {
      await linkReferralFromCheckout(userId, referralCode);
    }

    const planLabel = planType === 'annual' ? 'Anual (pagamento único)' : 'Mensal';
    await sendTelegramAlert(
      `🚀 <b>Nova Assinatura PRO!</b>\n\n` +
      `📧 <b>Email:</b> ${session.customer_email || 'N/A'}\n` +
      `🆔 <b>User ID:</b> ${userId}\n` +
      `📋 <b>Plano:</b> ${planLabel}\n` +
      `📅 <b>Data:</b> ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`
    );
  } catch (err) {
    console.error('[stripe_webhook] Error processing checkout:', err);
  }
}

async function linkReferralFromCheckout(userId: string, referralCode: string) {
  // Find the referral invite by code and link the referred user
  const { data: referral } = await supabase
    .from('referrals')
    .select('*')
    .eq('invite_code', referralCode)
    .eq('status', 'invited')
    .is('referred_user_id', null)
    .maybeSingle();

  if (referral && referral.referrer_user_id !== userId) {
    await supabase.from('referrals').update({
      referred_user_id: userId,
      status: 'subscribed',
    }).eq('id', referral.id);
    console.log(`[stripe_webhook] Linked referral ${referral.id} to user ${userId}`);
  }
}

async function updateReferralOnSubscribe(userId: string) {
  const { data: referral } = await supabase
    .from('referrals').select('*')
    .eq('referred_user_id', userId)
    .eq('status', 'installed')
    .maybeSingle();

  if (referral) {
    await supabase.from('referrals').update({ status: 'subscribed' }).eq('id', referral.id);
  }
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  if (!invoice.subscription) return;
  const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
  await handleSubscriptionEvent(subscription);

  const userId = await getUserIdFromSubscription(subscription);
  if (!userId) return;
  await processReferralCycle(userId);
}

async function processReferralCycle(userId: string) {
  const { data: referral } = await supabase
    .from('referrals').select('*')
    .eq('referred_user_id', userId)
    .in('status', ['subscribed', 'cycle1', 'cycle2'])
    .maybeSingle();

  if (!referral) return;

  const nextStatus = CYCLE_PROGRESSION[referral.status];
  if (!nextStatus) return;

  await supabase.from('referrals').update({ status: nextStatus }).eq('id', referral.id);
  console.log(`[stripe_webhook] Referral ${referral.id}: ${referral.status} -> ${nextStatus}`);

  // After 3rd payment, grant 50% discount coupon to referrer
  if (nextStatus === 'cycle3') {
    await grantReferralReward(referral);
  }
}

async function grantReferralReward(referral: any) {
  console.log(`[stripe_webhook] Granting 50% discount to referrer ${referral.referrer_user_id}`);

  // Find referrer's Stripe customer
  const { data: profile } = await supabase
    .from('profiles').select('email').eq('id', referral.referrer_user_id).single();
  
  if (!profile?.email) {
    console.error('[stripe_webhook] Referrer profile not found');
    return;
  }

  try {
    const customers = await stripe.customers.list({ email: profile.email, limit: 1 });
    if (customers.data.length === 0) {
      console.error('[stripe_webhook] Referrer has no Stripe customer');
      return;
    }

    const customerId = customers.data[0].id;

    // Find referrer's active subscription
    const subs = await stripe.subscriptions.list({ customer: customerId, status: 'active', limit: 1 });
    if (subs.data.length === 0) {
      console.error('[stripe_webhook] Referrer has no active subscription');
      return;
    }

    // Apply 50% coupon to referrer's subscription
    await stripe.subscriptions.update(subs.data[0].id, {
      coupon: REFERRAL_COUPON_ID,
    });

    // Update referral status
    await supabase.from('referrals').update({ 
      status: 'reward_earned',
      reward_reason: '50% discount applied after 3rd payment by referred user',
    }).eq('id', referral.id);

    // Also create a credit record for tracking
    await supabase.from('user_credits').insert({
      user_id: referral.referrer_user_id,
      amount_cents: referral.reward_amount_cents || 0,
      currency: 'usd',
      source: 'referral',
      referral_id: referral.id,
      status: 'applied',
    });

    await sendTelegramAlert(
      `🎉 <b>Referral Reward!</b>\n\n` +
      `📧 <b>Referrer:</b> ${profile.email}\n` +
      `🎁 <b>Reward:</b> 50% off next month\n` +
      `📅 <b>Data:</b> ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`
    );

    console.log(`[stripe_webhook] 50% coupon applied to referrer's subscription`);
  } catch (err) {
    console.error('[stripe_webhook] Error applying referral reward:', err);
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  if (!invoice.subscription) return;
  const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
  await handleSubscriptionEvent(subscription);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'stripe-signature, content-type' },
    });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) return new Response(JSON.stringify({ error: 'Missing signature' }), { status: 400 });
  if (!endpointSecret) return new Response(JSON.stringify({ error: 'Webhook secret not configured' }), { status: 500 });

  try {
    const body = await req.text();
    const event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
    console.log(`[stripe_webhook] Event: ${event.type}`);

    switch (event.type) {
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
        console.log(`[stripe_webhook] Unhandled: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' }, status: 200,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[stripe_webhook] Error:', message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { 'Content-Type': 'application/json' }, status: 400,
    });
  }
});
