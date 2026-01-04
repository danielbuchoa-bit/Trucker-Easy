-- Driver food preferences/profile
CREATE TABLE public.driver_food_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  diet_type TEXT DEFAULT 'none', -- vegetarian, vegan, keto, none
  allergies TEXT[] DEFAULT '{}', -- peanuts, gluten, dairy, shellfish, etc.
  restrictions TEXT[] DEFAULT '{}', -- no_fried, low_sugar, low_sodium, halal, kosher
  health_goals TEXT[] DEFAULT '{}', -- lose_weight, muscle_gain, energy, heart_health
  budget_preference TEXT DEFAULT 'moderate', -- budget, moderate, premium
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.driver_food_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own food profile" 
ON public.driver_food_profiles FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own food profile" 
ON public.driver_food_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own food profile" 
ON public.driver_food_profiles FOR UPDATE USING (auth.uid() = user_id);

-- Stop ratings (truck stops, gas stations, rest areas)
CREATE TABLE public.stop_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  place_id TEXT NOT NULL, -- HERE/external place ID
  place_name TEXT NOT NULL,
  place_type TEXT NOT NULL, -- truck_stop, gas_station, travel_center, restaurant, rest_area
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  overall_rating INTEGER NOT NULL CHECK (overall_rating >= 0 AND overall_rating <= 5),
  parking_rating INTEGER CHECK (parking_rating >= 0 AND parking_rating <= 5),
  safety_rating INTEGER CHECK (safety_rating >= 0 AND safety_rating <= 5),
  bathroom_rating INTEGER CHECK (bathroom_rating >= 0 AND bathroom_rating <= 5),
  food_rating INTEGER CHECK (food_rating >= 0 AND food_rating <= 5),
  price_rating INTEGER CHECK (price_rating >= 0 AND price_rating <= 5),
  tags TEXT[] DEFAULT '{}', -- lot_full, easy_in_out, clean, sketchy, good_coffee
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.stop_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view stop ratings" 
ON public.stop_ratings FOR SELECT USING (true);

CREATE POLICY "Users can create stop ratings" 
ON public.stop_ratings FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ratings" 
ON public.stop_ratings FOR UPDATE USING (auth.uid() = user_id);

-- Crowd-sourced menu items
CREATE TABLE public.stop_menu_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  place_id TEXT NOT NULL,
  category TEXT NOT NULL, -- drinks, hot_food, cold_grab_go, snacks, healthy
  item_name TEXT NOT NULL,
  price DECIMAL(10,2),
  available BOOLEAN DEFAULT true,
  added_by UUID NOT NULL,
  upvotes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.stop_menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view menu items" 
ON public.stop_menu_items FOR SELECT USING (true);

CREATE POLICY "Users can add menu items" 
ON public.stop_menu_items FOR INSERT WITH CHECK (auth.uid() = added_by);

CREATE POLICY "Users can update their menu items" 
ON public.stop_menu_items FOR UPDATE USING (auth.uid() = added_by);

-- Facility ratings (Shipper/Receiver)
CREATE TABLE public.facility_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  facility_name TEXT NOT NULL,
  facility_type TEXT NOT NULL, -- shipper, receiver, both
  address TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  overall_rating INTEGER NOT NULL CHECK (overall_rating >= 0 AND overall_rating <= 5),
  wait_time_rating INTEGER CHECK (wait_time_rating >= 0 AND wait_time_rating <= 5),
  dock_access_rating INTEGER CHECK (dock_access_rating >= 0 AND dock_access_rating <= 5),
  staff_rating INTEGER CHECK (staff_rating >= 0 AND staff_rating <= 5),
  restroom_rating INTEGER CHECK (restroom_rating >= 0 AND restroom_rating <= 5),
  tags TEXT[] DEFAULT '{}', -- appointment_only, drop_hook, lumper_required, driver_friendly, no_restroom
  avg_wait_minutes INTEGER,
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.facility_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view facility ratings" 
ON public.facility_ratings FOR SELECT USING (true);

CREATE POLICY "Users can create facility ratings" 
ON public.facility_ratings FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own facility ratings" 
ON public.facility_ratings FOR UPDATE USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_stop_ratings_place_id ON public.stop_ratings(place_id);
CREATE INDEX idx_stop_menu_items_place_id ON public.stop_menu_items(place_id);
CREATE INDEX idx_facility_ratings_location ON public.facility_ratings(lat, lng);