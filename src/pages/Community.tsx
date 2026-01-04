import React, { useState } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { Users, Plus, MessageCircle, Globe, MapPin, Truck, ChevronRight, AlertTriangle, Building2 } from 'lucide-react';
import BottomNav from '@/components/navigation/BottomNav';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import RoadReportsList from '@/components/road/RoadReportsList';
import RoadReportButton from '@/components/road/RoadReportButton';
import FacilitiesList from '@/components/facility/FacilitiesList';

const CommunityScreen = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('reports');
  const [activeFilter, setActiveFilter] = useState('all');

  const filters = [
    { id: 'all', label: t.community.all },
    { id: 'language', label: t.community.byLanguage },
    { id: 'region', label: t.community.byRegion },
    { id: 'trailer', label: t.community.byTrailer },
  ];

  const mockCommunities = [
    {
      id: '1',
      name: 'Truckers USA',
      members: 12453,
      messages: 234,
      type: 'general',
      icon: '🇺🇸',
      lastMessage: 'Anyone knows if the I-40 weigh station is open?',
      lastMessageTime: '2m ago',
    },
    {
      id: '2',
      name: 'Camioneros Latinos',
      members: 5621,
      messages: 156,
      type: 'language',
      icon: '🌎',
      lastMessage: 'Buenas noches, alguien por Texas?',
      lastMessageTime: '5m ago',
    },
    {
      id: '3',
      name: 'Flatbed Haulers',
      members: 3245,
      messages: 89,
      type: 'trailer',
      icon: '🚛',
      lastMessage: 'Best straps for oversized loads?',
      lastMessageTime: '12m ago',
    },
    {
      id: '4',
      name: 'Brasileiros on the Road',
      members: 2134,
      messages: 67,
      type: 'language',
      icon: '🇧🇷',
      lastMessage: 'Boa noite pessoal!',
      lastMessageTime: '15m ago',
    },
  ];

  const filteredCommunities = activeFilter === 'all'
    ? mockCommunities
    : mockCommunities.filter(c => c.type === activeFilter || 
        (activeFilter === 'language' && c.type === 'language') ||
        (activeFilter === 'region' && c.type === 'region') ||
        (activeFilter === 'trailer' && c.type === 'trailer'));

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'language': return Globe;
      case 'region': return MapPin;
      case 'trailer': return Truck;
      default: return Users;
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
                </button>
              ))}
            </div>

            {/* Communities List */}
            {filteredCommunities.map((community) => (
              <button
                key={community.id}
                onClick={() => navigate(`/chat/${community.id}`)}
                className="w-full flex items-start gap-4 p-4 bg-card rounded-xl border border-border hover:border-primary/50 transition-all text-left"
              >
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 text-2xl">
                  {community.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground truncate">{community.name}</h3>
                  </div>
                  
                  <p className="text-sm text-muted-foreground truncate mt-0.5">
                    {community.lastMessage}
                  </p>
                  
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="w-3.5 h-3.5" />
                      <span>{community.members.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>{community.messages}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{community.lastMessageTime}</span>
                  </div>
                </div>

                <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-2" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Floating Report Button */}
      <RoadReportButton />

      <BottomNav activeTab="community" onTabChange={(tab) => navigate(`/${tab === 'map' ? 'home' : tab}`)} />
    </div>
  );
};

export default CommunityScreen;
