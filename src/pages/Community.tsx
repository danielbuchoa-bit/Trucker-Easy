import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { Users, Plus, MessageCircle, Globe, MapPin, Truck, ChevronRight, AlertTriangle, Building2, Loader2, Newspaper, BookOpen } from 'lucide-react';
import BottomNav from '@/components/navigation/BottomNav';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import RoadReportsList from '@/components/road/RoadReportsList';
import RoadReportButton from '@/components/road/RoadReportButton';
import FacilitiesList from '@/components/facility/FacilitiesList';
import CreateRoomModal from '@/components/chat/CreateRoomModal';
import NewsFeed from '@/components/community/NewsFeed';
import LearnSecureLoadsModal from '@/components/community/LearnSecureLoadsModal';
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
  const [showLearnModal, setShowLearnModal] = useState(false);
  const [chatMode, setChatMode] = useState<'news' | 'drivers'>('news');

  const dateLocale = language === 'pt' ? pt : language === 'es' ? es : enUS;

  const myRoomIds = new Set(myRooms.map(r => r.id));

  const filters = [
    { id: 'all', label: t.community.all },
    { id: 'my_rooms', label: 'My Rooms' },
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
          </div>
          
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-3">
              <TabsTrigger value="reports" className="flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                Reports
              </TabsTrigger>
              <TabsTrigger value="facilities" className="flex items-center gap-1">
                <Building2 className="w-4 h-4" />
                Facilities
              </TabsTrigger>
              <TabsTrigger value="chat" className="flex items-center gap-1">
                <MessageCircle className="w-4 h-4" />
                Chat
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === 'reports' && <RoadReportsList />}
        
        {activeTab === 'facilities' && <FacilitiesList />}
        
        {activeTab === 'chat' && (
          <div className="space-y-3">
            {/* Learn & Secure Loads Card */}
            <button
              onClick={() => setShowLearnModal(true)}
              className="w-full p-4 bg-gradient-to-r from-info/20 to-info/10 rounded-2xl border border-info/30 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-info/20 rounded-full flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-info" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">Learn & Secure Loads</h3>
                  <p className="text-sm text-muted-foreground">Training videos by operation type</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </button>

            {/* News / Drivers Toggle */}
            <div className="flex bg-secondary rounded-full p-1">
              <button
                onClick={() => setChatMode('news')}
                className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  chatMode === 'news' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                }`}
              >
                <Newspaper className="w-4 h-4" />
                News
              </button>
              <button
                onClick={() => setChatMode('drivers')}
                className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  chatMode === 'drivers' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                }`}
              >
                <Users className="w-4 h-4" />
                Drivers
              </button>
            </div>

            {chatMode === 'news' ? (
              <NewsFeed />
            ) : (
              <>
                {/* CTA Banner */}
                <button
                  onClick={() => currentUserId ? setShowCreateModal(true) : navigate('/auth')}
                  className="w-full p-4 bg-gradient-to-r from-primary to-primary/80 rounded-2xl text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                      <Plus className="w-6 h-6 text-primary-foreground" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-primary-foreground">Join a chat now</h3>
                      <p className="text-sm text-primary-foreground/80">Chat with other drivers in real-time</p>
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
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground truncate">{room.name}</h3>
                          {isMember && (
                            <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full font-medium">
                              Member
                            </span>
                          )}
                        </div>
                        
                        <p className="text-sm text-muted-foreground truncate mt-0.5">
                          {room.last_message_preview || room.description || 'No messages yet'}
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
                      {activeFilter === 'my_rooms' ? "You haven't joined any rooms yet" : 'No chat rooms found'}
                    </p>
                    {activeFilter === 'my_rooms' && (
                      <button
                        onClick={() => setActiveFilter('all')}
                        className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm font-medium"
                      >
                        Explore rooms
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateRoomModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} />
      <LearnSecureLoadsModal isOpen={showLearnModal} onClose={() => setShowLearnModal(false)} />

      {/* Floating Report Button */}
      <RoadReportButton />

      <BottomNav activeTab="community" onTabChange={(tab) => navigate(`/${tab === 'map' ? 'home' : tab}`)} />
    </div>
  );
};

export default CommunityScreen;
