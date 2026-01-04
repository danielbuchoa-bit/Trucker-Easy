export interface StopPlace {
  id: string;
  name: string;
  type: 'truck_stop' | 'gas_station' | 'travel_center' | 'restaurant' | 'rest_area';
  lat: number;
  lng: number;
  address?: string;
  distance?: number;
  averageRating?: number;
  ratingCount?: number;
}

export interface StopRating {
  id: string;
  user_id: string;
  place_id: string;
  place_name: string;
  place_type: string;
  lat: number;
  lng: number;
  overall_rating: number;
  parking_rating?: number;
  safety_rating?: number;
  bathroom_rating?: number;
  food_rating?: number;
  price_rating?: number;
  tags: string[];
  comment?: string;
  created_at: string;
}

export interface StopMenuItem {
  id: string;
  place_id: string;
  category: 'drinks' | 'hot_food' | 'cold_grab_go' | 'snacks' | 'healthy';
  item_name: string;
  price?: number;
  available: boolean;
  added_by: string;
  upvotes: number;
  created_at: string;
}

export interface DriverFoodProfile {
  id: string;
  user_id: string;
  diet_type: string;
  allergies: string[];
  restrictions: string[];
  health_goals: string[];
  budget_preference: string;
  created_at: string;
  updated_at: string;
}

export interface FacilityRating {
  id: string;
  user_id: string;
  facility_name: string;
  facility_type: 'shipper' | 'receiver' | 'both';
  address?: string;
  lat?: number;
  lng?: number;
  overall_rating: number;
  wait_time_rating?: number;
  dock_access_rating?: number;
  staff_rating?: number;
  restroom_rating?: number;
  tags: string[];
  avg_wait_minutes?: number;
  comment?: string;
  created_at: string;
}

export interface FoodRecommendation {
  best_choice: { item: string; reason: string };
  alternative: { item: string; reason: string };
  emergency_option: { item: string; reason: string };
  avoid: Array<{ item: string; reason: string }>;
}

export const STOP_TAGS = [
  'lot_full',
  'easy_in_out',
  'clean',
  'sketchy',
  'good_coffee',
  'good_showers',
  'truck_friendly',
  'tight_parking',
] as const;

export const FACILITY_TAGS = [
  'appointment_only',
  'drop_hook',
  'lumper_required',
  'driver_friendly',
  'no_restroom',
  'fast_loading',
  'slow_loading',
  'night_shift',
] as const;

export const MENU_CATEGORIES = {
  drinks: 'Drinks & Beverages',
  hot_food: 'Hot Food',
  cold_grab_go: 'Cold / Grab & Go',
  snacks: 'Snacks',
  healthy: 'Healthy Picks',
} as const;

export const DEFAULT_MENU_ITEMS: Record<string, string[]> = {
  drinks: ['Coffee', 'Energy Drink', 'Soda', 'Water', 'Gatorade', 'Iced Tea', 'Hot Chocolate'],
  hot_food: ['Pizza Slice', 'Hot Dog', 'Burger', 'Fried Chicken', 'Burrito', 'Breakfast Sandwich', 'Taquitos'],
  cold_grab_go: ['Turkey Wrap', 'Ham Sandwich', 'Salad', 'Fruit Cup', 'Yogurt Parfait', 'Cheese & Crackers'],
  snacks: ['Chips', 'Cookies', 'Candy Bar', 'Protein Bar', 'Beef Jerky', 'Nuts', 'Sunflower Seeds'],
  healthy: ['Grilled Chicken Sandwich', 'Oatmeal', 'Greek Yogurt', 'Veggie Wrap', 'Fresh Fruit', 'Trail Mix'],
};
