-- Drop the overly permissive update policy
DROP POLICY "Anyone can update speed alerts" ON public.speed_alerts;

-- Create a more restrictive update policy - only allow updating confirmations/denials
-- Users can only update if they have voted on the alert
CREATE POLICY "Users can update speed alerts they voted on"
ON public.speed_alerts
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.speed_alert_votes
    WHERE speed_alert_votes.alert_id = speed_alerts.id
    AND speed_alert_votes.user_id = auth.uid()
  )
);