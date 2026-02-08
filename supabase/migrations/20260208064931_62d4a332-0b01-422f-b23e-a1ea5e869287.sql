
-- Truck profiles for MPG and fuel settings
CREATE TABLE public.truck_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  truck_name text,
  mpg numeric(5,2) NOT NULL DEFAULT 6.5,
  tank_capacity_gallons numeric(6,1) NOT NULL DEFAULT 150,
  current_fuel_gallons numeric(6,1),
  fuel_preference text NOT NULL DEFAULT 'cheapest',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT valid_fuel_preference CHECK (fuel_preference IN ('cheapest', 'fastest', 'balanced'))
);

ALTER TABLE public.truck_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own truck profile" ON public.truck_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own truck profile" ON public.truck_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own truck profile" ON public.truck_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own truck profile" ON public.truck_profiles FOR DELETE USING (auth.uid() = user_id);

-- Fuel prices at truck stops
CREATE TABLE public.fuel_prices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  place_id text NOT NULL,
  place_name text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  diesel_price_cents integer NOT NULL,
  source text NOT NULL DEFAULT 'estimate',
  reported_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT valid_source CHECK (source IN ('api', 'user_report', 'estimate'))
);

ALTER TABLE public.fuel_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view fuel prices" ON public.fuel_prices FOR SELECT USING (true);
CREATE POLICY "Auth users can report prices" ON public.fuel_prices FOR INSERT WITH CHECK (auth.uid() = reported_by);
CREATE POLICY "Users can update own reports" ON public.fuel_prices FOR UPDATE USING (auth.uid() = reported_by);

CREATE INDEX idx_fuel_prices_location ON public.fuel_prices (lat, lng);
CREATE INDEX idx_fuel_prices_place ON public.fuel_prices (place_id);

-- User fuel logs
CREATE TABLE public.user_fuel_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  place_id text,
  place_name text NOT NULL,
  gallons numeric(6,2) NOT NULL,
  price_per_gallon_cents integer NOT NULL,
  total_cost_cents integer NOT NULL,
  odometer integer,
  lat double precision,
  lng double precision,
  logged_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_fuel_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own fuel logs" ON public.user_fuel_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create fuel logs" ON public.user_fuel_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own fuel logs" ON public.user_fuel_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own fuel logs" ON public.user_fuel_logs FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at on truck_profiles
CREATE TRIGGER update_truck_profiles_updated_at
  BEFORE UPDATE ON public.truck_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_profile_updated_at();
