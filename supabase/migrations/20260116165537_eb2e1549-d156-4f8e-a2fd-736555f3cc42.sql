-- Create trucking_news table for storing industry news
CREATE TABLE public.trucking_news (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  image_url TEXT,
  source_url TEXT NOT NULL,
  source TEXT NOT NULL,
  category TEXT NOT NULL,
  state TEXT,
  urgency TEXT NOT NULL DEFAULT 'normal',
  published_at TIMESTAMP WITH TIME ZONE NOT NULL,
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trucking_news ENABLE ROW LEVEL SECURITY;

-- Allow public read access (news is public info)
CREATE POLICY "Anyone can read news" 
ON public.trucking_news 
FOR SELECT 
USING (true);

-- Only service role can insert/update (edge function)
CREATE POLICY "Service role can manage news" 
ON public.trucking_news 
FOR ALL 
USING (auth.role() = 'service_role');

-- Create index for efficient queries
CREATE INDEX idx_trucking_news_published ON public.trucking_news(published_at DESC);
CREATE INDEX idx_trucking_news_category ON public.trucking_news(category);