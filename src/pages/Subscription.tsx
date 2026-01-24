import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Loader2, ArrowLeft, Settings, Shield, Gem } from "lucide-react";
import { toast } from "sonner";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { SUBSCRIPTION_TIERS, formatPrice, SubscriptionTier } from "@/lib/subscriptionTiers";

const TIER_ICONS = {
  shield: Shield,
  crown: Crown,
  gem: Gem,
};

export default function Subscription() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const { tier, subscriptionEnd, isLoading, isSubscribed, checkSubscription } = useSubscription();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");

    if (success === "true") {
      toast.success("Subscription activated successfully!");
      checkSubscription();
      window.history.replaceState({}, "", "/subscription");
    } else if (canceled === "true") {
      toast.info("Subscription canceled");
      window.history.replaceState({}, "", "/subscription");
    }
  }, [searchParams, checkSubscription]);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    checkAuth();
  }, []);

  const handleManageSubscription = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Error opening portal:", error);
      toast.error("Failed to open subscription management");
    } finally {
      setLoading(false);
    }
  };

  const currentTier = tier !== 'none' ? SUBSCRIPTION_TIERS[tier as Exclude<SubscriptionTier, 'none'>] : null;
  const TierIcon = currentTier ? TIER_ICONS[currentTier.icon] : Crown;

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl py-8 px-4">
        <Button 
          variant="ghost" 
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <div className="text-center mb-8">
          <TierIcon className={`h-12 w-12 mx-auto mb-4 ${
            tier === 'diamond' ? 'text-cyan-500' : 
            tier === 'gold' ? 'text-yellow-500' : 
            tier === 'silver' ? 'text-slate-400' : 'text-muted-foreground'
          }`} />
          <h1 className="text-3xl font-bold mb-2">
            {isSubscribed && currentTier ? `${currentTier.name} Plan` : 'Your Subscription'}
          </h1>
          <p className="text-muted-foreground">
            {isSubscribed 
              ? 'Manage your Trucker Easy subscription'
              : 'Choose a plan to unlock all features'}
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : isSubscribed && currentTier ? (
          <Card className="border-2 border-primary">
            <CardHeader className="text-center pb-2">
              <Badge className="w-fit mx-auto mb-2 bg-primary">Active Plan</Badge>
              <CardTitle className="text-2xl">{currentTier.name}</CardTitle>
              <CardDescription>{currentTier.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ul className="space-y-3">
                {currentTier.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-primary flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="bg-primary/10 p-4 rounded-lg text-center">
                <p className="font-medium text-primary">✓ Subscription active</p>
                {subscriptionEnd && (
                  <p className="text-sm mt-1 text-muted-foreground">
                    Renews: {new Date(subscriptionEnd).toLocaleDateString("en-US", {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <Button 
                  onClick={handleManageSubscription}
                  variant="outline"
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Settings className="mr-2 h-4 w-4" />
                  )}
                  Manage Subscription
                </Button>

                {tier !== 'diamond' && (
                  <Button 
                    onClick={() => navigate('/choose-plan')}
                    className="w-full"
                  >
                    Upgrade Plan
                  </Button>
                )}
              </div>

              <Button 
                variant="ghost" 
                onClick={checkSubscription}
                className="w-full text-sm"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Refresh subscription status
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="text-center">
              <CardTitle>No Active Subscription</CardTitle>
              <CardDescription>
                Choose a plan to access all Trucker Easy features
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                {Object.values(SUBSCRIPTION_TIERS).map((tierDef) => {
                  const Icon = TIER_ICONS[tierDef.icon];
                  return (
                    <div 
                      key={tierDef.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${tierDef.color} flex items-center justify-center`}>
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <p className="font-medium">{tierDef.name}</p>
                          <p className="text-sm text-muted-foreground">
                            From {formatPrice(tierDef.prices.monthly.amount)}/month
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Button 
                onClick={() => navigate('/choose-plan')}
                className="w-full"
                size="lg"
              >
                <Crown className="mr-2 h-4 w-4" />
                Choose a Plan
              </Button>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground mt-6">
          Cancel anytime. No commitment.
        </p>
      </div>
    </div>
  );
}
