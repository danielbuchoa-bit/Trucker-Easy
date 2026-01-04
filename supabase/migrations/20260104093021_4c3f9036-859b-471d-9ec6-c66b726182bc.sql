-- Create facilities table (crowd-created locations)
CREATE TABLE public.facilities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  geofence_radius_m INTEGER NOT NULL DEFAULT 200,
  place_id TEXT,
  facility_type TEXT NOT NULL DEFAULT 'both',
  created_by UUID NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on facilities
ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;

-- Anyone can view facilities
CREATE POLICY "Anyone can view facilities"
ON public.facilities
FOR SELECT
USING (true);

-- Authenticated users can create facilities
CREATE POLICY "Users can create facilities"
ON public.facilities
FOR INSERT
WITH CHECK (auth.uid() = created_by);

-- Create facility_reviews table (enhanced ratings)
CREATE TABLE public.facility_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  overall_rating INTEGER NOT NULL CHECK (overall_rating >= 1 AND overall_rating <= 5),
  treatment_rating INTEGER CHECK (treatment_rating >= 1 AND treatment_rating <= 5),
  speed_rating INTEGER CHECK (speed_rating >= 1 AND speed_rating <= 5),
  staff_help_rating INTEGER CHECK (staff_help_rating >= 1 AND staff_help_rating <= 5),
  parking_rating INTEGER CHECK (parking_rating >= 1 AND parking_rating <= 5),
  exit_ease_rating INTEGER CHECK (exit_ease_rating >= 1 AND exit_ease_rating <= 5),
  visit_type TEXT NOT NULL DEFAULT 'both',
  time_spent TEXT,
  parking_available TEXT,
  overnight_allowed TEXT DEFAULT 'unknown',
  restroom_available TEXT DEFAULT 'unknown',
  tips TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on facility_reviews
ALTER TABLE public.facility_reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can view reviews
CREATE POLICY "Anyone can view facility reviews"
ON public.facility_reviews
FOR SELECT
USING (true);

-- Users can create reviews (with rate limiting via function)
CREATE POLICY "Users can create facility reviews"
ON public.facility_reviews
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create road_reports table (Waze-like reports)
CREATE TABLE public.road_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  report_type TEXT NOT NULL,
  subtype TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  details JSONB DEFAULT '{}',
  confirmations INTEGER NOT NULL DEFAULT 1,
  denials INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on road_reports
ALTER TABLE public.road_reports ENABLE ROW LEVEL SECURITY;

-- Anyone can view active road reports
CREATE POLICY "Anyone can view active road reports"
ON public.road_reports
FOR SELECT
USING (active = true AND expires_at > now());

-- Users can create road reports
CREATE POLICY "Users can create road reports"
ON public.road_reports
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update confirmations on any report (for confirm/deny)
CREATE POLICY "Users can update road reports"
ON public.road_reports
FOR UPDATE
USING (true);

-- Create report_votes table (track who confirmed/denied)
CREATE TABLE public.report_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.road_reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('confirm', 'deny')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(report_id, user_id)
);

-- Enable RLS on report_votes
ALTER TABLE public.report_votes ENABLE ROW LEVEL SECURITY;

-- Users can view their own votes
CREATE POLICY "Users can view their own votes"
ON public.report_votes
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create votes
CREATE POLICY "Users can create votes"
ON public.report_votes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create facility_aggregates table (cached stats)
CREATE TABLE public.facility_aggregates (
  facility_id UUID NOT NULL PRIMARY KEY REFERENCES public.facilities(id) ON DELETE CASCADE,
  avg_overall NUMERIC(3,2) NOT NULL DEFAULT 0,
  avg_treatment NUMERIC(3,2),
  avg_speed NUMERIC(3,2),
  avg_staff_help NUMERIC(3,2),
  avg_parking NUMERIC(3,2),
  avg_exit_ease NUMERIC(3,2),
  review_count INTEGER NOT NULL DEFAULT 0,
  typical_time TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on facility_aggregates
ALTER TABLE public.facility_aggregates ENABLE ROW LEVEL SECURITY;

-- Anyone can view aggregates
CREATE POLICY "Anyone can view facility aggregates"
ON public.facility_aggregates
FOR SELECT
USING (true);

-- Create function to check if user can review facility (1 review per 7 days)
CREATE OR REPLACE FUNCTION public.can_review_facility(p_user_id UUID, p_facility_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.facility_reviews
    WHERE user_id = p_user_id
      AND facility_id = p_facility_id
      AND created_at > (now() - interval '7 days')
  )
$$;

-- Create function to check report rate limit (max 10 per hour)
CREATE OR REPLACE FUNCTION public.can_create_report(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    SELECT COUNT(*)
    FROM public.road_reports
    WHERE user_id = p_user_id
      AND created_at > (now() - interval '1 hour')
  ) < 10
$$;

-- Create function to update facility aggregates
CREATE OR REPLACE FUNCTION public.update_facility_aggregate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.facility_aggregates (
    facility_id,
    avg_overall,
    avg_treatment,
    avg_speed,
    avg_staff_help,
    avg_parking,
    avg_exit_ease,
    review_count,
    updated_at
  )
  SELECT
    NEW.facility_id,
    AVG(overall_rating)::NUMERIC(3,2),
    AVG(treatment_rating)::NUMERIC(3,2),
    AVG(speed_rating)::NUMERIC(3,2),
    AVG(staff_help_rating)::NUMERIC(3,2),
    AVG(parking_rating)::NUMERIC(3,2),
    AVG(exit_ease_rating)::NUMERIC(3,2),
    COUNT(*),
    now()
  FROM public.facility_reviews
  WHERE facility_id = NEW.facility_id
  ON CONFLICT (facility_id) DO UPDATE SET
    avg_overall = EXCLUDED.avg_overall,
    avg_treatment = EXCLUDED.avg_treatment,
    avg_speed = EXCLUDED.avg_speed,
    avg_staff_help = EXCLUDED.avg_staff_help,
    avg_parking = EXCLUDED.avg_parking,
    avg_exit_ease = EXCLUDED.avg_exit_ease,
    review_count = EXCLUDED.review_count,
    updated_at = now();
  
  RETURN NEW;
END;
$$;

-- Create trigger to update aggregates on new review
CREATE TRIGGER update_facility_aggregate_on_review
AFTER INSERT ON public.facility_reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_facility_aggregate();

-- Create index for road reports geolocation queries
CREATE INDEX idx_road_reports_location ON public.road_reports (lat, lng);
CREATE INDEX idx_road_reports_active ON public.road_reports (active, expires_at);
CREATE INDEX idx_facilities_location ON public.facilities (lat, lng);
CREATE INDEX idx_facility_reviews_facility ON public.facility_reviews (facility_id);

-- Enable realtime for road_reports
ALTER PUBLICATION supabase_realtime ADD TABLE public.road_reports;