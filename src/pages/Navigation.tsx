import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Navigation,
  Truck,
  AlertTriangle,
  Clock,
  Route as RouteIcon,
  Ship,
  DollarSign,
  MapPin,
  Play,
  Settings,
} from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  HereService,
  RouteResponse,
  WeatherAlertsResponse,
  GeocodeResult,
  TruckProfile,
  DEFAULT_TRUCK_PROFILE,
} from '@/services/HereService';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import WeatherAlertsList from '@/components/navigation/WeatherAlertsList';
import RouteMap from '@/components/navigation/RouteMap';
import AddressSearch from '@/components/navigation/AddressSearch';
import ActiveNavigationView from '@/components/navigation/ActiveNavigationView';
import BottomNav from '@/components/navigation/BottomNav';
import { useToast } from '@/hooks/use-toast';
import { useActiveNavigation } from '@/contexts/ActiveNavigationContext';

interface NavigationLocationState {
  destination?: {
    lat: number;
    lng: number;
    name: string;
    address?: string;
  };
  autoStart?: boolean;
}

const NavigationScreen = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { isNavigating, startNavigation } = useActiveNavigation();
  const hasAutoStartedRef = useRef(false);

  // Get passed destination from router state
  const locationState = location.state as NavigationLocationState | null;

  // Location state
  const [origin, setOrigin] = useState<GeocodeResult | null>(null);
  const [destination, setDestination] = useState<GeocodeResult | null>(null);
  const [transportMode, setTransportMode] = useState<'truck' | 'car'>('truck');
  const [avoidTolls, setAvoidTolls] = useState(false);
  const [avoidFerries, setAvoidFerries] = useState(false);

  // Truck profile state
  const [truckProfile, setTruckProfile] = useState<TruckProfile>(DEFAULT_TRUCK_PROFILE);
  const [showTruckSettings, setShowTruckSettings] = useState(false);

  // Results state
  const [route, setRoute] = useState<RouteResponse | null>(null);
  const [weatherAlerts, setWeatherAlerts] = useState<WeatherAlertsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [alertsLoading, setAlertsLoading] = useState(false);

  // Reverse geocode to get address from coordinates
  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      const { data, error } = await supabase.functions.invoke('here_reverse_geocode', {
        body: { lat, lng }
      });
      if (error || !data?.address) {
        return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      }
      return data.address;
    } catch {
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
  };

  // Handle destination passed via router state
  useEffect(() => {
    if (locationState?.destination && !hasAutoStartedRef.current) {
      const passedDest = locationState.destination;
      const destResult: GeocodeResult = {
        id: `poi-${passedDest.lat}-${passedDest.lng}`,
        title: passedDest.name,
        address: passedDest.address || `${passedDest.lat.toFixed(4)}, ${passedDest.lng.toFixed(4)}`,
        lat: passedDest.lat,
        lng: passedDest.lng,
      };
      setDestination(destResult);

      // Fetch real address for destination if only coordinates
      if (!passedDest.address) {
        reverseGeocode(passedDest.lat, passedDest.lng).then(address => {
          setDestination(prev => prev ? { ...prev, address } : prev);
        });
      }

      // Auto-get current location as origin if autoStart
      if (locationState.autoStart && navigator.geolocation) {
        hasAutoStartedRef.current = true;
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            const address = await reverseGeocode(latitude, longitude);
            const currentLocation: GeocodeResult = {
              id: 'current-location',
              title: t.navigation?.useMyLocation || 'Use my location',
              address,
              lat: latitude,
              lng: longitude,
            };
            setOrigin(currentLocation);
          },
          () => {
            toast({
              title: t.navigation?.error || 'Error',
              description: t.navigation?.locationError || 'Could not get current location',
              variant: 'destructive',
            });
          }
        );
      }
    }
  }, [locationState, t, toast]);

  // Auto-calculate route when origin and destination are set from POI navigation
  useEffect(() => {
    if (origin && destination && locationState?.autoStart && !route && !loading) {
      handleCalculateRoute();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, destination]);

  const handleCalculateRoute = async () => {
    if (!origin || !destination) {
      toast({
        title: t.navigation?.error || 'Error',
        description: t.navigation?.fillAllFields || 'Please enter origin and destination',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    setRoute(null);
    setWeatherAlerts(null);

    try {
      const routeResult = await HereService.calculateRoute({
        originLat: origin.lat,
        originLng: origin.lng,
        destLat: destination.lat,
        destLng: destination.lng,
        transportMode,
        avoidTolls,
        avoidFerries,
        truckProfile: transportMode === 'truck' ? truckProfile : undefined,
      });

      setRoute(routeResult);

      toast({
        title: t.navigation?.routeCalculated || 'Route calculated!',
        description: `${HereService.formatDistance(routeResult.distance)} • ${HereService.formatDuration(routeResult.duration)}`,
      });

      // Fetch weather alerts
      if (routeResult.polyline) {
        setAlertsLoading(true);
        try {
          const alerts = await HereService.getWeatherAlertsAlongRoute(
            routeResult.polyline,
            'en-US'
          );
          setWeatherAlerts(alerts);
        } catch (alertError) {
          console.error('Weather alerts error:', alertError);
          setWeatherAlerts({
            alerts: [],
            available: false,
            message: t.navigation?.weatherUnavailable,
          });
        } finally {
          setAlertsLoading(false);
        }
      }
    } catch (error: any) {
      console.error('Route calculation error:', error);
      toast({
        title: t.navigation?.error || 'Error',
        description:
          error.message || t.navigation?.routeError || 'Failed to calculate route',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUseCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          const address = await reverseGeocode(latitude, longitude);
          const currentLocation: GeocodeResult = {
            id: 'current-location',
            title: t.navigation?.useMyLocation || 'Use my location',
            address,
            lat: latitude,
            lng: longitude,
          };
          setOrigin(currentLocation);
          toast({
            title: t.navigation?.locationObtained || 'Location obtained',
            description: address,
          });
        },
        () => {
          toast({
            title: t.navigation?.error || 'Error',
            description:
              t.navigation?.locationError || 'Could not get current location',
            variant: 'destructive',
          });
        }
      );
    }
  };

  const handleStartNavigation = () => {
    if (route && origin && destination) {
      startNavigation(route, origin, destination, transportMode === 'truck' ? truckProfile : undefined);
    }
  };

  // If navigation is active, show the active navigation view
  if (isNavigating) {
    return <ActiveNavigationView />;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border safe-top">
        <div className="flex items-center gap-4 p-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-foreground">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">{t.navigation?.title || 'Route Navigation'}</h1>
        </div>
      </div>

      {/* Map */}
      <RouteMap
        className="h-[35vh]"
        routePolyline={route?.polyline}
        originLat={origin?.lat}
        originLng={origin?.lng}
        destLat={destination?.lat}
        destLng={destination?.lng}
      />

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Origin */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              {t.navigation?.origin || 'Origin'}
            </Label>
            <Button variant="ghost" size="sm" onClick={handleUseCurrentLocation}>
              <Navigation className="w-4 h-4 mr-1" />
              {t.navigation?.useMyLocation || 'Use my location'}
            </Button>
          </div>

          {origin ? (
            <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg">
              <MapPin className="w-4 h-4 text-green-500 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{origin.title}</p>
                <p className="text-xs text-muted-foreground truncate">{origin.address}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setOrigin(null)}>
                ✕
              </Button>
            </div>
          ) : (
            <AddressSearch
              placeholder={t.navigation?.searchAddress || 'Search address...'}
              onSelect={setOrigin}
            />
          )}
        </div>

        {/* Destination */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            {t.navigation?.destination || 'Destination'}
          </Label>

          {destination ? (
            <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg">
              <MapPin className="w-4 h-4 text-red-500 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{destination.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {destination.address}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setDestination(null)}>
                ✕
              </Button>
            </div>
          ) : (
            <AddressSearch
              placeholder={t.navigation?.searchAddress || 'Search address...'}
              onSelect={setDestination}
            />
          )}
        </div>

        {/* Options */}
        <div className="space-y-4 bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">
              {t.navigation?.options || 'Route Options'}
            </h3>
            {transportMode === 'truck' && (
              <Sheet open={showTruckSettings} onOpenChange={setShowTruckSettings}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Settings className="w-4 h-4 mr-1" />
                    Truck Settings
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>🚛 Truck Profile (53' Trailer)</SheetTitle>
                  </SheetHeader>
                  <div className="mt-6 space-y-6">
                    <div className="space-y-2">
                      <Label>Trailer Length (ft)</Label>
                      <Input
                        type="number"
                        value={truckProfile.trailerLengthFt}
                        onChange={(e) => setTruckProfile(prev => ({
                          ...prev,
                          trailerLengthFt: parseFloat(e.target.value) || 53,
                        }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Height (ft)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={truckProfile.heightFt}
                        onChange={(e) => setTruckProfile(prev => ({
                          ...prev,
                          heightFt: parseFloat(e.target.value) || 13.6,
                        }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Gross Weight (lbs)</Label>
                      <Input
                        type="number"
                        value={truckProfile.weightLbs}
                        onChange={(e) => setTruckProfile(prev => ({
                          ...prev,
                          weightLbs: parseFloat(e.target.value) || 80000,
                        }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Axles</Label>
                      <Input
                        type="number"
                        value={truckProfile.axles}
                        onChange={(e) => setTruckProfile(prev => ({
                          ...prev,
                          axles: parseInt(e.target.value) || 5,
                        }))}
                      />
                    </div>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setTruckProfile(DEFAULT_TRUCK_PROFILE)}
                    >
                      Reset to Default
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            )}
          </div>

          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2 text-sm">
              <Truck className="w-4 h-4 text-muted-foreground" />
              {t.navigation?.truckMode || 'Truck mode (53\' trailer)'}
            </Label>
            <Switch
              checked={transportMode === 'truck'}
              onCheckedChange={(checked) => setTransportMode(checked ? 'truck' : 'car')}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2 text-sm">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              {t.navigation?.avoidTolls || 'Avoid tolls'}
            </Label>
            <Switch checked={avoidTolls} onCheckedChange={setAvoidTolls} />
          </div>

          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2 text-sm">
              <Ship className="w-4 h-4 text-muted-foreground" />
              {t.navigation?.avoidFerries || 'Avoid ferries'}
            </Label>
            <Switch checked={avoidFerries} onCheckedChange={setAvoidFerries} />
          </div>
        </div>

        {/* Calculate Button */}
        <Button
          className="w-full h-12"
          onClick={handleCalculateRoute}
          disabled={loading || !origin || !destination}
        >
          {loading ? (
            <span className="animate-pulse">
              {t.navigation?.calculating || 'Calculating...'}
            </span>
          ) : (
            <>
              <RouteIcon className="w-5 h-5 mr-2" />
              {t.navigation?.calculateRoute || 'Calculate Route'}
            </>
          )}
        </Button>

        {/* Route Result */}
        {route && (
          <div className="bg-card border border-border rounded-xl p-4 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <RouteIcon className="w-5 h-5 text-primary" />
              {t.navigation?.routeInfo || 'Route Information'}
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t.navigation?.distance || 'Distance'}
                  </p>
                  <p className="font-semibold">
                    {HereService.formatDistance(route.distance)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t.navigation?.duration || 'Duration'}
                  </p>
                  <p className="font-semibold">
                    {HereService.formatDuration(route.duration)}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Truck className="w-4 h-4" />
              <span>
                {route.transportMode === 'truck' 
                  ? `Truck (${truckProfile.trailerLengthFt}' trailer)`
                  : 'Car'}
              </span>
            </div>
          </div>
        )}

        {/* Weather Alerts */}
        {(route || alertsLoading) && (
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              {t.navigation?.weatherAlerts || 'Weather Alerts'}
            </h3>
            <WeatherAlertsList
              alerts={weatherAlerts?.alerts || []}
              available={weatherAlerts?.available ?? true}
              message={weatherAlerts?.message}
              loading={alertsLoading}
            />
          </div>
        )}
      </div>

      {/* Start Navigation Button - Fixed at bottom */}
      {route && origin && destination && (
        <div className="fixed bottom-20 inset-x-0 px-4 pb-4 z-30 safe-bottom">
          <Button
            className="w-full h-14 text-lg font-bold shadow-xl"
            onClick={handleStartNavigation}
          >
            <Play className="w-6 h-6 mr-2" />
            {t.navigation?.startNavigation || 'Start Navigation'}
          </Button>
        </div>
      )}

      <BottomNav
        activeTab="stops"
        onTabChange={(tab) => navigate(`/${tab === 'map' ? 'home' : tab}`)}
      />
    </div>
  );
};

export default NavigationScreen;
