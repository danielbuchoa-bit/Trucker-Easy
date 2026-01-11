-- Create table for user-reported speed alerts
CREATE TABLE public.speed_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  alert_type TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  speed_limit INTEGER,
  confirmations INTEGER NOT NULL DEFAULT 1,
  denials INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '2 hours')
);

-- Enable RLS
ALTER TABLE public.speed_alerts ENABLE ROW LEVEL SECURITY;

-- Anyone can view active alerts
CREATE POLICY "Anyone can view active speed alerts"
ON public.speed_alerts
FOR SELECT
USING (active = true AND expires_at > now());

-- Users can create alerts
CREATE POLICY "Users can create speed alerts"
ON public.speed_alerts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Anyone can update (for confirmations/denials)
CREATE POLICY "Anyone can update speed alerts"
ON public.speed_alerts
FOR UPDATE
USING (true);

-- Create table for alert votes (to prevent duplicate votes)
CREATE TABLE public.speed_alert_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_id UUID NOT NULL REFERENCES public.speed_alerts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  vote_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(alert_id, user_id)
);

-- Enable RLS
ALTER TABLE public.speed_alert_votes ENABLE ROW LEVEL SECURITY;

-- Users can view their own votes
CREATE POLICY "Users can view their own alert votes"
ON public.speed_alert_votes
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create votes
CREATE POLICY "Users can create alert votes"
ON public.speed_alert_votes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create index for geospatial queries
CREATE INDEX idx_speed_alerts_location ON public.speed_alerts(lat, lng);
CREATE INDEX idx_speed_alerts_active ON public.speed_alerts(active, expires_at);