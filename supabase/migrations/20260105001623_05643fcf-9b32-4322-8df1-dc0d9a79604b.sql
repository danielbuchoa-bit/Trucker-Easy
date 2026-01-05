-- Create table for POI feedback ratings
CREATE TABLE public.poi_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  poi_id TEXT NOT NULL,
  poi_name TEXT NOT NULL,
  poi_type TEXT NOT NULL CHECK (poi_type IN ('fuel', 'truck_stop', 'rest_area')),
  friendliness_rating INTEGER NOT NULL CHECK (friendliness_rating BETWEEN 1 AND 5),
  cleanliness_rating INTEGER NOT NULL CHECK (cleanliness_rating BETWEEN 1 AND 5),
  recommendation_rating INTEGER NOT NULL CHECK (recommendation_rating BETWEEN 1 AND 5),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.poi_feedback ENABLE ROW LEVEL SECURITY;

-- Users can view all feedback (for aggregate ratings)
CREATE POLICY "Anyone can view poi feedback"
ON public.poi_feedback
FOR SELECT
USING (true);

-- Users can insert their own feedback
CREATE POLICY "Users can insert their own feedback"
ON public.poi_feedback
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Function to check if user can submit feedback (24h cooldown per POI)
CREATE OR REPLACE FUNCTION public.can_submit_poi_feedback(p_user_id UUID, p_poi_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.poi_feedback
    WHERE user_id = p_user_id
      AND poi_id = p_poi_id
      AND created_at > (now() - interval '24 hours')
  )
$$;

-- Create index for faster lookups
CREATE INDEX idx_poi_feedback_user_poi ON public.poi_feedback(user_id, poi_id);
CREATE INDEX idx_poi_feedback_poi_id ON public.poi_feedback(poi_id);