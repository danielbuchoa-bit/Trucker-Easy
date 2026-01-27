import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SubscriptionTier, hasTierAccess } from '@/lib/subscriptionTiers';

type SubscriptionProvider = 'stripe' | 'apple' | 'google';
type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired';

interface SubscriptionState {
  tier: SubscriptionTier;
  provider: SubscriptionProvider | null;
  status: SubscriptionStatus | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  isLoading: boolean;
  isSubscribed: boolean;
}

interface SubscriptionContextValue extends SubscriptionState {
  checkSubscription: () => Promise<void>;
  hasAccess: (requiredTier: SubscriptionTier) => boolean;
  needsUpgrade: (requiredTier: SubscriptionTier) => boolean;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SubscriptionState>({
    tier: 'none',
    provider: null,
    status: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    isLoading: true,
    isSubscribed: false,
  });

  const checkSubscription = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setState({
          tier: 'none',
          provider: null,
          status: null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          isLoading: false,
          isSubscribed: false,
        });
        return;
      }

      // Query subscriptions table directly - single source of truth
      const { data: subscription, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching subscription:', error);
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      if (!subscription) {
        // No subscription record - user has no active subscription
        setState({
          tier: 'none',
          provider: null,
          status: null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          isLoading: false,
          isSubscribed: false,
        });
        return;
      }

      // Check if subscription is active or trialing
      const isActive = subscription.status === 'active' || subscription.status === 'trialing';
      
      // Validate tier and map to SubscriptionTier
      const validTiers: SubscriptionTier[] = ['silver', 'gold', 'diamond'];
      const tier: SubscriptionTier = validTiers.includes(subscription.plan_tier as SubscriptionTier) 
        ? (subscription.plan_tier as SubscriptionTier)
        : 'none';

      setState({
        tier: isActive ? tier : 'none',
        provider: subscription.provider as SubscriptionProvider,
        status: subscription.status as SubscriptionStatus,
        currentPeriodEnd: subscription.current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
        isLoading: false,
        isSubscribed: isActive,
      });
    } catch (error) {
      console.error('Error in checkSubscription:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  // Check subscription on mount and auth changes
  useEffect(() => {
    checkSubscription();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkSubscription();
    });

    // Auto-refresh every 60 seconds
    const interval = setInterval(checkSubscription, 60000);

    // Subscribe to realtime updates on subscriptions table
    const channel = supabase
      .channel('subscription-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscriptions',
        },
        () => {
          // Refresh when subscription changes
          checkSubscription();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [checkSubscription]);

  const hasAccess = useCallback((requiredTier: SubscriptionTier) => {
    return hasTierAccess(state.tier, requiredTier);
  }, [state.tier]);

  const needsUpgrade = useCallback((requiredTier: SubscriptionTier) => {
    return !hasTierAccess(state.tier, requiredTier);
  }, [state.tier]);

  return (
    <SubscriptionContext.Provider value={{
      ...state,
      checkSubscription,
      hasAccess,
      needsUpgrade,
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}
