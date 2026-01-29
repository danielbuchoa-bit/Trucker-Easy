-- Fix 1: Restrict profiles table - remove admin bypass for general viewing of sensitive data
-- Drop existing policies first
DROP POLICY IF EXISTS "Admins can view user summaries" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Create new restricted policy - users can only see their own profile
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

-- Fix 2: Create a public view for facility_ratings that hides user_id
-- First, update the RLS policy to prevent direct access exposing user_id
DROP POLICY IF EXISTS "Anyone can view facility ratings" ON public.facility_ratings;

-- Create a view that excludes user_id for public access
CREATE OR REPLACE VIEW public.facility_ratings_public
WITH (security_invoker=on) AS
SELECT 
  id,
  lat,
  lng,
  overall_rating,
  wait_time_rating,
  dock_access_rating,
  staff_rating,
  restroom_rating,
  avg_wait_minutes,
  created_at,
  tags,
  comment,
  facility_name,
  facility_type,
  address
FROM public.facility_ratings;

-- Allow anyone to read the public view (which excludes user_id)
-- Keep user-specific access for their own ratings
CREATE POLICY "Users can view their own ratings" 
ON public.facility_ratings 
FOR SELECT 
USING (auth.uid() = user_id);

-- Grant access to the public view
GRANT SELECT ON public.facility_ratings_public TO anon, authenticated;