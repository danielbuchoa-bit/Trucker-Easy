-- Create a table for saving favorite meals at truck stops
CREATE TABLE public.favorite_meals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  truck_stop_name TEXT NOT NULL,
  truck_stop_id TEXT,
  restaurant_name TEXT NOT NULL,
  meal_name TEXT NOT NULL,
  notes TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.favorite_meals ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own favorite meals" 
ON public.favorite_meals 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own favorite meals" 
ON public.favorite_meals 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own favorite meals" 
ON public.favorite_meals 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own favorite meals" 
ON public.favorite_meals 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_favorite_meals_user_id ON public.favorite_meals(user_id);
CREATE INDEX idx_favorite_meals_truck_stop ON public.favorite_meals(truck_stop_name);