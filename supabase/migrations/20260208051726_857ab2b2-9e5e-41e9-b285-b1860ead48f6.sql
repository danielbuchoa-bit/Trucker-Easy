
CREATE OR REPLACE FUNCTION public.can_submit_poi_feedback(p_poi_id text, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT true;
$$;
