import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useCallback } from 'react';

/**
 * Returns a gate function. Call it before interactive actions (chat, review, etc.).
 * If user is not authenticated or not subscribed, redirects to /choose-plan and returns false.
 * Otherwise returns true — proceed with the action.
 */
export function useActionGate() {
  const { user } = useAuth();
  const { isSubscribed } = useSubscription();
  const navigate = useNavigate();

  const gate = useCallback((): boolean => {
    if (!user) {
      navigate('/auth?redirect=/choose-plan');
      return false;
    }
    if (!isSubscribed) {
      navigate('/choose-plan');
      return false;
    }
    return true;
  }, [user, isSubscribed, navigate]);

  return gate;
}
