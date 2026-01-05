-- Add new columns to poi_feedback table
ALTER TABLE public.poi_feedback 
ADD COLUMN IF NOT EXISTS structure_rating integer,
ADD COLUMN IF NOT EXISTS would_return boolean;

-- Add comments for clarity
COMMENT ON COLUMN public.poi_feedback.structure_rating IS 'Rating for structure/amenities (1-5)';
COMMENT ON COLUMN public.poi_feedback.would_return IS 'Would the user return to this location?';