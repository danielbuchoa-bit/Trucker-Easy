import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Check, Loader2, Truck, Gift, Sparkles, Clock, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { PRO_PLAN, formatPrice, calculateAnnualSavings } from '@/lib/subscriptionTiers';
import { User } from '@supabase/supabase-js';

interface ChoosePlanProps {
  isOnboarding?: boolean;
  onComplete?: () => void;
}

export default function ChoosePlan({ isOnboarding = false, onComplete }: ChoosePlanProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('annual');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [referralCode, setReferralCode] = useState('');
  const [referralValid, setReferralValid] = useState<boolean | null>(null);
  const [validatingCode, setValidatingCode] = useState(false);
  const autoCheckoutTriggered = useRef(false);

  const triggerCheckout = async (plan: 'monthly' | 'annual', code?: string) => {
    const priceId = plan === 'annual' 
      ? PRO_PLAN.annual.price_id 
      : PRO_PLAN.monthly.price_id;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId, planType: plan, referralCode: code || undefined }
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
        return;
      }
      throw new Error('No checkout URL returned');
    } catch (e) {
      console.error('Checkout failed:', e);
      toast.error('Failed to start checkout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setAuthLoading(false);

      // If user just came back from auth with ?auto=1, auto-trigger checkout
      if (user && searchParams.get('auto') === '1' && !autoCheckoutTriggered.current) {
        autoCheckoutTriggered.current = true;
        const pending = sessionStorage.getItem('pendingPlan');
        let plan: 'monthly' | 'annual' = 'annual';
        let code: string | undefined;
        if (pending) {
          sessionStorage.removeItem('pendingPlan');
          try {
            const parsed = JSON.parse(pending);
            if (parsed.selectedPlan) plan = parsed.selectedPlan;
            if (parsed.referralCode) code = parsed.referralCode;
          } catch {}
        }
        setSelectedPlan(plan);
        await triggerCheckout(plan, code);
      }
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const validateReferralCode = async (code: string) => {
    if (!code || code.length < 4) {
      setReferralValid(null);
      return;
    }
    setValidatingCode(true);
    try {
      const { data, error } = await supabase.functions.invoke('redeem_invite', {
        body: { invite_code: code, validate_only: true },
      });
      setReferralValid(!error && data?.valid);
    } catch {
      setReferralValid(false);
    } finally {
      setValidatingCode(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => validateReferralCode(referralCode), 500);
    return () => clearTimeout(timeout);
  }, [referralCode]);

  const handleSubscribe = async () => {
    // User is guaranteed authenticated by ProtectedRoute

    setLoading(true);
    try {
      const priceId = selectedPlan === 'annual' 
        ? PRO_PLAN.annual.price_id 
        : PRO_PLAN.monthly.price_id;

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { 
          priceId,
          planType: selectedPlan,
          referralCode: referralValid ? referralCode : undefined,
        }
      });

      if (error) throw error;

      if (data.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      toast.error('Failed to start checkout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const monthlyPrice = PRO_PLAN.monthly.amount;
  const annualPrice = PRO_PLAN.annual.amount;
  const annualMonthly = Math.round(annualPrice / 12);
  const savings = calculateAnnualSavings();
  const displayPrice = selectedPlan === 'annual' ? annualMonthly : monthlyPrice;
  const showDiscount = referralValid && selectedPlan === 'monthly';
  const discountedPrice = showDiscount ? Math.round(monthlyPrice / 2) : monthlyPrice;

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-lg py-8 px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Truck className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">TRUCKER EASY</h1>
          </div>
          <h2 className="text-xl font-semibold mb-1">Go PRO</h2>
          <p className="text-muted-foreground text-sm">
            Full access to every feature. Cancel anytime.
          </p>
        </div>

        {/* Trial Badge */}
        <div className="flex justify-center mb-6">
          <Badge className="bg-green-500/10 text-green-600 border-green-500/30 px-4 py-1.5 text-sm gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {PRO_PLAN.trial_days}-day free trial
          </Badge>
        </div>

        {/* Plan Cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {/* Monthly */}
          <Card 
            className={`p-4 cursor-pointer transition-all ${
              selectedPlan === 'monthly' 
                ? 'border-2 border-primary shadow-md' 
                : 'border-border hover:border-primary/50'
            }`}
            onClick={() => setSelectedPlan('monthly')}
          >
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Monthly</p>
              <div className="flex items-baseline justify-center gap-0.5">
                {showDiscount ? (
                  <>
                    <span className="text-lg line-through text-muted-foreground">{formatPrice(monthlyPrice)}</span>
                    <span className="text-2xl font-bold text-green-600">{formatPrice(discountedPrice)}</span>
                  </>
                ) : (
                  <span className="text-2xl font-bold">{formatPrice(monthlyPrice)}</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">/month</p>
              {showDiscount && (
                <Badge variant="secondary" className="mt-1 text-[10px] bg-green-500/10 text-green-600">
                  50% off 1st month
                </Badge>
              )}
            </div>
          </Card>

          {/* Annual */}
          <Card 
            className={`p-4 cursor-pointer transition-all relative ${
              selectedPlan === 'annual' 
                ? 'border-2 border-primary shadow-md' 
                : 'border-border hover:border-primary/50'
            }`}
            onClick={() => setSelectedPlan('annual')}
          >
            <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-[10px] px-2">
              Save {formatPrice(savings)}
            </Badge>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Annual</p>
              <span className="text-2xl font-bold">{formatPrice(annualMonthly)}</span>
              <p className="text-xs text-muted-foreground">/month</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {formatPrice(annualPrice)}/year
              </p>
            </div>
          </Card>
        </div>

        {/* Referral Code */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Gift className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Have a referral code?</span>
          </div>
          <div className="relative">
            <Input
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
              placeholder="Enter code"
              className="pr-10"
            />
            {validatingCode && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
            {referralValid === true && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Check className="h-4 w-4 text-green-500" />
              </div>
            )}
          </div>
          {referralValid === true && (
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <Tag className="h-3 w-3" /> 50% off your first month applied!
            </p>
          )}
          {referralValid === false && referralCode.length >= 4 && (
            <p className="text-xs text-destructive mt-1">Invalid referral code</p>
          )}
        </div>

        {/* CTA */}
        <Button
          onClick={handleSubscribe}
          disabled={loading}
          className="w-full bg-gradient-to-r from-primary to-primary/80"
          size="lg"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Start {PRO_PLAN.trial_days}-Day Free Trial
            </>
          )}
        </Button>
        <p className="text-center text-xs text-muted-foreground mt-2">
          Cancel anytime during the {PRO_PLAN.trial_days} days. No charge until trial ends.
        </p>

        {/* Features */}
        <div className="mt-8">
          <h3 className="text-sm font-semibold mb-3">Everything included:</h3>
          <ul className="space-y-2">
            {PRO_PLAN.features.map((feature, i) => (
              <li key={i} className="flex items-start gap-2">
                <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-muted-foreground">{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Coming Soon */}
        <div className="bg-muted/50 rounded-xl p-4 text-center mt-8">
          <h3 className="font-semibold text-sm mb-1">Coming Soon – Phase 2</h3>
          <p className="text-xs text-muted-foreground mb-2">
            Trucker Easy Shipper: Loadboard, Broker Integration & More
          </p>
          <Badge variant="outline" className="text-xs">Stay Tuned</Badge>
        </div>

        {!isOnboarding && (
          <div className="text-center mt-4">
            <Button variant="ghost" onClick={() => navigate(-1)}>Back</Button>
          </div>
        )}
      </div>
    </div>
  );
}
