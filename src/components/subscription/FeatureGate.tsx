import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lock, Crown, ArrowRight, Sparkles } from 'lucide-react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { SubscriptionTier } from '@/lib/subscriptionTiers';
import { useFeatureAccess, FeatureKey, FEATURE_NAMES } from '@/hooks/useFeatureAccess';
import { useLanguage } from '@/i18n/LanguageContext';

interface FeatureGateProps {
  feature: FeatureKey;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showUpgradePrompt?: boolean;
  compact?: boolean;
}

export function FeatureGate({ 
  feature, children, fallback, 
  showUpgradePrompt = true, compact = false 
}: FeatureGateProps) {
  // Single PRO plan — always show content, no upgrade gating
  return <>{children}</>;
}

interface FeatureUpgradePromptProps {
  feature: FeatureKey;
  compact?: boolean;
}

export function FeatureUpgradePrompt({ feature, compact = false }: FeatureUpgradePromptProps) {
  const navigate = useNavigate();
  const { language } = useLanguage();
  
  const featureName = FEATURE_NAMES[language as keyof typeof FEATURE_NAMES]?.[feature] 
    || FEATURE_NAMES.en[feature];

  if (compact) {
    return (
      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-dashed">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{featureName} • PRO</span>
        </div>
        <Button size="sm" variant="outline" onClick={() => navigate('/choose-plan')}>
          <Sparkles className="h-3 w-3 mr-1" />
          Upgrade
        </Button>
      </div>
    );
  }

  return (
    <Card className="border-dashed border-primary/30 bg-gradient-to-br from-background to-muted/30">
      <CardHeader className="text-center pb-2">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-3 shadow-lg">
          <Crown className="h-7 w-7 text-white" />
        </div>
        <CardTitle className="text-lg">{featureName}</CardTitle>
        <CardDescription>
          {language === 'pt' ? 'Disponível no plano PRO' :
           language === 'es' ? 'Disponible en el plan PRO' :
           'Available on PRO plan'}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <Badge variant="secondary" className="text-xs">PRO • $19.99/mo</Badge>
        <Button onClick={() => navigate('/choose-plan')} className="w-full">
          {language === 'pt' ? 'Assinar PRO' :
           language === 'es' ? 'Suscribirse PRO' :
           'Get PRO'} 
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

export function withFeatureGate<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  feature: FeatureKey,
  options?: { compact?: boolean }
) {
  return function FeatureGatedComponent(props: P) {
    return (
      <FeatureGate feature={feature} compact={options?.compact}>
        <WrappedComponent {...props} />
      </FeatureGate>
    );
  };
}

export function useCanAccessFeature(feature: FeatureKey): boolean {
  const { canAccess } = useFeatureAccess();
  return canAccess(feature);
}
