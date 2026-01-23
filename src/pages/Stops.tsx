import { useState } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { MapPin, Fuel, Scale, Coffee, Bed, Star, ChevronRight } from 'lucide-react';
import BottomNav from '@/components/navigation/BottomNav';
import { useNavigate } from 'react-router-dom';
import EnglishQuickReturn from '@/components/settings/EnglishQuickReturn';

const StopsScreen = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('all');

  const filters = [
    { id: 'all', label: t.map.nearMe },
    { id: 'truckStops', label: t.map.truckStops },
    { id: 'weighStations', label: t.map.weighStations },
    { id: 'restaurants', label: t.map.restaurants },
    { id: 'restAreas', label: t.map.restAreas },
  ];

  const mockStops = [
    {
      id: '1',
      name: 'Pilot Travel Center',
      type: 'truckStops',
      address: '1234 Highway 40, Oklahoma City, OK',
      distance: '0.5 mi',
      parking: 'available',
      rating: 4.2,
      reviews: 128,
      amenities: ['fuel', 'food', 'shower', 'parking'],
    },
    {
      id: '2',
      name: 'Flying J Travel Plaza',
      type: 'truckStops',
      address: '5678 Interstate 35, Dallas, TX',
      distance: '1.2 mi',
      parking: 'limited',
      rating: 4.0,
      reviews: 95,
      amenities: ['fuel', 'food', 'shower'],
    },
    {
      id: '3',
      name: 'Weigh Station I-40 Eastbound',
      type: 'weighStations',
      address: 'Mile Marker 142, I-40 E',
      distance: '3.5 mi',
      status: 'open',
      lastUpdate: '5 min ago',
    },
    {
      id: '4',
      name: "Love's Travel Stop",
      type: 'truckStops',
      address: '9999 Route 66, Amarillo, TX',
      distance: '5.0 mi',
      parking: 'full',
      rating: 4.5,
      reviews: 203,
      amenities: ['fuel', 'food', 'shower', 'parking', 'scales'],
    },
    {
      id: '5',
      name: 'Roadside Rest Area',
      type: 'restAreas',
      address: 'I-40 MM 180',
      distance: '8.2 mi',
      parking: 'available',
      amenities: ['restroom', 'parking'],
    },
  ];

  const filteredStops = activeFilter === 'all' 
    ? mockStops 
    : mockStops.filter(stop => stop.type === activeFilter);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'truckStops': return Fuel;
      case 'weighStations': return Scale;
      case 'restaurants': return Coffee;
      case 'restAreas': return Bed;
      default: return MapPin;
    }
  };

  const getParkingColor = (status?: string) => {
    switch (status) {
      case 'available': return 'bg-parking-available';
      case 'limited': return 'bg-parking-limited';
      case 'full': return 'bg-parking-full';
      default: return 'bg-status-unknown';
    }
  };

  const getParkingLabel = (status?: string) => {
    switch (status) {
      case 'available': return t.place.available;
      case 'limited': return t.place.limited;
      case 'full': return t.place.full;
      default: return t.place.unknown;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border safe-top">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-foreground">{t.nav.stops}</h1>
            <EnglishQuickReturn />
          </div>
          
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
        </div>
      </div>

      {/* Stops List */}
      <div className="p-4 space-y-3">
        {filteredStops.map((stop) => {
          const Icon = getTypeIcon(stop.type);
          
          return (
            <button
              key={stop.id}
              onClick={() => navigate(`/place/${stop.id}`)}
              className="w-full flex items-start gap-4 p-4 bg-card rounded-xl border border-border hover:border-primary/50 transition-all text-left"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon className="w-6 h-6 text-primary" />
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground truncate">{stop.name}</h3>
                <p className="text-sm text-muted-foreground truncate">{stop.address}</p>
                
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-sm text-muted-foreground">{stop.distance}</span>
                  
                  {stop.parking && (
                    <>
                      <span className="text-muted-foreground">•</span>
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${getParkingColor(stop.parking)}`} />
                        <span className="text-sm text-muted-foreground">
                          {getParkingLabel(stop.parking)}
                        </span>
                      </div>
                    </>
                  )}
                  
                  {stop.status && (
                    <>
                      <span className="text-muted-foreground">•</span>
                      <span className={`text-sm ${stop.status === 'open' ? 'text-status-open' : 'text-status-closed'}`}>
                        {stop.status === 'open' ? t.place.weighOpen : t.place.weighClosed}
                      </span>
                    </>
                  )}
                  
                  {stop.rating && (
                    <>
                      <span className="text-muted-foreground">•</span>
                      <div className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 text-primary fill-primary" />
                        <span className="text-sm text-foreground">{stop.rating}</span>
                        <span className="text-sm text-muted-foreground">({stop.reviews})</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-2" />
            </button>
          );
        })}
      </div>

      <BottomNav activeTab="stops" onTabChange={(tab) => navigate(`/${tab === 'map' ? 'home' : tab}`)} />
    </div>
  );
};

export default StopsScreen;
