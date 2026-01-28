import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Referral {
  id: string;
  referrer_user_id: string;
  invite_code: string;
  invite_link: string;
  status: 'invited' | 'installed' | 'subscribed' | 'cycle1' | 'cycle2' | 'cycle3' | 'reward_earned' | 'reward_applied' | 'invalid';
  referred_user_id: string | null;
  referred_email: string | null;
  referred_phone: string | null;
  reward_amount_cents: number;
  reward_currency: string;
  reward_reason: string | null;
  fraud_flag: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReferralStats {
  total_invites: number;
  pending: number;
  installed: number;
  subscribed: number;
  rewards_earned: number;
  available_credits_cents: number;
}

export function useReferrals() {
  const { toast } = useToast();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const fetchReferrals = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('list_referrals');
      
      if (error) throw error;
      
      setReferrals(data.referrals || []);
      setStats(data.stats || null);
    } catch (err) {
      console.error('[useReferrals] Error fetching:', err);
      toast({
        title: 'Error',
        description: 'Failed to load referrals',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const createInvite = useCallback(async (): Promise<{ invite_code: string; invite_link: string } | null> => {
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('create_invite');
      
      if (error) throw error;
      
      if (data.success) {
        // Refresh the list
        await fetchReferrals();
        return {
          invite_code: data.invite_code,
          invite_link: data.invite_link,
        };
      }
      
      throw new Error(data.error || 'Failed to create invite');
    } catch (err: any) {
      console.error('[useReferrals] Error creating invite:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to create invite',
        variant: 'destructive',
      });
      return null;
    } finally {
      setCreating(false);
    }
  }, [fetchReferrals, toast]);

  const redeemInvite = useCallback(async (inviteCode: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('redeem_invite', {
        body: { invite_code: inviteCode },
      });
      
      if (error) throw error;
      
      if (data.success) {
        toast({
          title: 'Success!',
          description: 'Invite redeemed successfully',
        });
        return true;
      }
      
      throw new Error(data.error || 'Failed to redeem invite');
    } catch (err: any) {
      console.error('[useReferrals] Error redeeming invite:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to redeem invite',
        variant: 'destructive',
      });
      return false;
    }
  }, [toast]);

  const getStatusLabel = (status: Referral['status']): string => {
    const labels: Record<string, string> = {
      invited: 'Invited',
      installed: 'Installed',
      subscribed: 'Subscribed',
      cycle1: 'Cycle 1/3',
      cycle2: 'Cycle 2/3',
      cycle3: 'Cycle 3/3',
      reward_earned: 'Reward Earned',
      reward_applied: 'Reward Applied',
      invalid: 'Invalid',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: Referral['status']): string => {
    const colors: Record<string, string> = {
      invited: 'bg-muted text-muted-foreground',
      installed: 'bg-blue-500/10 text-blue-500',
      subscribed: 'bg-purple-500/10 text-purple-500',
      cycle1: 'bg-orange-500/10 text-orange-500',
      cycle2: 'bg-orange-500/10 text-orange-500',
      cycle3: 'bg-amber-500/10 text-amber-500',
      reward_earned: 'bg-green-500/10 text-green-500',
      reward_applied: 'bg-primary/10 text-primary',
      invalid: 'bg-destructive/10 text-destructive',
    };
    return colors[status] || 'bg-muted text-muted-foreground';
  };

  const getCycleProgress = (status: Referral['status']): number => {
    const progress: Record<string, number> = {
      invited: 0,
      installed: 15,
      subscribed: 30,
      cycle1: 50,
      cycle2: 70,
      cycle3: 90,
      reward_earned: 100,
      reward_applied: 100,
      invalid: 0,
    };
    return progress[status] || 0;
  };

  return {
    referrals,
    stats,
    loading,
    creating,
    fetchReferrals,
    createInvite,
    redeemInvite,
    getStatusLabel,
    getStatusColor,
    getCycleProgress,
  };
}
