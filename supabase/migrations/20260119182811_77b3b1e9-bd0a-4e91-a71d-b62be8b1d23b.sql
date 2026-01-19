-- Add UPDATE policy for poi_feedback table to allow users to edit their own ratings
CREATE POLICY "Users can update their own poi feedback"
ON public.poi_feedback
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);