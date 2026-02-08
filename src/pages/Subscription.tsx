import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Loader2, ArrowLeft, Settings } from "lucide-react";
import { toast } from "sonner";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { PRO_PLAN, formatPrice } from "@/lib/subscriptionTiers";

export default function Subscription() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const { tier, currentPeriodEnd, isLoading, isSubscribed, checkSubscription } = useSubscription();
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
      if (data.url) window.location.href = data.url;
    } catch (error) {
      console.error("Error opening portal:", error);
      toast.error("Failed to open subscription management");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl py-8 px-4">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>

        <div className="text-center mb-8">
          <Crown className={`h-12 w-12 mx-auto mb-4 ${isSubscribed ? 'text-primary' : 'text-muted-foreground'}`} />
          <h1 className="text-3xl font-bold mb-2">
            {isSubscribed ? 'PRO Plan' : 'Your Subscription'}
          </h1>
          <p className="text-muted-foreground">
            {isSubscribed ? 'Manage your Trucker Easy PRO subscription' : 'Choose a plan to unlock all features'}
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : isSubscribed ? (
          <Card className="border-2 border-primary">
            <CardHeader className="text-center pb-2">
              <Badge className="w-fit mx-auto mb-2 bg-primary">Active Plan</Badge>
              <CardTitle className="text-2xl">PRO</CardTitle>
              <CardDescription>{PRO_PLAN.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ul className="space-y-3">
                {PRO_PLAN.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-primary flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="bg-primary/10 p-4 rounded-lg text-center">
                <p className="font-medium text-primary">✓ Subscription active</p>
                {currentPeriodEnd && (
                  <p className="text-sm mt-1 text-muted-foreground">
                    Renews: {new Date(currentPeriodEnd).toLocaleDateString("en-US", {
                      year: 'numeric', month: 'long', day: 'numeric'
                    })}
                  </p>
                )}
              </div>

              <Button onClick={handleManageSubscription} variant="outline" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Settings className="mr-2 h-4 w-4" />}
                Manage Subscription
              </Button>

              <Button variant="ghost" onClick={checkSubscription} className="w-full text-sm" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Refresh subscription status
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="text-center">
              <CardTitle>No Active Subscription</CardTitle>
              <CardDescription>Get PRO to access all Trucker Easy features</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                    <Crown className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium">PRO</p>
                    <p className="text-sm text-muted-foreground">
                      From {formatPrice(PRO_PLAN.monthly.amount)}/month
                    </p>
                  </div>
                </div>
              </div>
              <Button onClick={() => navigate('/choose-plan')} className="w-full" size="lg">
                <Crown className="mr-2 h-4 w-4" /> Get PRO
              </Button>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground mt-6">Cancel anytime. No commitment.</p>
      </div>
    </div>
  );
}
