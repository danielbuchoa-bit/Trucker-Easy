import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ChatRoom {
  id: string;
  name: string;
  icon: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
}

interface ChatContextType {
  myRooms: ChatRoom[];
  lastActiveRoomId: string | null;
  unreadCount: number;
  isLoading: boolean;
  currentUserId: string | null;
  refreshMyRooms: () => Promise<void>;
  setLastActiveRoomId: (id: string) => void;
  markRoomAsRead: (roomId: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within ChatProvider');
  }
  return context;
};

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [myRooms, setMyRooms] = useState<ChatRoom[]>([]);
  const [lastActiveRoomId, setLastActiveRoomId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Check auth
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setCurrentUserId(session?.user?.id || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch user's rooms
  const refreshMyRooms = useCallback(async () => {
    if (!currentUserId) {
      setMyRooms([]);
      setIsLoading(false);
      return;
    }

    try {
      // Get rooms the user is member of
      const { data: memberships, error: memberError } = await supabase
        .from('chat_room_members')
        .select('room_id, last_read_at')
        .eq('user_id', currentUserId);

      if (memberError) throw memberError;

      if (!memberships || memberships.length === 0) {
        setMyRooms([]);
        setUnreadCount(0);
        setIsLoading(false);
        return;
      }

      const roomIds = memberships.map(m => m.room_id);
      const lastReadMap = Object.fromEntries(
        memberships.map(m => [m.room_id, m.last_read_at])
      );

      // Get room details
      const { data: rooms, error: roomsError } = await supabase
        .from('chat_rooms')
        .select('id, name, icon, last_message_at, last_message_preview')
        .in('id', roomIds)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (roomsError) throw roomsError;

      setMyRooms(rooms || []);

      // Calculate unread
      let unread = 0;
      for (const room of rooms || []) {
        const lastRead = lastReadMap[room.id];
        if (room.last_message_at && (!lastRead || new Date(room.last_message_at) > new Date(lastRead))) {
          unread++;
        }
      }
      setUnreadCount(unread);

      // Set last active room
      if (rooms && rooms.length > 0 && !lastActiveRoomId) {
        setLastActiveRoomId(rooms[0].id);
      }
    } catch (error) {
      console.error('Error fetching rooms:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId, lastActiveRoomId]);

  // Mark room as read
  const markRoomAsRead = useCallback(async (roomId: string) => {
    if (!currentUserId) return;

    try {
      await supabase
        .from('chat_room_members')
        .update({ last_read_at: new Date().toISOString() })
        .eq('room_id', roomId)
        .eq('user_id', currentUserId);

      // Recalculate unread
      await refreshMyRooms();
    } catch (error) {
      console.error('Error marking room as read:', error);
    }
  }, [currentUserId, refreshMyRooms]);

  // Initial fetch and realtime subscription
  useEffect(() => {
    if (currentUserId) {
      refreshMyRooms();

      // Subscribe to room updates for unread badge
      const channel = supabase
        .channel('chat-updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'chat_rooms',
          },
          () => {
            refreshMyRooms();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'chat_room_members',
            filter: `user_id=eq.${currentUserId}`,
          },
          () => {
            refreshMyRooms();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [currentUserId, refreshMyRooms]);

  return (
    <ChatContext.Provider
      value={{
        myRooms,
        lastActiveRoomId,
        unreadCount,
        isLoading,
        currentUserId,
        refreshMyRooms,
        setLastActiveRoomId,
        markRoomAsRead,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};
