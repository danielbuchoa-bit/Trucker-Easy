import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useGeolocation, calculateDistance } from '@/hooks/useGeolocation';
import { useBypassSettings } from '@/hooks/useBypassSettings';
import { WeighStation, BypassResult } from '@/types/bypass';
import BypassPromptModal from '@/components/bypass/BypassPromptModal';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/i18n/LanguageContext';
import { useActiveNavigation } from '@/contexts/ActiveNavigationContext';

interface GeofenceContextType {
  nearbyStations: WeighStation[];
  isInsideStation: boolean;
  currentStation: WeighStation | null;
}

const GeofenceContext = createContext<GeofenceContextType | null>(null);

export const useGeofence = () => {
  const context = useContext(GeofenceContext);
  if (!context) {
    throw new Error('useGeofence must be used within a GeofenceProvider');
  }
  return context;
};

interface GeofenceProviderProps {
  children: ReactNode;
}

export const GeofenceProvider = ({ children }: GeofenceProviderProps) => {
  // Use active navigation position if navigating, otherwise fallback to geolocation
  const { userPosition: navPosition, isNavigating } = useActiveNavigation();
  const { latitude: geoLat, longitude: geoLng } = useGeolocation({ watchPosition: true });
  
  // Prefer navigation position when navigating (works with simulation too)
  const latitude = isNavigating && navPosition ? navPosition.lat : geoLat;
  const longitude = isNavigating && navPosition ? navPosition.lng : geoLng;
  const { settings } = useBypassSettings();
  const { toast } = useToast();
  const { t } = useLanguage();
  
  const [nearbyStations, setNearbyStations] = useState<WeighStation[]>([]);
  const [insideStationId, setInsideStationId] = useState<string | null>(null);
  const [currentStation, setCurrentStation] = useState<WeighStation | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [promptStation, setPromptStation] = useState<WeighStation | null>(null);
  const [lastPromptedAt, setLastPromptedAt] = useState<Record<string, number>>({});
  const [stationsCache, setStationsCache] = useState<{ data: WeighStation[]; timestamp: number } | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUserId(session?.user?.id || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch nearby weigh stations with caching (5 min cache)
  const fetchNearbyStations = useCallback(async () => {
    const now = Date.now();
    if (stationsCache && now - stationsCache.timestamp < 5 * 60 * 1000) {
      return stationsCache.data;
    }

    try {
      const { data, error } = await supabase
        .from('weigh_stations')
        .select('*')
        .eq('active', true);

      if (error) throw error;

      const stations = (data || []) as WeighStation[];
      setStationsCache({ data: stations, timestamp: now });
      return stations;
    } catch (error) {
      console.error('Error fetching weigh stations:', error);
      return [];
    }
  }, [stationsCache]);

  // Check anti-duplicate rule
  const canInsertEvent = useCallback(async (stationId: string): Promise<boolean> => {
    if (!userId) return false;

    try {
      const { data, error } = await supabase.rpc('can_insert_bypass_event', {
        p_user_id: userId,
        p_weigh_station_id: stationId
      });

      if (error) throw error;
      return data as boolean;
    } catch (error) {
      console.error('Error checking duplicate:', error);
      return false;
    }
  }, [userId]);

  // Submit bypass event
  const submitBypassEvent = useCallback(async (station: WeighStation, result: BypassResult) => {
    if (!userId || !latitude || !longitude || !settings.saveHistory) {
      setShowPrompt(false);
      return;
    }

    // Check anti-duplicate
    const canInsert = await canInsertEvent(station.id);
    if (!canInsert) {
      toast({
        title: t.bypass.alreadyReported,
        description: t.bypass.waitMinutes,
        variant: 'destructive',
      });
      setShowPrompt(false);
      return;
    }

    try {
      const { error } = await supabase.from('bypass_events').insert({
        user_id: userId,
        weigh_station_id: station.id,
        occurred_at: new Date().toISOString(),
        result,
        lat: latitude,
        lng: longitude,
        source: 'driver_report',
        confidence_score: 40,
      });

      if (error) throw error;

      toast({
        title: t.bypass.thankYou,
        description: t.bypass.reportSaved,
      });
    } catch (error) {
      console.error('Error saving bypass event:', error);
      toast({
        title: t.common.error,
        description: t.bypass.errorSaving,
        variant: 'destructive',
      });
    }

    setShowPrompt(false);
  }, [userId, latitude, longitude, settings.saveHistory, canInsertEvent, toast, t]);

  // Monitor geofence
  useEffect(() => {
    if (!latitude || !longitude || !settings.enableReminder || !userId) return;

    const checkGeofence = async () => {
      const stations = await fetchNearbyStations();
      
      // Filter stations within reasonable distance (50km)
      const nearby = stations.filter(station => {
        const distance = calculateDistance(latitude, longitude, station.lat, station.lng);
        return distance < 50000;
      });
      
      setNearbyStations(nearby);

      // Check if inside any station
      for (const station of nearby) {
        const distance = calculateDistance(latitude, longitude, station.lat, station.lng);
        
        if (distance <= station.radius_m) {
          // Entered a station
          if (!insideStationId) {
            setInsideStationId(station.id);
            setCurrentStation(station);
          }
          return;
        }
      }

      // If we were inside a station and now we're outside
      if (insideStationId) {
        const station = nearby.find(s => s.id === insideStationId);
        if (station) {
          const distance = calculateDistance(latitude, longitude, station.lat, station.lng);
          
          if (distance > station.radius_m) {
            // Check if we already prompted recently (within 10 min)
            const lastPrompted = lastPromptedAt[station.id] || 0;
            const now = Date.now();
            
            if (now - lastPrompted > 10 * 60 * 1000) {
              setPromptStation(station);
              setShowPrompt(true);
              setLastPromptedAt(prev => ({ ...prev, [station.id]: now }));
            }
            
            setInsideStationId(null);
            setCurrentStation(null);
          }
        }
      }
    };

    checkGeofence();
  }, [latitude, longitude, settings.enableReminder, userId, insideStationId, fetchNearbyStations, lastPromptedAt]);

  const handlePromptClose = () => {
    setShowPrompt(false);
    setPromptStation(null);
  };

  const handlePromptSubmit = (result: BypassResult) => {
    if (promptStation) {
      submitBypassEvent(promptStation, result);
    }
    setPromptStation(null);
  };

  return (
    <GeofenceContext.Provider
      value={{
        nearbyStations,
        isInsideStation: !!insideStationId,
        currentStation,
      }}
    >
      {children}
      {showPrompt && promptStation && (
        <BypassPromptModal
          station={promptStation}
          onSubmit={handlePromptSubmit}
          onClose={handlePromptClose}
        />
      )}
    </GeofenceContext.Provider>
  );
};
