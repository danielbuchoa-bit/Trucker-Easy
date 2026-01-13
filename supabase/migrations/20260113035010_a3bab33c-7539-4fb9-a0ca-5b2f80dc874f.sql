-- Add image and location fields to chat_messages
ALTER TABLE public.chat_messages
ADD COLUMN image_url TEXT,
ADD COLUMN location_lat DOUBLE PRECISION,
ADD COLUMN location_lng DOUBLE PRECISION,
ADD COLUMN location_name TEXT;

-- Create storage bucket for chat images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-images', 
  'chat-images', 
  true, 
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
);

-- Allow authenticated users to upload to chat-images bucket
CREATE POLICY "Authenticated users can upload chat images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-images');

-- Allow public read access to chat images
CREATE POLICY "Anyone can view chat images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'chat-images');

-- Allow users to delete their own images
CREATE POLICY "Users can delete their own chat images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'chat-images' AND auth.uid()::text = (storage.foldername(name))[1]);