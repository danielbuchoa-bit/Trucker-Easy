import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { Search, Filter, MapPin, Navigation, Route, Building2, Loader2, RefreshCw, AlertCircle, Truck, Fuel, Scale, UtensilsCrossed, TreePine, Info, Star } from 'lucide-react';
import BottomNav from '@/components/navigation/BottomNav';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { getBrandLogo } from '@/lib/truckStopLogos';
import LocationErrorCard from '@/components/location/LocationErrorCard';
import { NextBillionDiagnosticsPanel } from '@/components/diagnostics/NextBillionDiagnosticsPanel';
import { useNextBillionDiagnostics } from '@/hooks/useNextBillionDiagnostics';
import CompleteFacilityReviewModal from '@/components/facility/CompleteFacilityReviewModal';
import MapBackground from '@/components/map/MapBackground';
import { Badge } from '@/components/ui/badge';
import { useBatchPoiRatings } from '@/hooks/useBatchPoiRatings';
import PoiRatingBadgeInline from '@/components/poi/PoiRatingBadgeInline';
import PoiReviewsModal from '@/components/poi/PoiReviewsModal';

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
  truckFriendlyConfidence?: 'confirmed' | 'likely' | 'unknown';
}

// Map filter IDs to API filter types
const FILTER_TYPE_MAP: Record<string, string> = {
  nearMe: 'nearMe',
  truckStops: 'truckStops',
  weighStations: 'weighStations',
  restaurants: 'restaurants',
  restAreas: 'restAreas',
};

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
  const [lastSearchDebug, setLastSearchDebug] = useState<any>(null);
  const [reviewsModalPoi, setReviewsModalPoi] = useState<NearbyPlace | null>(null);
  
  // Batch POI ratings for performance
  const { fetchBatchRatings, getRating, generatePoiKey, clearCache: clearRatingsCache } = useBatchPoiRatings();
  
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
  const lastPlacesFetchRef = useRef<{ lat: number; lng: number; time: number; filter: string } | null>(null);

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


  // Fetch nearby places from NextBillion API with filter-specific query
  const fetchNearbyPlaces = useCallback(async (lat: number, lng: number, filterType: string) => {
    setLoading(true);
    setError(null);

    const startTime = Date.now();
    console.log(`[POI_SEARCH] ========== STARTING SEARCH ==========`);
    console.log(`[POI_SEARCH] Filter: ${filterType}`);
    console.log(`[POI_SEARCH] Location: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    console.log(`[POI_SEARCH] Timestamp: ${new Date().toISOString()}`);

    try {
      // Fetch POIs using NextBillion with filter-specific parameters
      const { data: poisData, error: poisError } = await supabase.functions.invoke(
        'nb_browse_pois',
        {
          body: { 
            lat, 
            lng, 
            radiusMeters: 16000, // Start with 10 miles
            filterType: FILTER_TYPE_MAP[filterType] || 'nearMe',
            progressiveRadius: true, // Enable progressive radius expansion
            limit: 30,
          },
        }
      );

      const elapsed = Date.now() - startTime;

      if (poisError) {
        console.error(`[POI_SEARCH] API Error after ${elapsed}ms:`, poisError);
        
        // Show specific error messages
        if (poisError.message?.includes('429')) {
          setError('Rate limit exceeded. Please wait a moment and try again.');
        } else if (poisError.message?.includes('401') || poisError.message?.includes('403')) {
          setError('API authorization error. Please contact support.');
        } else if (poisError.message?.includes('timeout') || poisError.message?.includes('TIMEOUT')) {
          setError('Request timed out. Check your connection and try again.');
        } else {
          setError(`API Error: ${poisError.message || 'Unknown error'}`);
        }
        throw poisError;
      }

      console.log(`[POI_SEARCH] Response received in ${elapsed}ms`);
      console.log(`[POI_SEARCH] Raw count: ${poisData?.count || 0}`);
      console.log(`[POI_SEARCH] Provider: ${poisData?.provider || 'unknown'}`);
      console.log(`[POI_SEARCH] Radius used: ${poisData?.searchRadius}m (${((poisData?.searchRadius || 0) / 1609.34).toFixed(1)} mi)`);
      console.log(`[POI_SEARCH] Debug:`, JSON.stringify(poisData?.debug, null, 2));

      // Store debug info for diagnostics
      setLastSearchDebug(poisData?.debug);

      // Check if API returned error in response body
      if (poisData?.error) {
        console.warn(`[POI_SEARCH] API returned error in body: ${poisData.error}`);
        if (!poisData?.pois?.length) {
          setError(`Search failed: ${poisData.error}`);
        }
      }

      // Convert POIs to NearbyPlace format
      const poiPlaces: NearbyPlace[] = (poisData?.pois || []).map((poi: any) => ({
        id: poi.id,
        name: poi.title || poi.name,
        type: poi.poiType || 'truckStop',
        distance: formatDistance(poi.distance),
        distanceMeters: poi.distance,
        lat: poi.position?.lat || poi.lat,
        lng: poi.position?.lng || poi.lng,
        address: poi.address?.label,
        rating: poi.rating,
        parking: getRandomParkingStatus(),
        truckFriendlyConfidence: poi.truckFriendlyConfidence,
      }));

      console.log(`[POI_SEARCH] Converted POIs: ${poiPlaces.length}`);

      // For weighStations filter, also fetch from database
      if (filterType === 'weighStations' || filterType === 'nearMe') {
        const { data: weighStations, error: weighError } = await supabase
          .from('weigh_stations')
          .select('*')
          .eq('active', true);

        if (!weighError && weighStations) {
          const weighStationPlaces: NearbyPlace[] = weighStations
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
                status: 'open' as const,
                truckFriendlyConfidence: 'confirmed' as const,
              };
            })
            .filter((ws: NearbyPlace) => ws.distanceMeters <= 80000)
            .sort((a: NearbyPlace, b: NearbyPlace) => a.distanceMeters - b.distanceMeters)
            .slice(0, 5);

          console.log(`[POI_SEARCH] Added ${weighStationPlaces.length} weigh stations from DB`);
          poiPlaces.push(...weighStationPlaces);
        }
      }

      // Sort all places by distance
      const allPlaces = poiPlaces.sort((a, b) => a.distanceMeters - b.distanceMeters);

      console.log(`[POI_SEARCH] ========== FINAL RESULT ==========`);
      console.log(`[POI_SEARCH] Total places: ${allPlaces.length}`);
      console.log(`[POI_SEARCH] Types: ${JSON.stringify(allPlaces.reduce((acc, p) => { acc[p.type] = (acc[p.type] || 0) + 1; return acc; }, {} as Record<string, number>))}`);
      
      setPlaces(allPlaces);
      
      // Clear any previous error if we got results
      if (allPlaces.length > 0) {
        setError(null);
      }
    } catch (err: any) {
      console.error('[POI_SEARCH] ========== ERROR ==========');
      console.error('[POI_SEARCH] Error type:', err?.name || 'Unknown');
      console.error('[POI_SEARCH] Error message:', err?.message || String(err));
      console.error('[POI_SEARCH] Full error:', err);
      
      // Only set generic error if not already set by specific handler above
      if (!error) {
        setError('Could not load nearby places. Please try again.');
      }
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

  // Fetch places when location OR FILTER changes
  useEffect(() => {
    if (userLocation) {
      const now = Date.now();
      const last = lastPlacesFetchRef.current;

      // Re-fetch if filter changed OR enough time/distance passed
      const filterChanged = last?.filter !== activeFilter;
      
      if (!filterChanged && last) {
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
        filter: activeFilter,
      };

      fetchNearbyPlaces(userLocation.lat, userLocation.lng, activeFilter);
    }
  }, [userLocation, activeFilter, fetchNearbyPlaces]);

  // Filter places based on active filter (client-side filtering for nearMe)
  const filteredPlaces = useMemo(() => {
    // For specific filters, places are already filtered server-side
    // For 'nearMe', show all but we can still apply type filter if needed
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

  // Fetch batch ratings when places change
  useEffect(() => {
    if (filteredPlaces.length > 0) {
      // Prepare POI data for batch rating fetch
      const poisForRatings = filteredPlaces.map(p => ({
        id: p.id,
        name: p.name,
        lat: p.lat,
        lng: p.lng,
        type: p.type,
      }));
      fetchBatchRatings(poisForRatings);
    }
  }, [filteredPlaces, fetchBatchRatings]);

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
    // Force refresh by clearing last fetch ref
    lastPlacesFetchRef.current = null;
    getUserLocation();
  };

  const handleFilterChange = (filterId: string) => {
    console.log(`[FILTER] Changing to: ${filterId}`);
    setActiveFilter(filterId);
    // Places will be refetched in useEffect
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
                onClick={() => handleFilterChange(filter.id)}
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

      {/* Map Background with floating elements */}
      <MapBackground userLocation={userLocation} className="h-[40vh]">
        {/* Floating content over map */}
        <div className="flex flex-col h-full justify-end p-4">
          {/* Diagnostics trigger (hidden tappable area) */}
          <button 
            onClick={diagnostics.handleTap}
            className="absolute top-4 left-1/2 -translate-x-1/2 focus:outline-none opacity-0"
            aria-label="Open diagnostics (tap 5 times)"
          >
            <Truck className="w-8 h-8" />
          </button>

          {/* Location info */}
          {userLocation && (
            <div className="absolute top-4 left-4 bg-background/80 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs text-muted-foreground">
              📍 {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
            </div>
          )}

          {/* Action Buttons - Side by Side, Same Size */}
          <div className="flex gap-3 mt-auto">
            <Button 
              onClick={() => navigate('/navigation')}
              className="flex-1 h-12"
            >
              <Route className="w-4 h-4 mr-2" />
              {t.navigation?.calculateRoute || 'Calculate Route'}
            </Button>
            <Button 
              onClick={() => setIsRateModalOpen(true)}
              className="flex-1 h-12 bg-facility-action hover:bg-facility-action/90 text-facility-action-foreground"
            >
              <Star className="w-4 h-4 mr-2" />
              Rate Facility
            </Button>
          </div>

          {/* Floating Refresh Location Button */}
          <button 
            onClick={handleRefresh}
            disabled={loading}
            className="absolute bottom-20 right-4 w-12 h-12 bg-card/90 backdrop-blur-sm border border-border rounded-full shadow-lg flex items-center justify-center text-primary hover:bg-card transition-colors disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Navigation className="w-5 h-5" />
            )}
          </button>
        </div>
      </MapBackground>

      {/* Nearby Places List */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">{filters.find(f => f.id === activeFilter)?.label || t.map.nearMe}</h2>
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
              No locations found
            </p>
            <p className="text-xs text-muted-foreground">
              {activeFilter === 'nearMe' 
                ? 'No POIs within search radius'
                : `No ${filters.find(f => f.id === activeFilter)?.label || 'results'} nearby`}
            </p>
            {lastSearchDebug && (
              <div className="mt-2 p-2 bg-muted/50 rounded text-xs text-muted-foreground text-left">
                <p>🔍 Searched up to {((lastSearchDebug.usedRadius || 0) / 1609.34).toFixed(1)} mi</p>
                <p>🌐 Provider: {lastSearchDebug.provider || 'unknown'}</p>
                {lastSearchDebug.nbRateLimited && (
                  <p className="text-warning">⚠️ NextBillion rate limited, used HERE fallback</p>
                )}
                <p>📍 Radii tried: {(lastSearchDebug.triedRadii || []).map((r: number) => `${(r/1609.34).toFixed(0)}mi`).join(', ')}</p>
              </div>
            )}
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
                      ) : place.type === 'restArea' ? (
                        <TreePine className="w-6 h-6 text-primary" />
                      ) : place.type === 'restaurant' ? (
                        <UtensilsCrossed className="w-6 h-6 text-primary" />
                      ) : place.type === 'weighStation' ? (
                        <Scale className="w-6 h-6 text-primary" />
                      ) : (
                        <MapPin className="w-6 h-6 text-primary" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate">{place.name}</h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-sm text-muted-foreground">{place.distance}</span>
                        {place.truckFriendlyConfidence === 'unknown' && (
                          <Badge variant="outline" className="text-xs py-0 px-1.5 gap-0.5">
                            <Info className="w-3 h-3" />
                            Unverified
                          </Badge>
                        )}
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
                      
                      {/* Rating Badge from batch ratings */}
                      {getRating(place) && (
                        <div className="mt-1">
                          <PoiRatingBadgeInline
                            rating={getRating(place)}
                            onClick={() => setReviewsModalPoi(place)}
                            compact
                          />
                        </div>
                      )}
                    </div>
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

      {/* Complete Facility Review Modal */}
      <CompleteFacilityReviewModal
        isOpen={isRateModalOpen}
        onClose={() => setIsRateModalOpen(false)}
        userLocation={userLocation}
      />

      {/* POI Reviews Modal */}
      {reviewsModalPoi && (
        <PoiReviewsModal
          open={!!reviewsModalPoi}
          onClose={() => setReviewsModalPoi(null)}
          poi={{
            id: reviewsModalPoi.id,
            name: reviewsModalPoi.name,
            lat: reviewsModalPoi.lat,
            lng: reviewsModalPoi.lng,
            address: reviewsModalPoi.address,
            type: reviewsModalPoi.type,
          }}
          summary={getRating(reviewsModalPoi)}
        />
      )}
    </div>
  );
};

export default HomeScreen;
