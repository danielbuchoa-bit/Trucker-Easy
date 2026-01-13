-- Add notifications_enabled column to chat_room_members
ALTER TABLE public.chat_room_members 
ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT true;

-- Add last_read_at column to track unread messages
ALTER TABLE public.chat_room_members 
ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Enable realtime for chat_rooms table only (chat_messages already enabled)
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_rooms;