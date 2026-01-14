import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Play, Clock, Heart, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Video {
  id: string;
  title: string;
  duration: string;
  youtubeId: string;
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
      title: 'Master Flatbed Load Securement in 5 Minutes',
      duration: '5:42',
      youtubeId: 'FbrWNrCKymQ',
      summary: 'Evans Trucking shows pro tips for strapping, weight distribution, and damage prevention for flatbed loads.',
    },
    {
      id: 'fb2',
      title: 'Cargo Securement FLATBEDS - Training',
      duration: '25:00',
      youtubeId: '_onyIEFUL-g',
      summary: 'Complete training on flatbed cargo loading and the cargo securement process from J.J. Keller.',
    },
    {
      id: 'fb3',
      title: 'How To Strap Your Freight',
      duration: '12:35',
      youtubeId: 'NuuD5nfTD90',
      summary: 'Step-by-step guide on properly strapping freight on a flatbed trailer.',
    },
    {
      id: 'fb4',
      title: 'Proper Load Securement - DOT Compliance',
      duration: '18:20',
      youtubeId: 'QAgMljU4f2c',
      summary: 'Learn DOT compliance requirements when hauling equipment on flatbed trailers.',
    },
  ],
  dry_van: [
    {
      id: 'dv1',
      title: 'How to Correctly Load a 53\' Dry Van Trailer',
      duration: '15:30',
      youtubeId: 'tAkChO-xHPE',
      summary: 'Complete guide on properly loading a 53-foot dry van trailer with proper weight distribution.',
    },
    {
      id: 'dv2',
      title: 'FMCSA Cargo Securement Requirements',
      duration: '12:45',
      youtubeId: 'GRy5oOnz1xc',
      summary: 'FMCSA regulations and performance requirements for cargo securement explained.',
    },
    {
      id: 'dv3',
      title: 'DOT Cargo Securement Training Video',
      duration: '20:00',
      youtubeId: '_18gkcETqWk',
      summary: 'DOT cargo securement standards covering why improper loading causes accidents.',
    },
    {
      id: 'dv4',
      title: 'How To Secure Loads In 53\' Dry Van',
      duration: '8:15',
      youtubeId: '0zAHtolwQ8s',
      summary: 'Best practices for securing loads in a 53-foot dry van trailer.',
    },
    {
      id: 'dv5',
      title: 'Safely Loading/Unloading a Dry Van Trailer',
      duration: '10:30',
      youtubeId: 'MZC2NeFygJs',
      summary: 'Safe work practices for trucking and warehouse workers when loading dry vans.',
    },
  ],
  car_hauler: [
    {
      id: 'ch1',
      title: 'How to Securely Ratchet Strap a Car on Transport Trailer',
      duration: '8:45',
      youtubeId: 'WJ1XvlxhJl8',
      summary: 'Proper technique for using ratchet straps to secure vehicles on car transport trailers.',
    },
    {
      id: 'ch2',
      title: 'The RIGHT Way To Strap Down Your Car',
      duration: '11:20',
      youtubeId: 'KJOmFqWYB1g',
      summary: 'Correct methods for strapping down vehicles for transport including race cars.',
    },
    {
      id: 'ch3',
      title: 'Ultimate Ratchet Strap Guide - How To Safely Tie Down',
      duration: '14:00',
      youtubeId: 'qnvq8OxISj0',
      summary: 'Complete guide to safely tying down vehicles with ratchet straps.',
    },
    {
      id: 'ch4',
      title: 'How to Properly Load & Tie-Down a Vehicle',
      duration: '16:30',
      youtubeId: '20BGXn8zhkk',
      summary: 'Professional tips for loading and securing hot rods and race cars on trailers.',
    },
    {
      id: 'ch5',
      title: 'How to Operate Ratchet Straps on Auto Transport',
      duration: '5:15',
      youtubeId: 'Cv7U1iG_WGE',
      summary: 'U-Haul official guide for operating ratchet straps on tow dolly and auto transport.',
    },
  ],
  other: [
    {
      id: 'ot1',
      title: 'Flatbed Trucking: Steel Coil Securement',
      duration: '10:20',
      youtubeId: '3FghTt2sFR0',
      summary: 'How to properly secure steel coils on flatbed trailers with chains and binders.',
    },
    {
      id: 'ot2',
      title: 'Tanker Truck Driving - Liquid Surge Safety',
      duration: '15:00',
      youtubeId: 'F2a8dVWe6TY',
      summary: 'Understanding liquid surge, baffles, and safe driving techniques for tanker operators.',
    },
    {
      id: 'ot3',
      title: 'Oversized Load Transport Guide',
      duration: '18:45',
      youtubeId: 'V5jG7F_P1lA',
      summary: 'Permits, escort requirements, and planning for oversize and overweight loads.',
    },
    {
      id: 'ot4',
      title: 'Reefer Trailer Temperature Management',
      duration: '12:30',
      youtubeId: 'Qj2gHDQVmFk',
      summary: 'Managing temperature-sensitive cargo in refrigerated trailers.',
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

  const handleOpenVideo = (youtubeId: string) => {
    window.open(`https://www.youtube.com/watch?v=${youtubeId}`, '_blank');
  };

  const getThumbnail = (youtubeId: string) => {
    return `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`;
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
                    onClick={() => handleOpenVideo(video.youtubeId)}
                    className="relative w-full aspect-video"
                  >
                    <img 
                      src={getThumbnail(video.youtubeId)} 
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
                    onClick={() => handleOpenVideo(video.youtubeId)}
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
