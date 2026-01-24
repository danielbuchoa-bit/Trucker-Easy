import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lock, Crown, Gem, Shield, ArrowRight, Sparkles } from 'lucide-react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { SubscriptionTier, SUBSCRIPTION_TIERS } from '@/lib/subscriptionTiers';
import { useFeatureAccess, FeatureKey, FEATURE_NAMES } from '@/hooks/useFeatureAccess';
import { useLanguage } from '@/i18n/LanguageContext';

interface FeatureGateProps {
  feature: FeatureKey;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showUpgradePrompt?: boolean;
  compact?: boolean;
}

const TIER_ICONS = {
  silver: Shield,
  gold: Crown,
  diamond: Gem,
};

/**
 * Feature gate component that shows upgrade prompt if user doesn't have access
 */
export function FeatureGate({ 
  feature, 
  children, 
  fallback, 
  showUpgradePrompt = true,
  compact = false 
}: FeatureGateProps) {
  const { canAccess, getRequiredTier, isLoading } = useFeatureAccess();
  
  // Show loading state
  if (isLoading) {
    return null;
  }
  
  // User has access - show children
  if (canAccess(feature)) {
    return <>{children}</>;
  }
  
  // User doesn't have access - show fallback or upgrade prompt
  if (fallback) {
    return <>{fallback}</>;
  }
  
  if (showUpgradePrompt) {
    const requiredTier = getRequiredTier(feature);
    return <FeatureUpgradePrompt feature={feature} requiredTier={requiredTier} compact={compact} />;
  }
  
  return null;
}

interface FeatureUpgradePromptProps {
  feature: FeatureKey;
  requiredTier: Exclude<SubscriptionTier, 'none'>;
  compact?: boolean;
}

export function FeatureUpgradePrompt({ feature, requiredTier, compact = false }: FeatureUpgradePromptProps) {
  const navigate = useNavigate();
  const { tier: currentTier } = useSubscription();
  const { language } = useLanguage();
  const targetTier = SUBSCRIPTION_TIERS[requiredTier];
  const Icon = TIER_ICONS[requiredTier];
  
  const featureName = FEATURE_NAMES[language as keyof typeof FEATURE_NAMES]?.[feature] 
    || FEATURE_NAMES.en[feature];

  if (compact) {
    return (
      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-dashed">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {featureName} • {targetTier.name}
          </span>
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
        <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${targetTier.color} flex items-center justify-center mx-auto mb-3 shadow-lg`}>
          <Icon className="h-7 w-7 text-white" />
        </div>
        <CardTitle className="text-lg">{featureName}</CardTitle>
        <CardDescription>
          {language === 'pt' ? `Disponível no plano ${targetTier.name}` :
           language === 'es' ? `Disponible en el plan ${targetTier.name}` :
           `Available on ${targetTier.name} plan`}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <Badge variant="secondary" className="text-xs">
          {language === 'pt' ? 'Plano atual: ' :
           language === 'es' ? 'Plan actual: ' :
           'Current plan: '}
          {currentTier === 'none' ? 'Free' : SUBSCRIPTION_TIERS[currentTier as Exclude<SubscriptionTier, 'none'>]?.name || 'Free'}
        </Badge>
        <Button onClick={() => navigate('/choose-plan')} className="w-full">
          {language === 'pt' ? 'Ver Planos' :
           language === 'es' ? 'Ver Planes' :
           'View Plans'} 
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * Higher-order component to wrap entire pages/components with feature gating
 */
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

/**
 * Simple hook-based feature check for conditional rendering
 */
export function useCanAccessFeature(feature: FeatureKey): boolean {
  const { canAccess } = useFeatureAccess();
  return canAccess(feature);
}
