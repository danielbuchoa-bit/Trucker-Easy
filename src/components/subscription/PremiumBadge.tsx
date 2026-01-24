import React from 'react';
import { Crown, Gem, Shield, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useFeatureAccess, FeatureKey, FEATURE_NAMES } from '@/hooks/useFeatureAccess';
import { useLanguage } from '@/i18n/LanguageContext';
import { SUBSCRIPTION_TIERS, SubscriptionTier } from '@/lib/subscriptionTiers';

interface PremiumBadgeProps {
  feature: FeatureKey;
  className?: string;
  showLock?: boolean;
}

const TIER_ICONS = {
  silver: Shield,
  gold: Crown,
  diamond: Gem,
};

const TIER_COLORS = {
  silver: 'bg-slate-500/10 text-slate-600 border-slate-500/30',
  gold: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  diamond: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/30',
};

/**
 * Shows a badge indicating what tier is required for a feature
 * Only visible if user doesn't have access
 */
export function PremiumBadge({ feature, className = '', showLock = true }: PremiumBadgeProps) {
  const { canAccess, getRequiredTier } = useFeatureAccess();
  const { language } = useLanguage();
  
  // Don't show badge if user has access
  if (canAccess(feature)) {
    return null;
  }
  
  const requiredTier = getRequiredTier(feature);
  const tierInfo = SUBSCRIPTION_TIERS[requiredTier];
  const Icon = TIER_ICONS[requiredTier];
  const colorClass = TIER_COLORS[requiredTier];
  
  const featureName = FEATURE_NAMES[language as keyof typeof FEATURE_NAMES]?.[feature] 
    || FEATURE_NAMES.en[feature];
  
  const tooltipText = language === 'pt' 
    ? `${featureName} requer plano ${tierInfo.name}`
    : language === 'es'
    ? `${featureName} requiere plan ${tierInfo.name}`
    : `${featureName} requires ${tierInfo.name} plan`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={`${colorClass} ${className} cursor-help`}
          >
            {showLock && <Lock className="h-3 w-3 mr-1" />}
            <Icon className="h-3 w-3 mr-1" />
            {tierInfo.name}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Shows current subscription tier badge
 */
export function SubscriptionBadge({ className = '' }: { className?: string }) {
  const { tier } = useFeatureAccess();
  const { language } = useLanguage();
  
  if (tier === 'none') {
    return (
      <Badge variant="secondary" className={className}>
        {language === 'pt' ? 'Gratuito' : language === 'es' ? 'Gratis' : 'Free'}
      </Badge>
    );
  }
  
  const tierInfo = SUBSCRIPTION_TIERS[tier as Exclude<SubscriptionTier, 'none'>];
  const Icon = TIER_ICONS[tier as keyof typeof TIER_ICONS];
  const colorClass = TIER_COLORS[tier as keyof typeof TIER_COLORS];
  
  return (
    <Badge variant="outline" className={`${colorClass} ${className}`}>
      <Icon className="h-3 w-3 mr-1" />
      {tierInfo.name}
    </Badge>
  );
}
