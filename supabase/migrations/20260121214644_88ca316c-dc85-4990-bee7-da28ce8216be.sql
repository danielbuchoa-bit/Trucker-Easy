-- Create emotional check-ins table
CREATE TABLE public.emotional_checkins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  checkin_type TEXT NOT NULL CHECK (checkin_type IN ('morning', 'evening')),
  energy_level INTEGER NOT NULL CHECK (energy_level >= 1 AND energy_level <= 5),
  stress_level INTEGER NOT NULL CHECK (stress_level >= 1 AND stress_level <= 5),
  body_condition INTEGER NOT NULL CHECK (body_condition >= 1 AND body_condition <= 5),
  day_quality INTEGER CHECK (day_quality >= 1 AND day_quality <= 5),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.emotional_checkins ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own checkins"
ON public.emotional_checkins
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own checkins"
ON public.emotional_checkins
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own checkins"
ON public.emotional_checkins
FOR UPDATE
USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_emotional_checkins_user_date ON public.emotional_checkins (user_id, created_at DESC);