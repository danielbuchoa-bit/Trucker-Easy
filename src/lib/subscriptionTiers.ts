// Subscription tier definitions for Trucker Easy - Single PRO Plan

export type SubscriptionTier = 'none' | 'pro';

export interface PlanPrice {
  price_id: string;
  amount: number; // in cents
}

export interface PlanDefinition {
  name: string;
  description: string;
  monthly: PlanPrice;
  annual: PlanPrice;
  product_ids: string[];
  trial_days: number;
  features: string[];
}

// Stripe product and price IDs - PRO Plan
export const PRO_PLAN: PlanDefinition = {
  name: 'PRO',
  description: 'Full access to all features',
  monthly: {
    price_id: 'price_1SyR2S2MEO38NbGnf4yYBL5b',
    amount: 1999,
  },
  annual: {
    price_id: 'price_1T0BQT2MEO38NbGn3UVcef9L',
    amount: 17999,
  },
  product_ids: ['prod_TwJfOGBBNJ6Myz', 'prod_TwJfW7sH7eyHrC', 'prod_Ty7fqQU1p8W91t'],
  trial_days: 5,
  features: [
    'Truck-aware GPS navigation (height, weight, length)',
    'Safe routes for semi-trucks',
    'Truck-only POIs (truck stops, rest areas, weigh stations)',
    'Community ratings & reviews',
    'Near Me with truck-relevant locations',
    'Real-time traffic & weather alerts',
    'Offline maps (full coverage)',
    'Smart stop & food suggestions',
    'Advanced map matching & rerouting',
    'Route comparison & trip reports',
    'Premium community access',
    'Priority support',
  ],
};

// Referral coupon ID
export const REFERRAL_COUPON_ID = '1Obg7UIY';

// All price IDs mapped to PRO
export const PRICE_IDS = [
  PRO_PLAN.monthly.price_id,
  PRO_PLAN.annual.price_id,
];

// Helper to check if a product ID belongs to PRO
export function isProProduct(productId: string | null): boolean {
  if (!productId) return false;
  return PRO_PLAN.product_ids.includes(productId);
}

// Check if user has PRO access
export function hasTierAccess(userTier: SubscriptionTier, requiredTier: SubscriptionTier): boolean {
  if (requiredTier === 'none') return true;
  return userTier === 'pro';
}

// Format price for display
export function formatPrice(amountCents: number): string {
  return `$${(amountCents / 100).toFixed(2)}`;
}

// Calculate annual savings
export function calculateAnnualSavings(): number {
  return (PRO_PLAN.monthly.amount * 12) - PRO_PLAN.annual.amount;
}

// Legacy compatibility - map old tiers to pro
export function getTierFromProductId(productId: string | null): SubscriptionTier {
  if (!productId) return 'none';
  if (PRO_PLAN.product_ids.includes(productId)) return 'pro';
  // Legacy product IDs also map to pro for backward compat
  return 'pro';
}

// Keep old types available for SubscriptionContext backward compat
export type { PlanDefinition as TierDefinition };

// Legacy export for components that reference SUBSCRIPTION_TIERS
export const SUBSCRIPTION_TIERS = {
  pro: {
    id: 'pro' as const,
    name: 'PRO',
    description: PRO_PLAN.description,
    color: 'from-blue-500 to-indigo-600',
    icon: 'crown' as const,
    features: PRO_PLAN.features,
  },
};
