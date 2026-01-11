-- Drop and recreate view with SECURITY INVOKER (safer default)
DROP VIEW IF EXISTS public.poi_ratings_aggregate;

CREATE VIEW public.poi_ratings_aggregate
WITH (security_invoker = on)
AS
SELECT 
  poi_id,
  poi_name,
  poi_type,
  COUNT(*) as review_count,
  ROUND(AVG(friendliness_rating)::numeric, 1) as avg_friendliness,
  ROUND(AVG(cleanliness_rating)::numeric, 1) as avg_cleanliness,
  ROUND(AVG(structure_rating)::numeric, 1) as avg_structure,
  ROUND(AVG(recommendation_rating)::numeric, 1) as avg_recommendation,
  ROUND((AVG(friendliness_rating) + AVG(cleanliness_rating) + AVG(structure_rating) + AVG(recommendation_rating)) / 4.0, 1)::numeric as avg_overall,
  ROUND(SUM(CASE WHEN would_return THEN 1 ELSE 0 END)::numeric / COUNT(*)::numeric * 100, 0) as would_return_pct
FROM public.poi_feedback
GROUP BY poi_id, poi_name, poi_type;