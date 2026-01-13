import { useState, useRef, useEffect } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Send, MoreVertical, Users, Flag, Loader2, LogOut, Edit2, Bell, BellOff, Circle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import NicknameModal from '@/components/chat/NicknameModal';
import { useChatContext } from '@/contexts/ChatContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ChatRoom {
  id: string;
  name: string;
  icon: string | null;
  member_count: number;
}

interface ChatMessage {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  user_nickname?: string;
  user_phone?: string;
}

interface UserProfile {
  id: string;
  full_name: string | null;
  phone: string | null;
}

const ChatRoomScreen = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { id: roomId } = useParams();
  const { setLastActiveRoomId, markRoomAsRead, refreshMyRooms, currentUserId } = useChatContext();
  
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [joining, setJoining] = useState(false);
  const [userProfiles, setUserProfiles] = useState<Record<string, UserProfile>>({});
  const [memberNicknames, setMemberNicknames] = useState<Record<string, string>>({});
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [myNickname, setMyNickname] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [onlineCount, setOnlineCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Set last active room
  useEffect(() => {
    if (roomId) {
      setLastActiveRoomId(roomId);
    }
  }, [roomId, setLastActiveRoomId]);

  // Check auth and redirect if needed
  useEffect(() => {
    if (currentUserId === null) {
      // Still loading
    } else if (!currentUserId) {
      toast({
        title: 'Login necessário',
        description: 'Você precisa estar logado para acessar o chat.',
        variant: 'destructive',
      });
      navigate('/auth');
    }
  }, [currentUserId, navigate, toast]);

  useEffect(() => {
    if (roomId && currentUserId) {
      fetchRoom();
      checkMembership();
    }
  }, [roomId, currentUserId]);

  useEffect(() => {
    if (isMember && roomId) {
      fetchMessages();
      const unsubscribe = subscribeToMessages();
      markRoomAsRead(roomId);
      
      // Setup presence
      setupPresence();

      return () => {
        if (unsubscribe) unsubscribe();
      };
    }
  }, [isMember, roomId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchRoom = async () => {
    if (!roomId) return;
    
    const { data, error } = await supabase
      .from('chat_rooms')
      .select('id, name, icon, member_count')
      .eq('id', roomId)
      .single();

    if (error) {
      console.error('Error fetching room:', error);
      return;
    }
    
    setRoom(data);
  };

  const checkMembership = async () => {
    if (!roomId || !currentUserId) return;
    
    const { data } = await supabase
      .from('chat_room_members')
      .select('id, nickname, notifications_enabled')
      .eq('room_id', roomId)
      .eq('user_id', currentUserId)
      .maybeSingle();

    setIsMember(!!data);
    if (data?.nickname) {
      setMyNickname(data.nickname);
    }
    if (data?.notifications_enabled !== undefined) {
      setNotificationsEnabled(data.notifications_enabled);
    }
    setLoading(false);
  };

  const fetchMessages = async () => {
    if (!roomId) return;

    const { data: messagesData, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      console.error('Error fetching messages:', error);
      return;
    }

    if (messagesData) {
      setMessages(messagesData);
      
      const userIds = [...new Set(messagesData.map(m => m.user_id))];
      await fetchUserProfiles(userIds);
      await fetchMemberNicknames(userIds);
    }
  };

  const fetchUserProfiles = async (userIds: string[]) => {
    if (userIds.length === 0) return;

    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, phone')
      .in('id', userIds);

    if (data) {
      const profilesMap: Record<string, UserProfile> = {};
      data.forEach(profile => {
        profilesMap[profile.id] = profile;
      });
      setUserProfiles(prev => ({ ...prev, ...profilesMap }));
    }
  };

  const fetchMemberNicknames = async (userIds: string[]) => {
    if (userIds.length === 0 || !roomId) return;

    const { data } = await supabase
      .from('chat_room_members')
      .select('user_id, nickname')
      .eq('room_id', roomId)
      .in('user_id', userIds);

    if (data) {
      const nicknamesMap: Record<string, string> = {};
      data.forEach(member => {
        if (member.nickname) {
          nicknamesMap[member.user_id] = member.nickname;
        }
      });
      setMemberNicknames(prev => ({ ...prev, ...nicknamesMap }));
    }
  };

  const subscribeToMessages = () => {
    if (!roomId) return;

    const channel = supabase
      .channel(`room-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          const newMessage = payload.new as ChatMessage;
          setMessages(prev => [...prev, newMessage]);
          
          if (!userProfiles[newMessage.user_id]) {
            await fetchUserProfiles([newMessage.user_id]);
            await fetchMemberNicknames([newMessage.user_id]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const setupPresence = () => {
    if (!roomId || !currentUserId) return;

    const channel = supabase.channel(`presence-${roomId}`, {
      config: {
        presence: {
          key: currentUserId,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setOnlineCount(Object.keys(state).length);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: currentUserId,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleJoinRoom = () => {
    setShowNicknameModal(true);
  };

  const handleJoinWithNickname = async (nickname: string) => {
    if (!roomId || !currentUserId) return;
    
    setJoining(true);
    
    const { error } = await supabase
      .from('chat_room_members')
      .insert({
        room_id: roomId,
        user_id: currentUserId,
        nickname: nickname,
      });

    if (error) {
      console.error('Error joining room:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível entrar na sala.',
        variant: 'destructive',
      });
    } else {
      setMyNickname(nickname);
      setMemberNicknames(prev => ({ ...prev, [currentUserId]: nickname }));
      setIsMember(true);
      setShowNicknameModal(false);
      await refreshMyRooms();
      toast({
        title: 'Bem-vindo!',
        description: `Você entrou como "${nickname}".`,
      });
    }
    
    setJoining(false);
  };

  const handleUpdateNickname = async (nickname: string) => {
    if (!roomId || !currentUserId) return;
    
    const { error } = await supabase
      .from('chat_room_members')
      .update({ nickname })
      .eq('room_id', roomId)
      .eq('user_id', currentUserId);

    if (error) {
      console.error('Error updating nickname:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o apelido.',
        variant: 'destructive',
      });
    } else {
      setMyNickname(nickname);
      setMemberNicknames(prev => ({ ...prev, [currentUserId]: nickname }));
      setShowNicknameModal(false);
      toast({
        title: 'Apelido atualizado!',
        description: `Agora você é "${nickname}".`,
      });
    }
  };

  const handleToggleNotifications = async () => {
    if (!roomId || !currentUserId) return;

    const newValue = !notificationsEnabled;
    
    const { error } = await supabase
      .from('chat_room_members')
      .update({ notifications_enabled: newValue })
      .eq('room_id', roomId)
      .eq('user_id', currentUserId);

    if (error) {
      console.error('Error updating notifications:', error);
    } else {
      setNotificationsEnabled(newValue);
      toast({
        title: newValue ? 'Notificações ativadas' : 'Notificações desativadas',
        description: newValue 
          ? 'Você receberá alertas de novas mensagens.'
          : 'Você não receberá alertas desta sala.',
      });
    }
  };

  const handleLeaveRoom = async () => {
    if (!roomId || !currentUserId) return;
    
    const { error } = await supabase
      .from('chat_room_members')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', currentUserId);

    if (error) {
      console.error('Error leaving room:', error);
    } else {
      setIsMember(false);
      setMessages([]);
      await refreshMyRooms();
      toast({
        title: 'Você saiu',
        description: 'Você saiu da sala de chat.',
      });
      navigate('/community?tab=chat');
    }
  };

  const handleSend = async () => {
    if (!message.trim() || !roomId || !currentUserId || sending) return;
    
    setSending(true);
    
    const { error } = await supabase
      .from('chat_messages')
      .insert({
        room_id: roomId,
        user_id: currentUserId,
        content: message.trim(),
      });

    if (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível enviar a mensagem.',
        variant: 'destructive',
      });
    } else {
      setMessage('');
    }
    
    setSending(false);
  };

  const getUserDisplayName = (userId: string) => {
    const nickname = memberNicknames[userId];
    if (nickname) return nickname;
    
    const profile = userProfiles[userId];
    if (profile?.full_name) return profile.full_name;
    if (profile?.phone) return `📱 ${profile.phone}`;
    
    return 'Motorista';
  };

  const formatMessageTime = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'HH:mm');
    } catch {
      return '';
    }
  };

  if (loading || currentUserId === null) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border safe-top">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/community?tab=chat')}
              className="w-10 h-10 bg-card border border-border rounded-full flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-xl">
                {room?.icon || '💬'}
              </div>
              <div>
                <h1 className="font-semibold text-foreground">{room?.name || 'Chat'}</h1>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    <span>{room?.member_count.toLocaleString() || 0}</span>
                  </div>
                  {isMember && onlineCount > 0 && (
                    <div className="flex items-center gap-1 text-green-500">
                      <Circle className="w-2 h-2 fill-current" />
                      <span>{onlineCount} online</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {isMember && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-foreground">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => setShowNicknameModal(true)}>
                  <Edit2 className="w-4 h-4 mr-2" />
                  Editar apelido
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleToggleNotifications}>
                  {notificationsEnabled ? (
                    <>
                      <BellOff className="w-4 h-4 mr-2" />
                      Desativar notificações
                    </>
                  ) : (
                    <>
                      <Bell className="w-4 h-4 mr-2" />
                      Ativar notificações
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={handleLeaveRoom}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sair da sala
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Join Room Prompt */}
      {!isMember && !showNicknameModal && (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="text-6xl mb-4">{room?.icon || '💬'}</div>
          <h2 className="text-xl font-semibold text-foreground mb-2">{room?.name}</h2>
          <p className="text-muted-foreground text-center mb-6">
            Entre na sala para ver as mensagens e participar das conversas.
          </p>
          <button
            onClick={handleJoinRoom}
            disabled={joining}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-full font-medium disabled:opacity-50"
          >
            Escolher Apelido e Entrar
          </button>
        </div>
      )}

      {/* Nickname Modal */}
      <NicknameModal
        isOpen={showNicknameModal}
        onClose={() => setShowNicknameModal(false)}
        onSubmit={isMember ? handleUpdateNickname : handleJoinWithNickname}
        roomName={room?.name || 'Chat'}
      />

      {/* Messages */}
      {isMember && (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Nenhuma mensagem ainda. Seja o primeiro a enviar!</p>
              </div>
            )}
            
            {messages.map((msg) => {
              const isMe = msg.user_id === currentUserId;
              return (
                <div
                  key={msg.id}
                  className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] ${
                      isMe
                        ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-md'
                        : 'bg-card border border-border rounded-2xl rounded-bl-md'
                    } p-3`}
                  >
                    {!isMe && (
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-medium text-primary">
                          {getUserDisplayName(msg.user_id)}
                        </span>
                        <button className="text-muted-foreground hover:text-foreground">
                          <Flag className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    <p className={`text-sm ${isMe ? 'text-primary-foreground' : 'text-foreground'}`}>
                      {msg.content}
                    </p>
                    <p className={`text-xs mt-1 ${isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                      {formatMessageTime(msg.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="sticky bottom-0 bg-background border-t border-border p-4 safe-bottom">
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder={t.community.typeMessage}
                className="flex-1 h-12 px-4 bg-card border border-border rounded-full text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                onClick={handleSend}
                disabled={!message.trim() || sending}
                className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-primary-foreground disabled:opacity-50"
              >
                {sending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ChatRoomScreen;
