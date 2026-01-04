import { useMemo, useState } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { Search, Filter, MapPin, Navigation, Route, Utensils, Building2 } from 'lucide-react';
import BottomNav from '@/components/navigation/BottomNav';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const HomeScreen = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('nearMe');
  const [searchQuery, setSearchQuery] = useState('');

  const filters = [
    { id: 'nearMe', label: t.map.nearMe, icon: Navigation },
    { id: 'truckStops', label: t.map.truckStops },
    { id: 'weighStations', label: t.map.weighStations },
    { id: 'restaurants', label: t.map.restaurants },
    { id: 'restAreas', label: t.map.restAreas },
  ];

  // Mock nearby places
  const mockPlaces = [
    {
      id: '1',
      name: 'Pilot Travel Center',
      type: 'truckStop',
      distance: '0.5 mi',
      parking: 'available',
      rating: 4.2,
      isOpen: true,
    },
    {
      id: '2',
      name: 'Flying J',
      type: 'truckStop',
      distance: '1.2 mi',
      parking: 'limited',
      rating: 4.0,
      isOpen: true,
    },
    {
      id: '3',
      name: 'Weigh Station I-40 E',
      type: 'weighStation',
      distance: '3.5 mi',
      status: 'open',
    },
    {
      id: '4',
      name: "Love's Travel Stop",
      type: 'truckStop',
      distance: '5.0 mi',
      parking: 'full',
      rating: 4.5,
      isOpen: true,
    },
    {
      id: '5',
      name: 'Diner 24/7',
      type: 'restaurant',
      distance: '0.9 mi',
      rating: 4.1,
      isOpen: true,
    },
    {
      id: '6',
      name: 'Roadside Rest Area',
      type: 'restArea',
      distance: '7.8 mi',
      parking: 'available',
      isOpen: true,
    },
  ];

  const filteredPlaces = useMemo(() => {
    const byType = mockPlaces.filter((place) => {
      if (activeFilter === 'nearMe') return true;
      if (activeFilter === 'truckStops') return place.type === 'truckStop';
      if (activeFilter === 'weighStations') return place.type === 'weighStation';
      if (activeFilter === 'restaurants') return place.type === 'restaurant';
      if (activeFilter === 'restAreas') return place.type === 'restArea';
      return true;
    });

    const q = searchQuery.trim().toLowerCase();
    if (!q) return byType;
    return byType.filter((p) => p.name.toLowerCase().includes(q));
  }, [activeFilter, mockPlaces, searchQuery]);

  const getParkingColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-parking-available';
      case 'limited':
        return 'bg-parking-limited';
      case 'full':
        return 'bg-parking-full';
      default:
        return 'bg-status-unknown';
    }
  };

  const getParkingLabel = (status: string) => {
    switch (status) {
      case 'available':
        return t.place.available;
      case 'limited':
        return t.place.limited;
      case 'full':
        return t.place.full;
      default:
        return t.place.unknown;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border safe-top">
        <div className="p-4">
          {/* Search Bar */}
          <div className="relative mb-3">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.map.searchPlaces}
              className="w-full h-12 pl-12 pr-12 bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <button className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg bg-secondary text-foreground">
              <Filter className="w-4 h-4" />
            </button>
          </div>

          {/* Filter Pills */}
          <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
            {filters.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  activeFilter === filter.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card border border-border text-foreground hover:border-primary/50'
                }`}
              >
                {filter.icon && <filter.icon className="w-4 h-4" />}
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Map Placeholder */}
      <div className="relative h-[40vh] bg-secondary/30 flex items-center justify-center border-b border-border">
        <div className="text-center">
          <MapPin className="w-12 h-12 text-primary mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">{t.common.loading}</p>
          <p className="text-xs text-muted-foreground mt-1">Map integration coming soon</p>
          
          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 mt-4 justify-center">
            <Button onClick={() => navigate('/navigation')}>
              <Route className="w-4 h-4 mr-2" />
              {t.navigation?.calculateRoute || 'Calculate Route'}
            </Button>
            <Button variant="outline" onClick={() => navigate('/stop-advisor')}>
              <Utensils className="w-4 h-4 mr-2" />
              Stop Advisor
            </Button>
            <Button variant="outline" onClick={() => navigate('/facility-rating')}>
              <Building2 className="w-4 h-4 mr-2" />
              Rate Facility
            </Button>
          </div>
        </div>

        {/* Floating Current Location Button */}
        <button className="absolute bottom-4 right-4 w-12 h-12 bg-card border border-border rounded-full shadow-lg flex items-center justify-center text-primary hover:bg-secondary transition-colors">
          <Navigation className="w-5 h-5" />
        </button>
      </div>

      {/* Nearby Places List */}
      <div className="p-4">
        <h2 className="text-lg font-semibold mb-3">{t.map.nearMe}</h2>

        {filteredPlaces.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-sm text-muted-foreground">Nenhum resultado para este filtro.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPlaces.map((place) => (
              <button
                key={place.id}
                onClick={() => navigate(`/place/${place.id}`)}
                className="w-full flex items-center gap-4 p-4 bg-card rounded-xl border border-border hover:border-primary/50 transition-all text-left"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-6 h-6 text-primary" />
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground truncate">{place.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-muted-foreground">{place.distance}</span>
                    {place.parking && (
                      <>
                        <span className="text-muted-foreground">•</span>
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${getParkingColor(place.parking)}`} />
                          <span className="text-sm text-muted-foreground">{getParkingLabel(place.parking)}</span>
                        </div>
                      </>
                    )}
                    {place.status && (
                      <>
                        <span className="text-muted-foreground">•</span>
                        <span
                          className={`text-sm ${place.status === 'open' ? 'text-status-open' : 'text-status-closed'}`}
                        >
                          {place.status === 'open' ? t.place.weighOpen : t.place.weighClosed}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {place.rating && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <span className="text-primary">★</span>
                    <span>{place.rating}</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <BottomNav
        activeTab="map"
        onTabChange={(tab) => navigate(`/${tab === 'map' ? 'home' : tab}`)}
      />
    </div>
  );
};

export default HomeScreen;
