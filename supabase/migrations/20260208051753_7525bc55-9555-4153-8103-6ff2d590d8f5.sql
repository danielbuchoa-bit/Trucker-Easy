
DROP FUNCTION IF EXISTS public.can_submit_poi_feedback(uuid, text);
DROP FUNCTION IF EXISTS public.can_submit_poi_feedback(text, uuid);

CREATE OR REPLACE FUNCTION public.can_submit_poi_feedback(p_poi_id text, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT true;
$$;

CREATE OR REPLACE FUNCTION public.can_submit_poi_feedback(p_user_id uuid, p_poi_id text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT true;
$$;
