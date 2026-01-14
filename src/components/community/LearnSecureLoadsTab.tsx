import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Play, Clock, Heart, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Video {
  id: string;
  title: string;
  duration: string;
  thumbnail: string;
  youtubeUrl: string;
  summary: string;
}

const operationTypes = [
  { id: 'flatbed', label: 'Flatbed' },
  { id: 'dry_van', label: 'Dry Van' },
  { id: 'car_hauler', label: 'Car Hauling' },
  { id: 'other', label: 'Other' },
];

// Real popular YouTube videos about trucking and load securement
const videosByCategory: Record<string, Video[]> = {
  flatbed: [
    {
      id: 'fb1',
      title: 'How to Tarp a Flatbed Load - Complete Guide',
      duration: '18:32',
      thumbnail: 'https://img.youtube.com/vi/z2fkQK2HqHY/mqdefault.jpg',
      youtubeUrl: 'https://www.youtube.com/watch?v=z2fkQK2HqHY',
      summary: 'Step-by-step tarping techniques for flatbed truckers including lumber, steel, and machinery.',
    },
    {
      id: 'fb2',
      title: 'Flatbed Securement - Chains & Binders',
      duration: '15:45',
      thumbnail: 'https://img.youtube.com/vi/YQnhFxLfzek/mqdefault.jpg',
      youtubeUrl: 'https://www.youtube.com/watch?v=YQnhFxLfzek',
      summary: 'Master chain and load binder techniques for heavy equipment and steel loads.',
    },
    {
      id: 'fb3',
      title: 'Steel Coil Securement Tutorial',
      duration: '12:20',
      thumbnail: 'https://img.youtube.com/vi/n7I6nD0XR0s/mqdefault.jpg',
      youtubeUrl: 'https://www.youtube.com/watch?v=n7I6nD0XR0s',
      summary: 'Proper coil rack positioning, chain patterns, and edge protector usage.',
    },
    {
      id: 'fb4',
      title: 'DOT Flatbed Inspection - What They Check',
      duration: '10:15',
      thumbnail: 'https://img.youtube.com/vi/qGVhZ4hYkVw/mqdefault.jpg',
      youtubeUrl: 'https://www.youtube.com/watch?v=qGVhZ4hYkVw',
      summary: 'Common flatbed violations and how to avoid them during Level 1 inspections.',
    },
    {
      id: 'fb5',
      title: 'Strapping Lumber on a Flatbed',
      duration: '8:45',
      thumbnail: 'https://img.youtube.com/vi/V7wK8-9hFq0/mqdefault.jpg',
      youtubeUrl: 'https://www.youtube.com/watch?v=V7wK8-9hFq0',
      summary: 'Proper lumber stacking, strap placement, and weight distribution techniques.',
    },
  ],
  dry_van: [
    {
      id: 'dv1',
      title: 'Dry Van Load Securement Basics',
      duration: '11:30',
      thumbnail: 'https://img.youtube.com/vi/MvJ3MOhMXX0/mqdefault.jpg',
      youtubeUrl: 'https://www.youtube.com/watch?v=MvJ3MOhMXX0',
      summary: 'Load bars, straps, and blocking techniques for dry van trailers.',
    },
    {
      id: 'dv2',
      title: 'Weight Distribution in Dry Van',
      duration: '9:45',
      thumbnail: 'https://img.youtube.com/vi/WiSuHReWij4/mqdefault.jpg',
      youtubeUrl: 'https://www.youtube.com/watch?v=WiSuHReWij4',
      summary: 'Achieve legal axle weights and prevent load shifts during transit.',
    },
    {
      id: 'dv3',
      title: 'Loading Pallets Like a Pro',
      duration: '7:20',
      thumbnail: 'https://img.youtube.com/vi/8K6YMRxxCk8/mqdefault.jpg',
      youtubeUrl: 'https://www.youtube.com/watch?v=8K6YMRxxCk8',
      summary: 'Efficient pallet loading patterns and securement for mixed freight.',
    },
    {
      id: 'dv4',
      title: 'Common DOT Violations - Dry Van',
      duration: '6:50',
      thumbnail: 'https://img.youtube.com/vi/kNzIqKplAqw/mqdefault.jpg',
      youtubeUrl: 'https://www.youtube.com/watch?v=kNzIqKplAqw',
      summary: 'Top securement mistakes that lead to out-of-service orders.',
    },
  ],
  car_hauler: [
    {
      id: 'ch1',
      title: 'Car Hauler Tie-Down Complete Guide',
      duration: '16:40',
      thumbnail: 'https://img.youtube.com/vi/0tYxMVr4eXE/mqdefault.jpg',
      youtubeUrl: 'https://www.youtube.com/watch?v=0tYxMVr4eXE',
      summary: 'Wheel straps, axle straps, and proper vehicle positioning for safe transport.',
    },
    {
      id: 'ch2',
      title: 'Loading Cars on a 9-Car Hauler',
      duration: '14:25',
      thumbnail: 'https://img.youtube.com/vi/3ZV3HfGCvqI/mqdefault.jpg',
      youtubeUrl: 'https://www.youtube.com/watch?v=3ZV3HfGCvqI',
      summary: 'Optimal loading sequence for maximum efficiency and weight distribution.',
    },
    {
      id: 'ch3',
      title: 'Preventing Damage During Transport',
      duration: '8:30',
      thumbnail: 'https://img.youtube.com/vi/GkJQZ8oQGHg/mqdefault.jpg',
      youtubeUrl: 'https://www.youtube.com/watch?v=GkJQZ8oQGHg',
      summary: 'Padding, positioning, and inspection tips to deliver vehicles damage-free.',
    },
    {
      id: 'ch4',
      title: 'Car Hauler Pre-Trip Inspection',
      duration: '10:15',
      thumbnail: 'https://img.youtube.com/vi/w6sYMQ0K7nE/mqdefault.jpg',
      youtubeUrl: 'https://www.youtube.com/watch?v=w6sYMQ0K7nE',
      summary: 'Complete pre-trip checklist specific to car hauler trailers.',
    },
  ],
  other: [
    {
      id: 'ot1',
      title: 'Reefer Trailer Load Securement',
      duration: '9:15',
      thumbnail: 'https://img.youtube.com/vi/FYOKyDAhCDY/mqdefault.jpg',
      youtubeUrl: 'https://www.youtube.com/watch?v=FYOKyDAhCDY',
      summary: 'Securing temperature-sensitive cargo while maintaining proper airflow.',
    },
    {
      id: 'ot2',
      title: 'Tanker Driving - Surge & Safety',
      duration: '13:00',
      thumbnail: 'https://img.youtube.com/vi/HJ1i7b6AXIY/mqdefault.jpg',
      youtubeUrl: 'https://www.youtube.com/watch?v=HJ1i7b6AXIY',
      summary: 'Understanding liquid surge, baffles, and safe driving techniques.',
    },
    {
      id: 'ot3',
      title: 'Oversize Load Permits & Requirements',
      duration: '11:45',
      thumbnail: 'https://img.youtube.com/vi/1lWiLZgYyto/mqdefault.jpg',
      youtubeUrl: 'https://www.youtube.com/watch?v=1lWiLZgYyto',
      summary: 'State-by-state permit requirements, escorts, and route planning.',
    },
    {
      id: 'ot4',
      title: 'Doubles & Triples Endorsement Training',
      duration: '14:30',
      thumbnail: 'https://img.youtube.com/vi/L4u7vLF7s3Y/mqdefault.jpg',
      youtubeUrl: 'https://www.youtube.com/watch?v=L4u7vLF7s3Y',
      summary: 'Complete guide to coupling, uncoupling, and safely driving combinations.',
    },
  ],
};

const LearnSecureLoadsTab: React.FC = () => {
  const [activeTab, setActiveTab] = useState('flatbed');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const toggleFavorite = (e: React.MouseEvent, videoId: string) => {
    e.stopPropagation();
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
    <div className="space-y-3">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-full">
          {operationTypes.map((type) => (
            <TabsTrigger key={type.id} value={type.id} className="text-xs px-2">
              {type.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-3 space-y-3">
          {operationTypes.map((type) => (
            <TabsContent key={type.id} value={type.id} className="mt-0 space-y-3">
              {videosByCategory[type.id]?.map((video) => (
                <div
                  key={video.id}
                  className="bg-card rounded-xl border border-border overflow-hidden"
                >
                  {/* Thumbnail */}
                  <button 
                    onClick={() => handleOpenVideo(video.youtubeUrl)}
                    className="relative w-full aspect-video"
                  >
                    <img 
                      src={video.thumbnail} 
                      alt={video.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors">
                      <div className="w-14 h-14 bg-red-600 rounded-full flex items-center justify-center">
                        <Play className="w-7 h-7 text-white fill-white ml-1" />
                      </div>
                    </div>
                    <div className="absolute bottom-2 right-2">
                      <Badge variant="secondary" className="bg-black/80 text-white border-0 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {video.duration}
                      </Badge>
                    </div>
                  </button>

                  {/* Content */}
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-medium text-foreground text-sm line-clamp-2">{video.title}</h4>
                      <button
                        onClick={(e) => toggleFavorite(e, video.id)}
                        className={`p-2 rounded-full transition-colors flex-shrink-0 ${
                          favorites.has(video.id)
                            ? 'bg-red-500/20 text-red-500'
                            : 'bg-secondary text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${favorites.has(video.id) ? 'fill-current' : ''}`} />
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{video.summary}</p>
                  </div>

                  {/* Watch Button */}
                  <button
                    onClick={() => handleOpenVideo(video.youtubeUrl)}
                    className="w-full py-2.5 bg-red-600/10 text-red-600 text-sm font-medium flex items-center justify-center gap-2 hover:bg-red-600/20 transition-colors"
                  >
                    <Play className="w-4 h-4" />
                    Watch on YouTube
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </TabsContent>
          ))}
        </div>
      </Tabs>

      {/* Favorites Info */}
      {favorites.size > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 bg-card rounded-xl border border-border">
          <Heart className="w-4 h-4 text-red-500 fill-red-500" />
          <span>{favorites.size} video(s) saved to favorites</span>
        </div>
      )}
    </div>
  );
};

export default LearnSecureLoadsTab;
