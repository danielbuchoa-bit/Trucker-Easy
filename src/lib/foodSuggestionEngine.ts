// =====================================================
// FOOD SUGGESTION ENGINE v2 — Canonical Inference Layer
// Typical items only. Never guarantees availability.
// =====================================================

// ---------- Types ----------
export type StopOfferings = {
  breakfast: string[];
  lunch_dinner: string[];
  snacks: string[];
  drinks: string[];
};

export interface TruckStopNetwork {
  categories: string[];
  hotItems: string[];
  quickItems: string[];
  healthierOptions: string[];
  warningFlags: string[];
}

export interface RestaurantChain {
  cuisine: string;
  typicalItems: string[];
}

// ---------- Disclaimer ----------
export const FOOD_DISCLAIMER =
  'Typical options based on common offerings. Items may vary by location.';

// ---------- Truck Stop Networks ----------
export const TRUCK_STOP_NETWORKS: Record<string, TruckStopNetwork> = {
  loves: {
    categories: ['diner', 'grill', 'grab_and_go'],
    hotItems: ['Grilled chicken plate', 'Eggs with toast', 'Meatloaf'],
    quickItems: ['Breakfast burrito', 'Pizza slice', 'Hot dog'],
    healthierOptions: ['Grilled chicken', 'Eggs without bacon', 'Salad (when available)'],
    warningFlags: ['high_sodium', 'fried_food_heavy'],
  },
  pilot: {
    categories: ['diner', 'fast_food', 'grab_and_go'],
    hotItems: ['Grilled chicken', 'Roast beef', 'Egg breakfast'],
    quickItems: ['Sandwich wrap', 'Pizza slice'],
    healthierOptions: ['Grilled proteins', 'Egg-based meals', 'Salads'],
    warningFlags: ['processed_food'],
  },
  ta: {
    categories: ['full_diner', 'grill', 'grab_and_go'],
    hotItems: ['Grilled chicken', 'Mashed potatoes', 'Green beans', 'Eggs'],
    quickItems: ['Hot dogs', 'Pizza', 'Breakfast sandwiches'],
    healthierOptions: ['Grilled chicken plate', 'Eggs without sides', 'Vegetables'],
    warningFlags: ['large_portions', 'high_sodium'],
  },
  petro: {
    categories: ['full_diner', 'grill', 'grab_and_go'],
    hotItems: ['Grilled chicken', 'Mashed potatoes', 'Green beans', 'Eggs'],
    quickItems: ['Hot dogs', 'Pizza', 'Breakfast sandwiches'],
    healthierOptions: ['Grilled chicken plate', 'Eggs without sides', 'Vegetables'],
    warningFlags: ['large_portions', 'high_sodium'],
  },
  kwiktrip: {
    categories: ['grab_and_go', 'hot_bar'],
    hotItems: ['Roasted chicken', 'Egg breakfast items'],
    quickItems: ['Protein packs', 'Yogurt', 'Sandwiches'],
    healthierOptions: ['Protein packs', 'Hard-boiled eggs', 'Fruit cups'],
    warningFlags: ['processed_food'],
  },
};

// ---------- Restaurant Chains ----------
export const RESTAURANT_CHAINS: Record<string, RestaurantChain> = {
  'naf naf grill': {
    cuisine: 'Mediterranean',
    typicalItems: ['Chicken shawarma bowl', 'Falafel bowl', 'Grilled chicken pita', 'Hummus with salad'],
  },
  chipotle: {
    cuisine: 'Mexican',
    typicalItems: ['Chicken burrito bowl', 'Steak bowl', 'Veggie bowl', 'Salad bowl'],
  },
  subway: {
    cuisine: 'Sandwiches',
    typicalItems: ['Turkey sandwich', 'Grilled chicken sandwich', 'Veggie sandwich'],
  },
};

// ---------- Generic Fallback ----------
export const GENERIC_OFFERINGS: StopOfferings = {
  breakfast: ['Oatmeal cup', 'Yogurt + fruit', 'Egg option'],
  lunch_dinner: ['Salad + lean protein', 'Wrap or whole wheat sandwich', 'Soup or chili'],
  snacks: ['Nuts', 'Fruit', 'Cheese sticks', 'Protein bar'],
  drinks: ['Water', 'Unsweetened drinks', 'Black coffee'],
};

// ---------- Brand Detection ----------
export type TruckStopBrand = keyof typeof TRUCK_STOP_NETWORKS;

export function detectTruckStopBrand(nameRaw?: string): TruckStopBrand | null {
  const name = (nameRaw ?? '').toLowerCase();
  if (!name) return null;

  if (name.includes("love's") || name.includes('loves')) return 'loves';
  if (name.includes('pilot') || name.includes('flying j') || name.includes('flyingj')) return 'pilot';

  if (
    name === 'ta' ||
    name.includes('travelcenters of america') ||
    name.includes('travel centers of america') ||
    name.includes('ta travel') ||
    name.includes('t/a')
  ) return 'ta';

  if (name.includes('petro')) return 'petro';

  if (
    name.includes('kwik trip') ||
    name.includes('kwik star') ||
    name.includes('kwiktrip') ||
    name.includes('kwikstar')
  ) return 'kwiktrip';

  return null;
}

// ---------- Legacy Adapter ----------
export function networkToOfferings(network: TruckStopNetwork): StopOfferings {
  return {
    breakfast: network.healthierOptions.slice(0, 3),
    lunch_dinner: network.hotItems.slice(0, 3),
    snacks: network.quickItems.slice(0, 3),
    drinks: ['Water', 'Unsweetened drinks', 'Black coffee'],
  };
}

// ---------- Unified Resolver ----------
export function resolveFoodOfferings(params: {
  placeName?: string;
  restaurantChainKey?: string;
}): {
  offerings: StopOfferings;
  typicalItems?: string[];
  warningFlags?: string[];
  disclaimer: string;
} {
  const { placeName, restaurantChainKey } = params;

  const truckStopBrand = detectTruckStopBrand(placeName);
  if (truckStopBrand) {
    const net = TRUCK_STOP_NETWORKS[truckStopBrand];
    return {
      offerings: networkToOfferings(net),
      warningFlags: net.warningFlags,
      disclaimer: FOOD_DISCLAIMER,
    };
  }

  if (restaurantChainKey) {
    const key = restaurantChainKey.toLowerCase().trim();
    const chain = RESTAURANT_CHAINS[key];
    if (chain) {
      return {
        offerings: GENERIC_OFFERINGS,
        typicalItems: chain.typicalItems,
        disclaimer: FOOD_DISCLAIMER,
      };
    }
  }

  return {
    offerings: GENERIC_OFFERINGS,
    disclaimer: FOOD_DISCLAIMER,
  };
}
