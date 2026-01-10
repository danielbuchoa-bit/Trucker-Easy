-- Create weigh_station_reports table for detailed driver reports
CREATE TABLE public.weigh_station_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  station_id UUID NOT NULL REFERENCES public.weigh_stations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status_reported TEXT NOT NULL CHECK (status_reported IN ('OPEN', 'CLOSED', 'UNKNOWN')),
  outcome TEXT NOT NULL CHECK (outcome IN ('BYPASS', 'WEIGHED', 'INSPECTED', 'UNKNOWN')),
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  route_id_hash TEXT,
  device_anon_id_hash TEXT
);

-- Enable RLS
ALTER TABLE public.weigh_station_reports ENABLE ROW LEVEL SECURITY;

-- Anyone can view reports (for status aggregation)
CREATE POLICY "Anyone can view weigh station reports"
ON public.weigh_station_reports
FOR SELECT
USING (true);

-- Users can create their own reports
CREATE POLICY "Users can create weigh station reports"
ON public.weigh_station_reports
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create index for efficient queries
CREATE INDEX idx_weigh_station_reports_station_created 
ON public.weigh_station_reports(station_id, created_at DESC);

-- Create index for recent reports lookup
CREATE INDEX idx_weigh_station_reports_recent 
ON public.weigh_station_reports(created_at DESC);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.weigh_station_reports;