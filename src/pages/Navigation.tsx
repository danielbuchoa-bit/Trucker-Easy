import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Navigation, MapPin, Truck, AlertTriangle, Clock, Route as RouteIcon, Ship, DollarSign } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { HereService, RouteResponse, WeatherAlertsResponse } from '@/services/HereService';
import WeatherAlertsList from '@/components/navigation/WeatherAlertsList';
import RouteMap from '@/components/navigation/RouteMap';
import BottomNav from '@/components/navigation/BottomNav';
import { useToast } from '@/hooks/use-toast';

const NavigationScreen = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Form state
  const [originLat, setOriginLat] = useState('');
  const [originLng, setOriginLng] = useState('');
  const [destLat, setDestLat] = useState('');
  const [destLng, setDestLng] = useState('');
  const [transportMode, setTransportMode] = useState<'truck' | 'car'>('truck');
  const [avoidTolls, setAvoidTolls] = useState(false);
  const [avoidFerries, setAvoidFerries] = useState(false);

  // Results state
  const [route, setRoute] = useState<RouteResponse | null>(null);
  const [weatherAlerts, setWeatherAlerts] = useState<WeatherAlertsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [alertsLoading, setAlertsLoading] = useState(false);

  const handleCalculateRoute = async () => {
    if (!originLat || !originLng || !destLat || !destLng) {
      toast({
        title: t.navigation?.error || 'Error',
        description: t.navigation?.fillAllFields || 'Please fill all coordinate fields',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    setRoute(null);
    setWeatherAlerts(null);

    try {
      const routeResult = await HereService.calculateRoute({
        originLat: parseFloat(originLat),
        originLng: parseFloat(originLng),
        destLat: parseFloat(destLat),
        destLng: parseFloat(destLng),
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
          setWeatherAlerts({ alerts: [], available: false, message: t.navigation?.weatherUnavailable });
        } finally {
          setAlertsLoading(false);
        }
      }
    } catch (error: any) {
      console.error('Route calculation error:', error);
      toast({
        title: t.navigation?.error || 'Error',
        description: error.message || t.navigation?.routeError || 'Failed to calculate route',
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
          setOriginLat(position.coords.latitude.toFixed(6));
          setOriginLng(position.coords.longitude.toFixed(6));
          toast({
            title: t.navigation?.locationObtained || 'Location obtained',
            description: `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`,
          });
        },
        (error) => {
          toast({
            title: t.navigation?.error || 'Error',
            description: t.navigation?.locationError || 'Could not get current location',
            variant: 'destructive',
          });
        }
      );
    }
  };

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
        originLat={originLat ? parseFloat(originLat) : undefined}
        originLng={originLng ? parseFloat(originLng) : undefined}
        destLat={destLat ? parseFloat(destLat) : undefined}
        destLng={destLng ? parseFloat(destLng) : undefined}
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
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder={t.navigation?.latitude || 'Latitude'}
              value={originLat}
              onChange={(e) => setOriginLat(e.target.value)}
              type="number"
              step="any"
            />
            <Input
              placeholder={t.navigation?.longitude || 'Longitude'}
              value={originLng}
              onChange={(e) => setOriginLng(e.target.value)}
              type="number"
              step="any"
            />
          </div>
        </div>

        {/* Destination */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            {t.navigation?.destination || 'Destination'}
          </Label>
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder={t.navigation?.latitude || 'Latitude'}
              value={destLat}
              onChange={(e) => setDestLat(e.target.value)}
              type="number"
              step="any"
            />
            <Input
              placeholder={t.navigation?.longitude || 'Longitude'}
              value={destLng}
              onChange={(e) => setDestLng(e.target.value)}
              type="number"
              step="any"
            />
          </div>
        </div>

        {/* Options */}
        <div className="space-y-4 bg-card border border-border rounded-xl p-4">
          <h3 className="font-semibold text-sm">{t.navigation?.options || 'Route Options'}</h3>
          
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
          disabled={loading}
        >
          {loading ? (
            <span className="animate-pulse">{t.navigation?.calculating || 'Calculating...'}</span>
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
                  <p className="text-xs text-muted-foreground">{t.navigation?.distance || 'Distance'}</p>
                  <p className="font-semibold">{HereService.formatDistance(route.distance)}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t.navigation?.duration || 'Duration'}</p>
                  <p className="font-semibold">{HereService.formatDuration(route.duration)}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Truck className="w-4 h-4" />
              <span>{t.navigation?.mode || 'Mode'}: {route.transportMode}</span>
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

      <BottomNav
        activeTab="stops"
        onTabChange={(tab) => navigate(`/${tab === 'map' ? 'home' : tab}`)}
      />
    </div>
  );
};

export default NavigationScreen;
