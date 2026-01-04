import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  HereService,
  RouteResponse,
  WeatherAlertsResponse,
  GeocodeResult,
} from '@/services/HereService';
import WeatherAlertsList from '@/components/navigation/WeatherAlertsList';
import RouteMap from '@/components/navigation/RouteMap';
import AddressSearch from '@/components/navigation/AddressSearch';
import ActiveNavigationView from '@/components/navigation/ActiveNavigationView';
import BottomNav from '@/components/navigation/BottomNav';
import { useToast } from '@/hooks/use-toast';
import { useActiveNavigation } from '@/contexts/ActiveNavigationContext';

const NavigationScreen = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isNavigating, startNavigation } = useActiveNavigation();

  // Location state
  const [origin, setOrigin] = useState<GeocodeResult | null>(null);
  const [destination, setDestination] = useState<GeocodeResult | null>(null);
  const [transportMode, setTransportMode] = useState<'truck' | 'car'>('truck');
  const [avoidTolls, setAvoidTolls] = useState(false);
  const [avoidFerries, setAvoidFerries] = useState(false);

  // Results state
  const [route, setRoute] = useState<RouteResponse | null>(null);
  const [weatherAlerts, setWeatherAlerts] = useState<WeatherAlertsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [alertsLoading, setAlertsLoading] = useState(false);

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
            'pt-BR'
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
        (position) => {
          const currentLocation: GeocodeResult = {
            id: 'current-location',
            title: t.navigation?.useMyLocation || 'Current Location',
            address: `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`,
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setOrigin(currentLocation);
          toast({
            title: t.navigation?.locationObtained || 'Location obtained',
            description: currentLocation.address,
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
      startNavigation(route, origin, destination);
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
          <h3 className="font-semibold text-sm">
            {t.navigation?.options || 'Route Options'}
          </h3>

          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2 text-sm">
              <Truck className="w-4 h-4 text-muted-foreground" />
              {t.navigation?.truckMode || 'Truck mode'}
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
                {t.navigation?.mode || 'Mode'}: {route.transportMode}
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
