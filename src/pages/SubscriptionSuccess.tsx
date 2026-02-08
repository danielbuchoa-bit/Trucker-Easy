import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCircle, Truck, ArrowRight, Crown, Gem, Shield, Loader2 } from 'lucide-react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { SUBSCRIPTION_TIERS } from '@/lib/subscriptionTiers';
import Confetti from '@/components/ui/confetti';

export default function SubscriptionSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { tier, checkSubscription, isLoading } = useSubscription();
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    // Refresh subscription status after successful payment
    checkSubscription();
    
    // Hide confetti after 5 seconds
    const timer = setTimeout(() => setShowConfetti(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  const getTierIcon = () => {
    switch (tier) {
      case 'diamond':
        return <Gem className="h-16 w-16 text-purple-500" />;
      case 'gold':
        return <Crown className="h-16 w-16 text-yellow-500" />;
      case 'silver':
        return <Shield className="h-16 w-16 text-slate-400" />;
      default:
        return <CheckCircle className="h-16 w-16 text-green-500" />;
    }
  };

  const getTierName = () => {
    if (tier && tier !== 'none' && SUBSCRIPTION_TIERS[tier]) {
      return SUBSCRIPTION_TIERS[tier].name;
    }
    return 'Premium';
  };

  const getTierColor = () => {
    switch (tier) {
      case 'diamond':
        return 'from-purple-500 to-pink-500';
      case 'gold':
        return 'from-yellow-500 to-orange-500';
      case 'silver':
        return 'from-slate-400 to-slate-500';
      default:
        return 'from-green-500 to-emerald-500';
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {showConfetti && <Confetti />}
      
      <Card className="max-w-md w-full p-8 text-center space-y-6">
        {/* Success Icon */}
        <div className="flex justify-center">
          <div className={`p-4 rounded-full bg-gradient-to-br ${getTierColor()} bg-opacity-10`}>
            {isLoading ? (
              <Loader2 className="h-16 w-16 animate-spin text-primary" />
            ) : (
              getTierIcon()
            )}
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Welcome to {getTierName()}! 🎉</h1>
          <p className="text-muted-foreground">
            Your subscription has been activated. You now have access to all {getTierName()} plan features.
          </p>
        </div>

        {/* Trial Info */}
        <div className="bg-muted/50 rounded-lg p-4">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">3 days free</span> to try it out. 
            After the trial period, your subscription will renew automatically.
          </p>
        </div>

        {/* Features Preview */}
        <div className="space-y-3 text-left">
          <h3 className="font-semibold text-center">What you can do now:</h3>
          <ul className="space-y-2">
            <li className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
              <span>Specialized truck GPS navigation</span>
            </li>
            <li className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
              <span>Points of interest and trucker stops</span>
            </li>
            <li className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
              <span>Professional driver community</span>
            </li>
            {(tier === 'gold' || tier === 'diamond') && (
              <li className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                <span>Offline maps and traffic alerts</span>
              </li>
            )}
            {tier === 'diamond' && (
              <li className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                <span>Trip reports and priority support</span>
              </li>
            )}
          </ul>
        </div>

        {/* CTA Buttons */}
        <div className="space-y-3 pt-4">
          <Button 
            onClick={() => navigate('/home')} 
            className="w-full"
            size="lg"
          >
            <Truck className="h-5 w-5 mr-2" />
            Start Navigating
            <ArrowRight className="h-5 w-5 ml-2" />
          </Button>
          
          <Button 
            variant="outline" 
            onClick={() => navigate('/profile')}
            className="w-full"
          >
            View My Profile
          </Button>
        </div>

        {/* Footer */}
        <p className="text-xs text-muted-foreground pt-4">
          You can manage your subscription anytime in your profile settings.
        </p>
      </Card>
    </div>
  );
}
