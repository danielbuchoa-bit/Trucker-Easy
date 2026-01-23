import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { Users, Plus, MessageCircle, ChevronRight, AlertTriangle, Building2, Loader2, Newspaper, BookOpen } from 'lucide-react';
import BottomNav from '@/components/navigation/BottomNav';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import RoadReportsList from '@/components/road/RoadReportsList';
import RoadReportButton from '@/components/road/RoadReportButton';
import FacilitiesList from '@/components/facility/FacilitiesList';
import CreateRoomModal from '@/components/chat/CreateRoomModal';
import NewsFeed from '@/components/community/NewsFeed';
import LearnSecureLoadsTab from '@/components/community/LearnSecureLoadsTab';
import EnglishQuickReturn from '@/components/settings/EnglishQuickReturn';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { pt, es, enUS } from 'date-fns/locale';
import { useChatContext } from '@/contexts/ChatContext';

interface ChatRoom {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  language: string;
  region: string;
  trailer_type: string;
  member_count: number;
  message_count: number;
  last_message_preview: string | null;
  last_message_at: string | null;
  created_by: string | null;
}

const CommunityScreen = () => {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { myRooms, currentUserId } = useChatContext();
  
  const initialTab = searchParams.get('tab') || 'reports';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [activeFilter, setActiveFilter] = useState('all');
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const dateLocale = language === 'pt' ? pt : language === 'es' ? es : enUS;

  const myRoomIds = new Set(myRooms.map(r => r.id));

  const filters = [
    { id: 'all', label: t.community.all },
    { id: 'my_rooms', label: language === 'pt' ? 'Minhas Salas' : language === 'es' ? 'Mis Salas' : 'My Rooms' },
    { id: 'language', label: t.community.byLanguage },
    { id: 'region', label: t.community.byRegion },
    { id: 'trailer', label: t.community.byTrailer },
  ];

  useEffect(() => {
    fetchChatRooms();
  }, []);

  const fetchChatRooms = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_rooms')
        .select('*')
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (error) throw error;
      setChatRooms(data || []);
    } catch (error) {
      console.error('Error fetching chat rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCommunities = activeFilter === 'all'
    ? chatRooms
    : activeFilter === 'my_rooms'
    ? chatRooms.filter(room => myRoomIds.has(room.id))
    : chatRooms.filter(room => {
        if (activeFilter === 'language') return room.language !== 'all';
        if (activeFilter === 'region') return room.region !== 'all';
        if (activeFilter === 'trailer') return room.trailer_type !== 'all';
        return true;
      });

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '';
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: dateLocale });
    } catch {
      return '';
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border safe-top">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-foreground">{t.nav.community}</h1>
            <EnglishQuickReturn />
          </div>
          
          {/* Tabs - 5 tabs now */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-5 h-auto">
              <TabsTrigger value="reports" className="flex flex-col items-center gap-0.5 py-2 px-1 text-xs">
                <AlertTriangle className="w-4 h-4" />
                <span>{t.community.tabs.reports}</span>
              </TabsTrigger>
              <TabsTrigger value="facilities" className="flex flex-col items-center gap-0.5 py-2 px-1 text-xs">
                <Building2 className="w-4 h-4" />
                <span>{t.community.tabs.facilities}</span>
              </TabsTrigger>
              <TabsTrigger value="chat" className="flex flex-col items-center gap-0.5 py-2 px-1 text-xs">
                <MessageCircle className="w-4 h-4" />
                <span>{t.community.tabs.chat}</span>
              </TabsTrigger>
              <TabsTrigger value="news" className="flex flex-col items-center gap-0.5 py-2 px-1 text-xs">
                <Newspaper className="w-4 h-4" />
                <span>{t.community.tabs.news}</span>
              </TabsTrigger>
              <TabsTrigger value="learn" className="flex flex-col items-center gap-0.5 py-2 px-1 text-xs">
                <BookOpen className="w-4 h-4" />
                <span>{t.community.tabs.learn}</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === 'reports' && <RoadReportsList />}
        
        {activeTab === 'facilities' && <FacilitiesList />}
        
        {activeTab === 'news' && <NewsFeed />}
        
        {activeTab === 'learn' && <LearnSecureLoadsTab />}
        
        {activeTab === 'chat' && (
          <div className="space-y-3">
            {/* Create Room Button - More Prominent */}
            <button
              onClick={() => currentUserId ? setShowCreateModal(true) : navigate('/auth')}
              className="w-full p-4 bg-gradient-to-r from-primary to-primary/80 rounded-2xl text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <Plus className="w-6 h-6 text-primary-foreground" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-primary-foreground">+ {t.community.createGroup}</h3>
                  <p className="text-sm text-primary-foreground/80">
                    {language === 'pt' ? 'Inicie sua própria sala de chat' : 
                     language === 'es' ? 'Inicia tu propio chat comunitario' : 
                     'Start your own community chat'}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-primary-foreground" />
              </div>
            </button>

            {/* Filter Pills */}
            <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
              {filters.map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setActiveFilter(filter.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                    activeFilter === filter.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card border border-border text-foreground hover:border-primary/50'
                  }`}
                >
                  {filter.label}
                  {filter.id === 'my_rooms' && myRooms.length > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 bg-white/20 rounded-full text-xs">
                      {myRooms.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Loading State */}
            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            )}

            {/* Communities List */}
            {!loading && filteredCommunities.map((room) => {
              const isMember = myRoomIds.has(room.id);
              const isDriverCreated = room.created_by !== null; // Rooms created by drivers have created_by
              return (
                <button
                  key={room.id}
                  onClick={() => navigate(`/chat/${room.id}`)}
                  className="w-full flex items-start gap-4 p-4 bg-card rounded-xl border border-border hover:border-primary/50 transition-all text-left"
                >
                  <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 text-2xl">
                    {room.icon || '💬'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-foreground truncate">{room.name}</h3>
                      {isMember && (
                        <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full font-medium">
                          {language === 'pt' ? 'Membro' : language === 'es' ? 'Miembro' : 'Member'}
                        </span>
                      )}
                      {isDriverCreated && (
                        <span className="px-2 py-0.5 bg-secondary text-muted-foreground text-xs rounded-full font-medium flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {language === 'pt' ? 'Sala de Motorista' : language === 'es' ? 'Sala de Conductor' : 'Driver Room'}
                        </span>
                      )}
                    </div>
                    
                    <p className="text-sm text-muted-foreground truncate mt-0.5">
                      {room.last_message_preview || room.description || 
                        (language === 'pt' ? 'Nenhuma mensagem ainda' : 
                         language === 'es' ? 'Sin mensajes aún' : 'No messages yet')}
                    </p>
                    
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="w-3.5 h-3.5" />
                        <span>{room.member_count.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>{room.message_count}</span>
                      </div>
                      {room.last_message_at && (
                        <span className="text-xs text-muted-foreground">{formatTime(room.last_message_at)}</span>
                      )}
                    </div>
                  </div>

                  <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-2" />
                </button>
              );
            })}

            {/* Empty State */}
            {!loading && filteredCommunities.length === 0 && (
              <div className="text-center py-12">
                <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {activeFilter === 'my_rooms' 
                    ? (language === 'pt' ? "Você ainda não entrou em nenhuma sala" : 
                       language === 'es' ? "Aún no te has unido a ninguna sala" : 
                       "You haven't joined any rooms yet")
                    : (language === 'pt' ? 'Nenhuma sala encontrada' : 
                       language === 'es' ? 'No se encontraron salas' : 
                       'No chat rooms found')}
                </p>
                {activeFilter === 'my_rooms' && (
                  <button
                    onClick={() => setActiveFilter('all')}
                    className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm font-medium"
                  >
                    {language === 'pt' ? 'Explorar salas' : 
                     language === 'es' ? 'Explorar salas' : 
                     'Explore rooms'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateRoomModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} />

      {/* Floating Report Button */}
      <RoadReportButton />

      <BottomNav activeTab="community" onTabChange={(tab) => navigate(`/${tab === 'map' ? 'home' : tab}`)} />
    </div>
  );
};

export default CommunityScreen;
