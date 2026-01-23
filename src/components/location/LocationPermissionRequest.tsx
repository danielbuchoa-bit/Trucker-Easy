import { useEffect, useState } from 'react';
import { MapPin, Navigation, X, Loader2, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/hooks/useNotifications';
import { useLanguage } from '@/i18n/LanguageContext';

const LocationPermissionRequest = () => {
  const { t } = useLanguage();
  const [showPrompt, setShowPrompt] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'unknown'>('unknown');
  const { requestPermission: requestNotificationPermission } = useNotifications();

  useEffect(() => {
    checkPermission();
  }, []);

  const checkPermission = async () => {
    // Check if geolocation is supported
    if (!('geolocation' in navigator)) {
      console.log('[LocationPermission] Geolocation not supported');
      return;
    }

    // Check if we already have permission info stored
    const hasAsked = localStorage.getItem('location_permission_asked');
    
    // Try to check permission state (not supported in all browsers)
    if ('permissions' in navigator) {
      try {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        setPermissionState(result.state as 'prompt' | 'granted' | 'denied');
        
        // Only show prompt if permission is 'prompt' (not yet decided)
        if (result.state === 'prompt' && !hasAsked) {
          // Small delay to let the app load first
          setTimeout(() => setShowPrompt(true), 1000);
        }
        
        // Listen for permission changes
        result.addEventListener('change', () => {
          setPermissionState(result.state as 'prompt' | 'granted' | 'denied');
          if (result.state !== 'prompt') {
            setShowPrompt(false);
          }
        });
      } catch (e) {
        // permissions.query not supported, show prompt anyway if not asked before
        if (!hasAsked) {
          setTimeout(() => setShowPrompt(true), 1000);
        }
      }
    } else if (!hasAsked) {
      // Fallback: show prompt if never asked
      setTimeout(() => setShowPrompt(true), 1000);
    }
  };

  const requestPermission = () => {
    setRequesting(true);
    localStorage.setItem('location_permission_asked', 'true');
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        console.log('[LocationPermission] Permission granted:', position.coords);
        setPermissionState('granted');
        setShowPrompt(false);
        setRequesting(false);
        
        // Also request notification permission
        await requestNotificationPermission();
        
        // Store position for faster boot next time
        try {
          localStorage.setItem('lastKnownPosition', JSON.stringify({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            storedAt: Date.now(),
          }));
        } catch (e) {}
      },
      (error) => {
        console.warn('[LocationPermission] Permission error:', error.code, error.message);
        if (error.code === 1) {
          setPermissionState('denied');
        }
        setShowPrompt(false);
        setRequesting(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const dismissPrompt = () => {
    localStorage.setItem('location_permission_asked', 'true');
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        {/* Header with icon */}
        <div className="relative bg-gradient-to-br from-primary/20 to-primary/5 p-6 text-center">
          <button
            onClick={dismissPrompt}
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full hover:bg-background/50 transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
          
          <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Navigation className="w-8 h-8 text-primary" />
          </div>
          
          <h2 className="text-xl font-bold text-foreground">{t.location.enableLocation}</h2>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            {t.location.locationPromptDesc}
          </p>

          {/* Benefits list */}
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                <MapPin className="w-4 h-4 text-primary" />
              </div>
              <span className="text-foreground">{t.location.seeNearbyStops}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                <Navigation className="w-4 h-4 text-primary" />
              </div>
              <span className="text-foreground">{t.location.turnByTurnNavigation}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                ⚠️
              </div>
              <span className="text-foreground">{t.location.weighStationAlerts}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                <Bell className="w-4 h-4 text-primary" />
              </div>
              <span className="text-foreground">{t.location.visitedStopReminder}</span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            {t.location.locationPrivacy}
          </p>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-border flex gap-3">
          <Button
            variant="outline"
            onClick={dismissPrompt}
            className="flex-1"
          >
            {t.location.notNow}
          </Button>
          <Button
            onClick={requestPermission}
            disabled={requesting}
            className="flex-1"
          >
            {requesting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Navigation className="w-4 h-4 mr-2" />
            )}
            {t.location.allow}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LocationPermissionRequest;
