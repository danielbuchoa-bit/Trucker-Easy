-- Create parking_reports table for crowdsourced parking availability
CREATE TABLE public.parking_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  poi_id TEXT NOT NULL,
  poi_name TEXT NOT NULL,
  user_id UUID NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('many', 'some', 'full')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '2 hours')
);

-- Create indexes for efficient queries
CREATE INDEX idx_parking_reports_poi_id ON public.parking_reports(poi_id);
CREATE INDEX idx_parking_reports_expires_at ON public.parking_reports(expires_at);
CREATE INDEX idx_parking_reports_poi_expires ON public.parking_reports(poi_id, expires_at);

-- Enable RLS
ALTER TABLE public.parking_reports ENABLE ROW LEVEL SECURITY;

-- Anyone can view active parking reports
CREATE POLICY "Anyone can view active parking reports"
ON public.parking_reports
FOR SELECT
USING (expires_at > now());

-- Authenticated users can create parking reports
CREATE POLICY "Users can create parking reports"
ON public.parking_reports
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.parking_reports;

-- Add comment for documentation
COMMENT ON TABLE public.parking_reports IS 'Crowdsourced parking availability reports from drivers';