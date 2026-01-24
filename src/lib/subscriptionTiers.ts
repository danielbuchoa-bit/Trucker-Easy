// Subscription tier definitions for Trucker Easy

export type SubscriptionTier = 'none' | 'silver' | 'gold' | 'diamond';

export interface TierPrice {
  monthly: {
    price_id: string;
    amount: number; // in cents
  };
  annual: {
    price_id: string;
    amount: number; // in cents
  };
}

export interface TierFeature {
  text: string;
  included: boolean;
}

export interface TierDefinition {
  id: SubscriptionTier;
  name: string;
  description: string;
  prices: TierPrice;
  product_ids: string[];
  color: string;
  icon: 'shield' | 'crown' | 'gem';
  features: string[];
  highlight?: boolean;
}

// Stripe product and price IDs
export const SUBSCRIPTION_TIERS: Record<Exclude<SubscriptionTier, 'none'>, TierDefinition> = {
  silver: {
    id: 'silver',
    name: 'Silver',
    description: 'Essential truck-aware GPS navigation',
    prices: {
      monthly: {
        price_id: 'price_1Ssvqk2MEO38NbGnrwicv0nZ',
        amount: 899,
      },
      annual: {
        price_id: 'price_1Ssvr02MEO38NbGnHCesYJTW',
        amount: 8999,
      },
    },
    product_ids: ['prod_Tqd6KgfSHZl70M', 'prod_Tqd7gxOqCVfQfZ'],
    color: 'from-slate-400 to-slate-500',
    icon: 'shield',
    features: [
      'Truck-aware GPS navigation (height, weight, length)',
      'Safe routes for semi-trucks',
      'Truck-only POIs (truck stops, rest areas, weigh stations)',
      'Community ratings & reviews',
      'Near Me with truck-relevant locations',
      'Basic route alerts (closures & detours)',
    ],
  },
  gold: {
    id: 'gold',
    name: 'Gold',
    description: 'Advanced features for professional drivers',
    prices: {
      monthly: {
        price_id: 'price_1SsvrH2MEO38NbGnotCQ0O6t',
        amount: 1899,
      },
      annual: {
        price_id: 'price_1Ssvra2MEO38NbGnQlRov7sI',
        amount: 18999,
      },
    },
    product_ids: ['prod_Tqd7XjlDhI502Y', 'prod_Tqd7fgQhIoNao2'],
    color: 'from-yellow-500 to-amber-600',
    icon: 'crown',
    highlight: true,
    features: [
      'Everything in Silver, plus:',
      'Offline maps (full coverage)',
      'Real-time traffic updates',
      'Weather alerts for trucks (wind, snow, ice, rain)',
      'Smart stop suggestions (drive time & rest)',
      'Personalized food suggestions',
      'Convenience store fallback recommendations',
      'Complete route history',
    ],
  },
  diamond: {
    id: 'diamond',
    name: 'Diamond',
    description: 'Premium experience for elite drivers',
    prices: {
      monthly: {
        price_id: 'price_1SsvsT2MEO38NbGnVvDveuJ4',
        amount: 2890,
      },
      annual: {
        price_id: 'price_1Ssvsd2MEO38NbGnsBl3ne5X',
        amount: 28900,
      },
    },
    product_ids: ['prod_Tqd8Zl3fQQuQ4Z', 'prod_Tqd8hhSX3tN1xF'],
    color: 'from-cyan-400 to-blue-600',
    icon: 'gem',
    features: [
      'Everything in Gold, plus:',
      'Advanced map matching (stable cursor)',
      'Smart rerouting with minimal fluctuation',
      'Route comparison (shortest, safest, fewer stops)',
      'Trip reports (time, stops, usage patterns)',
      'Advanced POI ratings (photos & detailed reviews)',
      'Premium community access (exclusive rooms)',
      'Priority support',
    ],
  },
};

// Helper to get tier from Stripe product ID
export function getTierFromProductId(productId: string | null): SubscriptionTier {
  if (!productId) return 'none';
  
  for (const [tier, definition] of Object.entries(SUBSCRIPTION_TIERS)) {
    if (definition.product_ids.includes(productId)) {
      return tier as SubscriptionTier;
    }
  }
  return 'none';
}

// Check if a tier has access to a feature tier level
export function hasTierAccess(userTier: SubscriptionTier, requiredTier: SubscriptionTier): boolean {
  const tierOrder: SubscriptionTier[] = ['none', 'silver', 'gold', 'diamond'];
  const userIndex = tierOrder.indexOf(userTier);
  const requiredIndex = tierOrder.indexOf(requiredTier);
  return userIndex >= requiredIndex;
}

// Format price for display
export function formatPrice(amountCents: number): string {
  return `$${(amountCents / 100).toFixed(2)}`;
}

// Calculate annual savings
export function calculateAnnualSavings(tier: TierDefinition): number {
  const monthlyTotal = tier.prices.monthly.amount * 12;
  const annualPrice = tier.prices.annual.amount;
  return monthlyTotal - annualPrice;
}
