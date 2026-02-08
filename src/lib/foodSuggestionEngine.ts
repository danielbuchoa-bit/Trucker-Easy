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
  // Mediterranean
  'naf naf grill': {
    cuisine: 'Mediterranean',
    typicalItems: ['Chicken shawarma bowl', 'Falafel bowl', 'Grilled chicken pita', 'Hummus with salad'],
  },
  // Mexican
  chipotle: {
    cuisine: 'Mexican',
    typicalItems: ['Chicken burrito bowl', 'Steak bowl', 'Veggie bowl', 'Salad bowl'],
  },
  'taco bell': {
    cuisine: 'Mexican Fast Food',
    typicalItems: ['Power Bowl', 'Bean burrito', 'Chicken quesadilla', 'Crunchy taco'],
  },
  // Sandwiches
  subway: {
    cuisine: 'Sandwiches',
    typicalItems: ['Turkey sandwich', 'Grilled chicken sandwich', 'Veggie sandwich'],
  },
  "arby's": {
    cuisine: 'Sandwiches',
    typicalItems: ['Roast beef classic', 'Turkey gyro', 'Chicken sandwich', 'Market Fresh wrap'],
  },
  // Truck Stop Diners
  'iron skillet': {
    cuisine: 'American Diner',
    typicalItems: ['Grilled chicken dinner', 'Country fried steak', 'All-you-can-eat buffet', 'Breakfast platter', 'Meatloaf dinner'],
  },
  'country pride': {
    cuisine: 'American Diner',
    typicalItems: ['Grilled chicken', 'Mashed potatoes & gravy', 'Green beans', 'Breakfast combo', 'Pot roast'],
  },
  // Breakfast / Pancake Houses
  "denny's": {
    cuisine: 'American Diner',
    typicalItems: ['Grand Slam breakfast', 'Fit Fare omelette', 'Turkey club sandwich', 'Grilled chicken salad'],
  },
  'huddle house': {
    cuisine: 'American Diner',
    typicalItems: ['Grilled chicken plate', 'Egg breakfast', 'Waffle plate', 'Country ham'],
  },
  'waffle house': {
    cuisine: 'American Diner',
    typicalItems: ['Waffle combo', 'Grilled chicken melt', 'Hash browns', 'Egg breakfast plate'],
  },
  ihop: {
    cuisine: 'American Breakfast',
    typicalItems: ['Omelette', 'Turkey bacon combo', 'Chicken & waffles', 'Garden salad'],
  },
  // Burgers / Fast Food
  "wendy's": {
    cuisine: 'Fast Food',
    typicalItems: ['Grilled chicken sandwich', 'Jr. hamburger', 'Apple pecan salad', 'Baked potato'],
  },
  "mcdonald's": {
    cuisine: 'Fast Food',
    typicalItems: ['Egg McMuffin', 'Grilled chicken sandwich', 'Side salad', 'Fruit & yogurt parfait'],
  },
  'burger king': {
    cuisine: 'Fast Food',
    typicalItems: ['Whopper Jr.', 'Grilled chicken sandwich', 'Garden salad', 'Egg & cheese croissant'],
  },
  // Chicken
  popeyes: {
    cuisine: 'Fried Chicken',
    typicalItems: ['Blackened chicken tenders', 'Cajun rice', 'Green beans', 'Chicken sandwich'],
  },
  "chester's": {
    cuisine: 'Fried Chicken',
    typicalItems: ['Fried chicken pieces', 'Chicken tenders', 'Potato wedges', 'Biscuit'],
  },
  // Pizza
  'pizza hut': {
    cuisine: 'Pizza',
    typicalItems: ['Personal pan pizza', 'Veggie pizza', 'Breadsticks', 'Wing street wings'],
  },
  "godfather's pizza": {
    cuisine: 'Pizza',
    typicalItems: ['Buffet pizza slices', 'Pepperoni pizza', 'Veggie pizza', 'Breadsticks'],
  },
  'hunt brothers pizza': {
    cuisine: 'Pizza',
    typicalItems: ['Whole pizza', 'Pizza by the slice', 'Wings'],
  },
  // Coffee / Bakery
  "dunkin'": {
    cuisine: 'Coffee & Bakery',
    typicalItems: ['Coffee', 'Egg & cheese wrap', 'Turkey sausage sandwich', 'Oatmeal'],
  },
  starbucks: {
    cuisine: 'Coffee & Bakery',
    typicalItems: ['Coffee', 'Egg bites', 'Protein box', 'Oatmeal'],
  },
  // Sit-down highway restaurants
  'cracker barrel': {
    cuisine: 'Southern Comfort',
    typicalItems: ['Grilled chicken tenderloins', 'Rainbow trout', 'Turnip greens', 'Country ham breakfast'],
  },
  'golden corral': {
    cuisine: 'American Buffet',
    typicalItems: ['Buffet - grilled chicken', 'Buffet - steamed vegetables', 'Salad bar', 'Baked fish'],
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
