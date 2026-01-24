import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SubscriptionTier, getTierFromProductId, hasTierAccess } from '@/lib/subscriptionTiers';

interface SubscriptionState {
  tier: SubscriptionTier;
  productId: string | null;
  subscriptionEnd: string | null;
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
    productId: null,
    subscriptionEnd: null,
    isLoading: true,
    isSubscribed: false,
  });

  const checkSubscription = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setState({
          tier: 'none',
          productId: null,
          subscriptionEnd: null,
          isLoading: false,
          isSubscribed: false,
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('check-subscription');
      
      if (error) {
        console.error('Error checking subscription:', error);
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      const tier = getTierFromProductId(data.product_id);
      
      setState({
        tier,
        productId: data.product_id || null,
        subscriptionEnd: data.subscription_end || null,
        isLoading: false,
        isSubscribed: data.subscribed || false,
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

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
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
