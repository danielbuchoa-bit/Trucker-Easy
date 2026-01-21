-- Create enum for roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Policy: Only admins can view roles
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Policy: Only admins can manage roles
CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Create view for admin to see user activity summary
CREATE VIEW public.admin_user_summary
WITH (security_invoker = on) AS
SELECT 
  p.id as user_id,
  p.email,
  p.full_name,
  p.created_at as joined_at,
  (SELECT COUNT(*) FROM public.road_reports rr WHERE rr.user_id = p.id) as total_reports,
  (SELECT COUNT(*) FROM public.facility_ratings fr WHERE fr.user_id = p.id) as total_facility_ratings,
  (SELECT COUNT(*) FROM public.stop_ratings sr WHERE sr.user_id = p.id) as total_stop_ratings,
  (SELECT COUNT(*) FROM public.poi_feedback pf WHERE pf.user_id = p.id) as total_poi_feedback,
  (SELECT COUNT(*) FROM public.emotional_checkins ec WHERE ec.user_id = p.id) as total_checkins,
  (SELECT COUNT(*) FROM public.chat_messages cm WHERE cm.user_id = p.id) as total_messages
FROM public.profiles p;

-- RLS for view access (only admins)
CREATE POLICY "Admins can view user summaries"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = id 
  OR public.has_role(auth.uid(), 'admin')
);