import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { useChatContext } from '@/contexts/ChatContext';
import { useActionGate } from '@/hooks/useActionGate';
import { cn } from '@/lib/utils';

const FloatingChatButton: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { myRooms, lastActiveRoomId, unreadCount } = useChatContext();
  const gate = useActionGate();

  // Hide on chat room pages
  const isChatPage = location.pathname.startsWith('/chat/');
  if (isChatPage) return null;

  const handleClick = () => {
    if (!gate()) return; // redirects to payment if not auth/subscribed
    if (myRooms.length > 0 && lastActiveRoomId) {
      navigate(`/chat/${lastActiveRoomId}`);
    } else {
      navigate('/community?tab=chat');
    }
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        'fixed z-50 w-14 h-14 rounded-full shadow-lg',
        'bg-primary text-primary-foreground',
        'flex items-center justify-center',
        'transition-all duration-200 active:scale-95',
        'hover:shadow-xl hover:scale-105',
        'right-4 bottom-24' // Above bottom nav
      )}
      aria-label="Open chat"
    >
      <MessageCircle className="w-6 h-6" />
      
      {/* Unread badge */}
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center justify-center">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
};

export default FloatingChatButton;
