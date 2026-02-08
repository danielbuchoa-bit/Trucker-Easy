import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCircle, Truck, ArrowRight, Crown, Loader2 } from 'lucide-react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { PRO_PLAN } from '@/lib/subscriptionTiers';
import Confetti from '@/components/ui/confetti';

export default function SubscriptionSuccess() {
  const navigate = useNavigate();
  const { checkSubscription, isLoading } = useSubscription();
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    checkSubscription();
    const timer = setTimeout(() => setShowConfetti(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {showConfetti && <Confetti />}
      
      <Card className="max-w-md w-full p-8 text-center space-y-6">
        <div className="flex justify-center">
          <div className="p-4 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 bg-opacity-10">
            {isLoading ? (
              <Loader2 className="h-16 w-16 animate-spin text-primary" />
            ) : (
              <Crown className="h-16 w-16 text-white" />
            )}
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Welcome to PRO! 🎉</h1>
          <p className="text-muted-foreground">
            Your subscription has been activated. You now have full access to all features.
          </p>
        </div>

        <div className="bg-muted/50 rounded-lg p-4">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{PRO_PLAN.trial_days} days free</span> to try it out. 
            After the trial, your subscription renews automatically.
          </p>
        </div>

        <div className="space-y-3 text-left">
          <h3 className="font-semibold text-center">What you can do now:</h3>
          <ul className="space-y-2">
            {PRO_PLAN.features.slice(0, 5).map((feature, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3 pt-4">
          <Button onClick={() => navigate('/home')} className="w-full" size="lg">
            <Truck className="h-5 w-5 mr-2" />
            Start Navigating
            <ArrowRight className="h-5 w-5 ml-2" />
          </Button>
          <Button variant="outline" onClick={() => navigate('/profile')} className="w-full">
            View My Profile
          </Button>
        </div>

        <p className="text-xs text-muted-foreground pt-4">
          You can manage your subscription anytime in your profile settings.
        </p>
      </Card>
    </div>
  );
}
