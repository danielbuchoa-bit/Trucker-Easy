-- Create chat_rooms table for community groups
CREATE TABLE public.chat_rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  language TEXT DEFAULT 'all',
  region TEXT DEFAULT 'all',
  trailer_type TEXT DEFAULT 'all',
  member_count INTEGER NOT NULL DEFAULT 0,
  message_count INTEGER NOT NULL DEFAULT 0,
  last_message_preview TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create chat_messages table
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create chat_room_members table to track membership
CREATE TABLE public.chat_room_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname TEXT,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(room_id, user_id)
);

-- Enable RLS on all tables
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_room_members ENABLE ROW LEVEL SECURITY;

-- Chat rooms policies
CREATE POLICY "Anyone can view chat rooms"
ON public.chat_rooms FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create chat rooms"
ON public.chat_rooms FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creators can update their chat rooms"
ON public.chat_rooms FOR UPDATE
USING (auth.uid() = created_by);

-- Chat messages policies
CREATE POLICY "Members can view room messages"
ON public.chat_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.chat_room_members
    WHERE chat_room_members.room_id = chat_messages.room_id
    AND chat_room_members.user_id = auth.uid()
  )
);

CREATE POLICY "Members can send messages"
ON public.chat_messages FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.chat_room_members
    WHERE chat_room_members.room_id = chat_messages.room_id
    AND chat_room_members.user_id = auth.uid()
  )
);

-- Chat room members policies
CREATE POLICY "Anyone can view room members"
ON public.chat_room_members FOR SELECT
USING (true);

CREATE POLICY "Users can join rooms"
ON public.chat_room_members FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave rooms"
ON public.chat_room_members FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their membership"
ON public.chat_room_members FOR UPDATE
USING (auth.uid() = user_id);

-- Function to update room stats when a message is sent
CREATE OR REPLACE FUNCTION public.update_room_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.chat_rooms
  SET 
    message_count = message_count + 1,
    last_message_preview = LEFT(NEW.content, 100),
    last_message_at = NEW.created_at,
    updated_at = now()
  WHERE id = NEW.room_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_message_sent
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_room_on_message();

-- Function to update member count
CREATE OR REPLACE FUNCTION public.update_room_member_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.chat_rooms SET member_count = member_count + 1 WHERE id = NEW.room_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.chat_rooms SET member_count = member_count - 1 WHERE id = OLD.room_id;
    RETURN OLD;
  END IF;
END;
$$;

CREATE TRIGGER on_member_change
  AFTER INSERT OR DELETE ON public.chat_room_members
  FOR EACH ROW EXECUTE FUNCTION public.update_room_member_count();

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- Insert some default chat rooms
INSERT INTO public.chat_rooms (name, description, icon, language, region) VALUES
('Truckers USA', 'Chat for US truckers', '🇺🇸', 'en', 'usa'),
('Camioneros Latinos', 'Comunidad de camioneros latinos', '🌎', 'es', 'latam'),
('Flatbed Haulers', 'For flatbed and oversized load drivers', '🚛', 'en', 'all'),
('Brasileiros on the Road', 'Comunidade de caminhoneiros brasileiros', '🇧🇷', 'pt', 'brazil');