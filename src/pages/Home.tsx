import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { Search, Filter, MapPin, Navigation, Route, Building2, Loader2, RefreshCw, AlertCircle, Truck, Fuel, Scale, UtensilsCrossed, TreePine } from 'lucide-react';
import BottomNav from '@/components/navigation/BottomNav';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { getBrandLogo } from '@/lib/truckStopLogos';
import LocationErrorCard from '@/components/location/LocationErrorCard';
import { NextBillionDiagnosticsPanel } from '@/components/diagnostics/NextBillionDiagnosticsPanel';
import { useNextBillionDiagnostics } from '@/hooks/useNextBillionDiagnostics';
import RateFacilityModal from '@/components/facility/RateFacilityModal';

interface NearbyPlace {
  id: string;
  name: string;
  type: 'truckStop' | 'weighStation' | 'restaurant' | 'restArea';
  distance: string;
  distanceMeters: number;
  parking?: 'available' | 'limited' | 'full';
  status?: 'open' | 'closed';
  rating?: number;
  lat: number;
  lng: number;
  address?: string;
}

const HomeScreen = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('nearMe');
  const [searchQuery, setSearchQuery] = useState('');
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationErrorCode, setLocationErrorCode] = useState<number | undefined>(undefined);
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  
  // Diagnostics panel (5 taps on logo to open)
  const diagnostics = useNextBillionDiagnostics();
  
  const filters = [
    { id: 'nearMe', label: t.map.nearMe, icon: Navigation },
    { id: 'truckStops', label: t.map.truckStops, icon: Fuel },
    { id: 'weighStations', label: t.map.weighStations, icon: Scale },
    { id: 'restaurants', label: t.map.restaurants, icon: UtensilsCrossed },
    { id: 'restAreas', label: t.map.restAreas, icon: TreePine },
  ];

  // Watch ID for continuous location updates
  const watchIdRef = useRef<number | null>(null);

  // Throttle POI refreshes to avoid constant UI flicker
  const lastPlacesFetchRef = useRef<{ lat: number; lng: number; time: number } | null>(null);

  // Get user's current location with watchPosition for continuous updates
  const getUserLocation = useCallback(() => {
    setLocationError(null);
    setLocationErrorCode(undefined);
    setLoading(true);
    
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      setLocationErrorCode(0);
      setLoading(false);
      return;
    }

    // Check if in secure context (HTTPS)
    if (window.isSecureContext === false) {
      console.warn('[Location] Not in secure context, geolocation may fail');
    }

    // Clear existing watch
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    // First get current position quickly
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('[Location] Got initial position:', position.coords.latitude, position.coords.longitude);
        setLocationError(null);
        setLocationErrorCode(undefined);
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (err) => {
        console.error('[Location] getCurrentPosition error:', err.code, err.message);
        handleLocationError(err);
      },
      {
        enableHighAccuracy: false, // Fast first fix
        timeout: 10000,
        maximumAge: 60000,
      }
    );

    // Then start watching for updates (high accuracy)
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        console.log('[Location] Watch update:', position.coords.latitude, position.coords.longitude, 'accuracy:', position.coords.accuracy);
        setLocationError(null);
        setLocationErrorCode(undefined);
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLoading(false);
      },
      (err) => {
        console.error('[Location] watchPosition error:', err.code, err.message);
        handleLocationError(err);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000, // Accept positions up to 5 seconds old
      }
    );

    watchIdRef.current = watchId;
    console.log('[Location] Started watching with ID:', watchId);
  }, []);

  const handleLocationError = (err: GeolocationPositionError) => {
    setLocationErrorCode(err.code);
    switch (err.code) {
      case 1: // PERMISSION_DENIED
        setLocationError('Permissão de localização negada');
        break;
      case 2: // POSITION_UNAVAILABLE
        setLocationError('Localização indisponível');
        break;
      case 3: // TIMEOUT
        setLocationError('Tempo esgotado ao buscar localização');
        break;
      default:
        setLocationError('Erro ao obter localização');
    }
    setLoading(false);
  };

  // Cleanup watch on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        console.log('[Location] Cleared watch on unmount');
      }
    };
  }, []);


  // Fetch nearby places from NextBillion API
  const fetchNearbyPlaces = useCallback(async (lat: number, lng: number) => {
    setLoading(true);
    setError(null);

    try {
      // Fetch truck stops using NextBillion
      const { data: truckStopsData, error: truckStopsError } = await supabase.functions.invoke(
        'nb_browse_pois',
        {
          body: { lat, lng, radius: 32000 }, // 20 miles ≈ 32km
        }
      );

      if (truckStopsError) throw truckStopsError;

      // Fetch weigh stations from database
      const { data: weighStations, error: weighError } = await supabase
        .from('weigh_stations')
        .select('*')
        .eq('active', true);

      if (weighError) throw weighError;

      // Convert truck stops to NearbyPlace format
      const truckStopPlaces: NearbyPlace[] = (truckStopsData?.pois || []).map((poi: any) => ({
        id: poi.id,
        name: poi.title || poi.name,
        type: 'truckStop' as const,
        distance: formatDistance(poi.distance),
        distanceMeters: poi.distance,
        lat: poi.position?.lat || poi.lat,
        lng: poi.position?.lng || poi.lng,
        address: poi.address?.label,
        rating: poi.rating,
        parking: getRandomParkingStatus(), // Would ideally come from real data
      }));

      // Convert weigh stations to NearbyPlace format with distance calculation
      const weighStationPlaces: NearbyPlace[] = (weighStations || [])
        .map((ws: any) => {
          const distance = calculateDistance(lat, lng, ws.lat, ws.lng);
          return {
            id: ws.id,
            name: ws.name,
            type: 'weighStation' as const,
            distance: formatDistance(distance),
            distanceMeters: distance,
            lat: ws.lat,
            lng: ws.lng,
            status: 'open' as const, // Would ideally come from real-time status
          };
        })
        .filter((ws: NearbyPlace) => ws.distanceMeters <= 80000) // Within 50 miles
        .sort((a: NearbyPlace, b: NearbyPlace) => a.distanceMeters - b.distanceMeters)
        .slice(0, 5);

      // Combine and sort by distance
      const allPlaces = [...truckStopPlaces, ...weighStationPlaces].sort(
        (a, b) => a.distanceMeters - b.distanceMeters
      );

      setPlaces(allPlaces);
    } catch (err) {
      console.error('Error fetching places:', err);
      setError('Could not load nearby places. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Calculate distance between two points in meters
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000; // Earth's radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Format distance for display
  const formatDistance = (meters: number): string => {
    const miles = meters / 1609.34;
    return `${miles.toFixed(1)} mi`;
  };

  // Temporary: random parking status (would come from real data)
  const getRandomParkingStatus = (): 'available' | 'limited' | 'full' => {
    const statuses: ('available' | 'limited' | 'full')[] = ['available', 'limited', 'full'];
    return statuses[Math.floor(Math.random() * statuses.length)];
  };

  // Get location on mount
  useEffect(() => {
    getUserLocation();
  }, [getUserLocation]);

  // Fetch places when location is available
  useEffect(() => {
    if (userLocation) {
      const now = Date.now();
      const last = lastPlacesFetchRef.current;

      if (last) {
        const timeDiff = now - last.time;
        const movedMeters = calculateDistance(userLocation.lat, userLocation.lng, last.lat, last.lng);

        // Only refresh if enough time has passed OR user moved a meaningful distance
        if (timeDiff < 20000 && movedMeters < 500) {
          return;
        }
      }

      lastPlacesFetchRef.current = {
        lat: userLocation.lat,
        lng: userLocation.lng,
        time: now,
      };

      fetchNearbyPlaces(userLocation.lat, userLocation.lng);
    }
  }, [userLocation, fetchNearbyPlaces]);

  const filteredPlaces = useMemo(() => {
    const byType = places.filter((place) => {
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
  }, [activeFilter, places, searchQuery]);

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

  const handleRefresh = () => {
    getUserLocation();
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

      {/* Map Placeholder with Diagnostics Trigger */}
      <div className="relative h-[40vh] bg-secondary/30 flex items-center justify-center border-b border-border">
        <div className="text-center">
          {/* Tappable Logo for Diagnostics (5 taps to open) */}
          <button 
            onClick={diagnostics.handleTap}
            className="focus:outline-none"
            aria-label="Open diagnostics (tap 5 times)"
          >
            <Truck className="w-12 h-12 text-primary mx-auto mb-2" />
          </button>
          {userLocation ? (
            <p className="text-muted-foreground text-sm">
              📍 {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">{t.common.loading}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">Map integration coming soon</p>
          
          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 mt-4 justify-center">
            <Button onClick={() => navigate('/navigation')}>
              <Route className="w-4 h-4 mr-2" />
              {t.navigation?.calculateRoute || 'Calculate Route'}
            </Button>
            <Button variant="outline" onClick={() => setIsRateModalOpen(true)}>
              <Building2 className="w-4 h-4 mr-2" />
              Rate Facility
            </Button>
          </div>
        </div>

        {/* Floating Refresh Location Button */}
        <button 
          onClick={handleRefresh}
          disabled={loading}
          className="absolute bottom-4 right-4 w-12 h-12 bg-card border border-border rounded-full shadow-lg flex items-center justify-center text-primary hover:bg-secondary transition-colors disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Navigation className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Nearby Places List */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">{t.map.nearMe}</h2>
          <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Location Error */}
        {locationError && (
          <LocationErrorCard 
            errorCode={locationErrorCode} 
            onRetry={handleRefresh} 
            loading={loading} 
          />
        )}

        {/* Loading State */}
        {loading && !locationError && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Finding nearby stops...</span>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={handleRefresh} className="mt-2">
              Try Again
            </Button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredPlaces.length === 0 && (
          <div className="bg-card border border-border rounded-xl p-6 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
              {activeFilter === 'truckStops' && <Fuel className="w-6 h-6 text-muted-foreground" />}
              {activeFilter === 'weighStations' && <Scale className="w-6 h-6 text-muted-foreground" />}
              {activeFilter === 'restaurants' && <UtensilsCrossed className="w-6 h-6 text-muted-foreground" />}
              {activeFilter === 'restAreas' && <TreePine className="w-6 h-6 text-muted-foreground" />}
              {activeFilter === 'nearMe' && <MapPin className="w-6 h-6 text-muted-foreground" />}
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              No truck-friendly locations found
            </p>
            <p className="text-xs text-muted-foreground">
              {activeFilter === 'nearMe' 
                ? 'No POIs within 10 km of your location'
                : `No ${filters.find(f => f.id === activeFilter)?.label || 'results'} nearby`}
            </p>
            <Button variant="outline" size="sm" onClick={handleRefresh} className="mt-3">
              <RefreshCw className="w-3 h-3 mr-1" />
              Refresh
            </Button>
          </div>
        )}

        {/* Places List */}
        {!loading && !error && filteredPlaces.length > 0 && (
          <div className="space-y-3">
            {filteredPlaces.map((place) => {
              const BrandLogo = getBrandLogo(place.name);
              
              return (
                <div
                  key={place.id}
                  className="w-full flex items-center gap-4 p-4 bg-card rounded-xl border border-border hover:border-primary/50 transition-all"
                >
                  <button
                    onClick={() => {
                      // Save place data to localStorage for the detail page
                      localStorage.setItem(`place_${place.id}`, JSON.stringify(place));
                      navigate(`/place/${place.id}`, { 
                        state: { 
                          place: {
                            id: place.id,
                            name: place.name,
                            type: place.type,
                            lat: place.lat,
                            lng: place.lng,
                            address: place.address,
                            distance: place.distance,
                            rating: place.rating,
                            parking: place.parking,
                          }
                        } 
                      });
                    }}
                    className="flex items-center gap-4 flex-1 min-w-0 text-left"
                  >
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {BrandLogo ? (
                        <BrandLogo className="w-8 h-8" />
                      ) : (
                        <MapPin className="w-6 h-6 text-primary" />
                      )}
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

                  {/* Navigate Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/navigation', {
                        state: {
                          destination: {
                            lat: place.lat,
                            lng: place.lng,
                            name: place.name,
                            address: place.address,
                          },
                          autoStart: true,
                        },
                      });
                    }}
                    className="w-12 h-12 rounded-full bg-primary flex items-center justify-center flex-shrink-0 hover:bg-primary/90 transition-colors"
                    aria-label={`Navigate to ${place.name}`}
                  >
                    <Navigation className="w-5 h-5 text-primary-foreground" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <BottomNav
        activeTab="map"
        onTabChange={(tab) => navigate(`/${tab === 'map' ? 'home' : tab}`)}
      />

      {/* NextBillion Diagnostics Panel (5 taps on truck icon to open) */}
      <NextBillionDiagnosticsPanel 
        isOpen={diagnostics.isOpen} 
        onClose={diagnostics.close} 
      />

      {/* Rate Facility Modal */}
      <RateFacilityModal
        isOpen={isRateModalOpen}
        onClose={() => setIsRateModalOpen(false)}
        userLocation={userLocation}
      />
    </div>
  );
};

export default HomeScreen;
