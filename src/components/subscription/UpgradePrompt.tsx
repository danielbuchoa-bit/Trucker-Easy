import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lock, Crown, ArrowRight } from 'lucide-react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { SubscriptionTier } from '@/lib/subscriptionTiers';

interface UpgradePromptProps {
  requiredTier: Exclude<SubscriptionTier, 'none'>;
  featureName: string;
  compact?: boolean;
}

export function UpgradePrompt({ requiredTier, featureName, compact = false }: UpgradePromptProps) {
  const navigate = useNavigate();
  const { tier: currentTier } = useSubscription();

  if (compact) {
    return (
      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-dashed">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {featureName} requires PRO
          </span>
        </div>
        <Button size="sm" variant="outline" onClick={() => navigate('/choose-plan')}>
          Upgrade
        </Button>
      </div>
    );
  }

  return (
    <Card className="border-dashed">
      <CardHeader className="text-center pb-2">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-2">
          <Crown className="h-6 w-6 text-white" />
        </div>
        <CardTitle className="text-lg">Upgrade to PRO</CardTitle>
        <CardDescription>
          {featureName} is available on PRO plan
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <Badge variant="secondary" className="text-xs">
          {currentTier === 'none' ? 'Free plan' : 'PRO'}
        </Badge>
        <Button onClick={() => navigate('/choose-plan')} className="w-full">
          Get PRO <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

// HOC to wrap features that require a specific tier
interface FeatureGateProps {
  requiredTier: Exclude<SubscriptionTier, 'none'>;
  featureName: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function FeatureGate({ requiredTier, featureName, children, fallback }: FeatureGateProps) {
  const { hasAccess } = useSubscription();

  if (hasAccess(requiredTier)) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return <UpgradePrompt requiredTier={requiredTier} featureName={featureName} />;
}
