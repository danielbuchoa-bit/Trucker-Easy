
ALTER TABLE public.weigh_station_reports 
ADD COLUMN IF NOT EXISTS comment TEXT;
