-- Create enum for referral status
CREATE TYPE public.referral_status AS ENUM (
  'invited',
  'installed', 
  'subscribed',
  'cycle1',
  'cycle2',
  'cycle3',
  'reward_earned',
  'reward_applied',
  'invalid'
);

-- Create enum for credit status
CREATE TYPE public.credit_status AS ENUM (
  'available',
  'applied',
  'expired'
);

-- Create referrals table
CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE,
  invite_link TEXT NOT NULL,
  status public.referral_status NOT NULL DEFAULT 'invited',
  referred_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  referred_email TEXT,
  referred_phone TEXT,
  reward_amount_cents INTEGER NOT NULL DEFAULT 350,
  reward_currency TEXT NOT NULL DEFAULT 'usd',
  reward_reason TEXT,
  fraud_flag BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_credits table
CREATE TABLE public.user_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  source TEXT NOT NULL DEFAULT 'referral',
  referral_id UUID REFERENCES public.referrals(id) ON DELETE SET NULL,
  status public.credit_status NOT NULL DEFAULT 'available',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  applied_at TIMESTAMP WITH TIME ZONE
);

-- Create index for faster lookups
CREATE INDEX idx_referrals_referrer ON public.referrals(referrer_user_id);
CREATE INDEX idx_referrals_invite_code ON public.referrals(invite_code);
CREATE INDEX idx_referrals_referred_user ON public.referrals(referred_user_id);
CREATE INDEX idx_user_credits_user ON public.user_credits(user_id);
CREATE INDEX idx_user_credits_status ON public.user_credits(status);

-- Enable RLS
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

-- RLS Policies for referrals
CREATE POLICY "Users can view their own referrals"
ON public.referrals FOR SELECT
USING (auth.uid() = referrer_user_id OR auth.uid() = referred_user_id);

CREATE POLICY "Users can create referrals"
ON public.referrals FOR INSERT
WITH CHECK (auth.uid() = referrer_user_id);

CREATE POLICY "Service role can manage all referrals"
ON public.referrals FOR ALL
USING (auth.role() = 'service_role');

-- RLS Policies for user_credits
CREATE POLICY "Users can view their own credits"
ON public.user_credits FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all credits"
ON public.user_credits FOR ALL
USING (auth.role() = 'service_role');

-- Create function to update updated_at
CREATE OR REPLACE FUNCTION public.update_referrals_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create trigger for updated_at
CREATE TRIGGER update_referrals_timestamp
BEFORE UPDATE ON public.referrals
FOR EACH ROW
EXECUTE FUNCTION public.update_referrals_updated_at();

-- Function to check monthly referral reward limit (max 2 per month)
CREATE OR REPLACE FUNCTION public.can_earn_referral_reward(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    SELECT COUNT(*)
    FROM public.user_credits
    WHERE user_id = p_user_id
      AND source = 'referral'
      AND created_at > (now() - interval '30 days')
  ) < 2
$$;

-- Function to check if invite code is valid and available
CREATE OR REPLACE FUNCTION public.is_invite_code_valid(p_code TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.referrals
    WHERE invite_code = p_code
      AND status = 'invited'
      AND referred_user_id IS NULL
      AND fraud_flag = false
  )
$$;

-- Function to get available credits for a user
CREATE OR REPLACE FUNCTION public.get_available_credits(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(amount_cents), 0)::INTEGER
  FROM public.user_credits
  WHERE user_id = p_user_id
    AND status = 'available'
$$;