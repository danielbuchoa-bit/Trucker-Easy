import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Check, Shield, Crown, Gem, Loader2, Truck, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { 
  SUBSCRIPTION_TIERS, 
  TierDefinition, 
  formatPrice, 
  calculateAnnualSavings,
  SubscriptionTier
} from '@/lib/subscriptionTiers';
import { User } from '@supabase/supabase-js';

const TIER_ICONS = {
  shield: Shield,
  crown: Crown,
  gem: Gem,
};

interface ChoosePlanProps {
  isOnboarding?: boolean;
  onComplete?: () => void;
}

export default function ChoosePlan({ isOnboarding = false, onComplete }: ChoosePlanProps) {
  const navigate = useNavigate();
  const [isAnnual, setIsAnnual] = useState(false);
  const [loading, setLoading] = useState<SubscriptionTier | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setAuthLoading(false);
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSelectPlan = async (tier: TierDefinition) => {
    // Check if user is authenticated
    if (!user) {
      toast.error('Please sign in to subscribe');
      // Store the intended plan for after login
      sessionStorage.setItem('pendingPlan', JSON.stringify({
        tierId: tier.id,
        isAnnual
      }));
      navigate('/auth');
      return;
    }

    setLoading(tier.id);
    
    try {
      const priceId = isAnnual 
        ? tier.prices.annual.price_id 
        : tier.prices.monthly.price_id;

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId }
      });

      if (error) throw error;

      if (data.url) {
        // Open Stripe Checkout in new tab to avoid iframe/redirect issues
        window.open(data.url, '_blank');
        toast.success('Checkout aberto em nova aba. Complete seu pagamento lá!');
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      toast.error('Failed to start checkout. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const tiers = Object.values(SUBSCRIPTION_TIERS);

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-6xl py-8 px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Truck className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">TRUCKER EASY</h1>
          </div>
          <h2 className="text-2xl font-semibold mb-2">Choose Your Plan</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Professional navigation built for truck drivers. Select the plan that fits your needs.
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <span className={`text-sm font-medium ${!isAnnual ? 'text-foreground' : 'text-muted-foreground'}`}>
            Monthly
          </span>
          <Switch
            checked={isAnnual}
            onCheckedChange={setIsAnnual}
          />
          <span className={`text-sm font-medium ${isAnnual ? 'text-foreground' : 'text-muted-foreground'}`}>
            Annual
          </span>
          {isAnnual && (
            <Badge variant="secondary" className="bg-green-500/10 text-green-600">
              Save up to 17%
            </Badge>
          )}
        </div>

        {/* Plans Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {tiers.map((tier) => {
            const Icon = TIER_ICONS[tier.icon];
            const price = isAnnual ? tier.prices.annual.amount : tier.prices.monthly.amount;
            const savings = calculateAnnualSavings(tier);
            const isLoading = loading === tier.id;

            return (
              <Card 
                key={tier.id}
                className={`relative p-6 flex flex-col ${
                  tier.highlight 
                    ? 'border-2 border-primary shadow-lg shadow-primary/20' 
                    : 'border-border'
                }`}
              >
                {tier.highlight && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                    Most Popular
                  </Badge>
                )}

                {/* Tier Header */}
                <div className="text-center mb-6">
                  <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${tier.color} flex items-center justify-center mx-auto mb-3`}>
                    <Icon className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold">{tier.name}</h3>
                  <p className="text-sm text-muted-foreground">{tier.description}</p>
                </div>

                {/* Price */}
                <div className="text-center mb-6">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold">{formatPrice(price)}</span>
                    <span className="text-muted-foreground">
                      /{isAnnual ? 'year' : 'month'}
                    </span>
                  </div>
                  {isAnnual && (
                    <p className="text-sm text-green-600 mt-1">
                      Save {formatPrice(savings)} per year
                    </p>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-3 flex-1 mb-6">
                  {tier.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      {feature.startsWith('Everything') ? (
                        <Zap className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      ) : (
                        <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                      )}
                      <span className={`text-sm ${feature.startsWith('Everything') ? 'font-medium text-primary' : ''}`}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <Button
                  onClick={() => handleSelectPlan(tier)}
                  disabled={!!loading}
                  className={`w-full ${
                    tier.highlight 
                      ? 'bg-gradient-to-r from-primary to-primary/80' 
                      : ''
                  }`}
                  variant={tier.highlight ? 'default' : 'outline'}
                  size="lg"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>Get {tier.name}</>
                  )}
                </Button>
              </Card>
            );
          })}
        </div>

        {/* Coming Soon Section */}
        <div className="bg-muted/50 rounded-xl p-6 text-center">
          <h3 className="font-semibold mb-2">Coming Soon – Phase 2</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Trucker Easy Shipper: Loadboard, Broker Integration & More
          </p>
          <Badge variant="outline">Stay Tuned</Badge>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          Cancel anytime. No commitment. All plans include a 7-day money-back guarantee.
        </p>

        {!isOnboarding && (
          <div className="text-center mt-4">
            <Button variant="ghost" onClick={() => navigate(-1)}>
              Back
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
