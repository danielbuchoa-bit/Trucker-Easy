import React from 'react';
import { Crown, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useFeatureAccess, FeatureKey, FEATURE_NAMES } from '@/hooks/useFeatureAccess';
import { useLanguage } from '@/i18n/LanguageContext';

interface PremiumBadgeProps {
  feature: FeatureKey;
  className?: string;
  showLock?: boolean;
}

/**
 * Shows a badge indicating PRO is required for a feature
 * Only visible if user doesn't have access
 */
export function PremiumBadge({ feature, className = '', showLock = true }: PremiumBadgeProps) {
  const { canAccess } = useFeatureAccess();
  const { language } = useLanguage();
  
  if (canAccess(feature)) return null;
  
  const featureName = FEATURE_NAMES[language as keyof typeof FEATURE_NAMES]?.[feature] 
    || FEATURE_NAMES.en[feature];
  
  const tooltipText = language === 'pt' 
    ? `${featureName} requer plano PRO`
    : language === 'es'
    ? `${featureName} requiere plan PRO`
    : `${featureName} requires PRO plan`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={`bg-primary/10 text-primary border-primary/30 ${className} cursor-help`}
          >
            {showLock && <Lock className="h-3 w-3 mr-1" />}
            <Crown className="h-3 w-3 mr-1" />
            PRO
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
  
  return (
    <Badge variant="outline" className={`bg-primary/10 text-primary border-primary/30 ${className}`}>
      <Crown className="h-3 w-3 mr-1" />
      PRO
    </Badge>
  );
}
