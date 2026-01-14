import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Play, Clock, Star, Download, Heart, CheckCircle2, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Video {
  id: string;
  title: string;
  duration: string;
  thumbnail: string;
  url: string;
  summary: string;
  category: string;
  isFavorite?: boolean;
  isOffline?: boolean;
}

interface LearnSecureLoadsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const operationTypes = [
  { id: 'dry_van', label: 'Dry Van' },
  { id: 'flatbed', label: 'Flatbed' },
  { id: 'car_hauler', label: 'Car Hauling' },
  { id: 'other', label: 'Other' },
];

const videosByCategory: Record<string, Video[]> = {
  dry_van: [
    {
      id: 'dv1',
      title: 'Load Securement Basics for Dry Van',
      duration: '8:32',
      thumbnail: '📦',
      url: 'https://youtube.com',
      summary: 'Learn the fundamentals of securing loads in dry van trailers, including proper use of load bars, straps, and blocking techniques.',
      category: 'dry_van',
    },
    {
      id: 'dv2',
      title: 'Weight Distribution Guide',
      duration: '12:15',
      thumbnail: '⚖️',
      url: 'https://youtube.com',
      summary: 'Master the art of weight distribution to ensure legal axle weights and safe handling during transit.',
      category: 'dry_van',
    },
    {
      id: 'dv3',
      title: 'DOT Inspection: Common Mistakes',
      duration: '6:45',
      thumbnail: '🔍',
      url: 'https://youtube.com',
      summary: 'Avoid these common load securement violations that DOT inspectors look for during Level 1 inspections.',
      category: 'dry_van',
    },
  ],
  flatbed: [
    {
      id: 'fb1',
      title: 'Chain & Binder Fundamentals',
      duration: '15:20',
      thumbnail: '⛓️',
      url: 'https://youtube.com',
      summary: 'Complete guide to using chains and load binders for heavy equipment and steel loads on flatbed trailers.',
      category: 'flatbed',
    },
    {
      id: 'fb2',
      title: 'Tarping Techniques Masterclass',
      duration: '18:45',
      thumbnail: '🎪',
      url: 'https://youtube.com',
      summary: 'Professional tarping methods for lumber, steel coils, and machinery. Includes wind-resistant techniques.',
      category: 'flatbed',
    },
    {
      id: 'fb3',
      title: 'Coil Securement Best Practices',
      duration: '10:30',
      thumbnail: '🔩',
      url: 'https://youtube.com',
      summary: 'Step-by-step guide to securing steel coils using proper coil racks, chains, and edge protectors.',
      category: 'flatbed',
    },
    {
      id: 'fb4',
      title: 'Edge Protectors & Corners',
      duration: '5:15',
      thumbnail: '📐',
      url: 'https://youtube.com',
      summary: 'When and how to use edge protectors to prevent strap damage and ensure proper working load limits.',
      category: 'flatbed',
    },
  ],
  car_hauler: [
    {
      id: 'ch1',
      title: 'Car Hauler Tie-Down Methods',
      duration: '14:00',
      thumbnail: '🚗',
      url: 'https://youtube.com',
      summary: 'Complete guide to wheel straps, axle straps, and proper positioning for safe vehicle transport.',
      category: 'car_hauler',
    },
    {
      id: 'ch2',
      title: 'Loading Sequence Strategy',
      duration: '11:30',
      thumbnail: '📋',
      url: 'https://youtube.com',
      summary: 'Optimize your loading sequence for efficient delivery routes and proper weight distribution.',
      category: 'car_hauler',
    },
    {
      id: 'ch3',
      title: 'Damage Prevention Tips',
      duration: '7:45',
      thumbnail: '🛡️',
      url: 'https://youtube.com',
      summary: 'Prevent vehicle damage during transport with proper padding, positioning, and securement techniques.',
      category: 'car_hauler',
    },
  ],
  other: [
    {
      id: 'ot1',
      title: 'Reefer Load Securement',
      duration: '9:15',
      thumbnail: '❄️',
      url: 'https://youtube.com',
      summary: 'Securing temperature-sensitive cargo in refrigerated trailers with proper airflow maintenance.',
      category: 'other',
    },
    {
      id: 'ot2',
      title: 'Tanker Load Safety',
      duration: '13:00',
      thumbnail: '⛽',
      url: 'https://youtube.com',
      summary: 'Understanding liquid surge, baffle systems, and safe driving techniques for tanker operators.',
      category: 'other',
    },
    {
      id: 'ot3',
      title: 'Oversize Load Regulations',
      duration: '16:30',
      thumbnail: '🚛',
      url: 'https://youtube.com',
      summary: 'Permits, escort requirements, and securement methods for oversize and overweight loads.',
      category: 'other',
    },
  ],
};

const LearnSecureLoadsModal: React.FC<LearnSecureLoadsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('flatbed');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const toggleFavorite = (videoId: string) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(videoId)) {
        newFavorites.delete(videoId);
      } else {
        newFavorites.add(videoId);
      }
      return newFavorites;
    });
  };

  const handleOpenVideo = (url: string) => {
    window.open(url, '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="text-xl flex items-center gap-2">
            📚 Learn & Secure Loads
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid grid-cols-4 mx-4">
            {operationTypes.map((type) => (
              <TabsTrigger key={type.id} value={type.id} className="text-xs px-2">
                {type.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {operationTypes.map((type) => (
              <TabsContent key={type.id} value={type.id} className="mt-0 space-y-3">
                {videosByCategory[type.id]?.map((video) => (
                  <div
                    key={video.id}
                    className="bg-card rounded-xl border border-border overflow-hidden"
                  >
                    <div className="flex items-start gap-3 p-3">
                      {/* Thumbnail */}
                      <div className="w-20 h-14 bg-secondary rounded-lg flex items-center justify-center text-2xl flex-shrink-0 relative">
                        {video.thumbnail}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg opacity-0 hover:opacity-100 transition-opacity">
                          <Play className="w-6 h-6 text-white" />
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-foreground text-sm line-clamp-2">{video.title}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {video.duration}
                          </Badge>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => toggleFavorite(video.id)}
                          className={`p-2 rounded-full transition-colors ${
                            favorites.has(video.id)
                              ? 'bg-red-500/20 text-red-500'
                              : 'bg-secondary text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <Heart className={`w-4 h-4 ${favorites.has(video.id) ? 'fill-current' : ''}`} />
                        </button>
                      </div>
                    </div>

                    {/* AI Summary */}
                    <div className="px-3 pb-3">
                      <p className="text-xs text-muted-foreground">{video.summary}</p>
                    </div>

                    {/* Watch Button */}
                    <button
                      onClick={() => handleOpenVideo(video.url)}
                      className="w-full py-2.5 bg-primary/10 text-primary text-sm font-medium flex items-center justify-center gap-2 hover:bg-primary/20 transition-colors"
                    >
                      <Play className="w-4 h-4" />
                      Watch Video
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </TabsContent>
            ))}
          </div>
        </Tabs>

        {/* Favorites Section */}
        {favorites.size > 0 && (
          <div className="border-t border-border p-3 bg-card">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-success" />
              <span>{favorites.size} video(s) favorited</span>
              <Badge variant="outline" className="text-xs ml-auto">
                <Download className="w-3 h-3 mr-1" />
                Available Offline
              </Badge>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default LearnSecureLoadsModal;
