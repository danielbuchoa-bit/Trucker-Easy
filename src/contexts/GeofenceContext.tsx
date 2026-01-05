import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useGeolocation, calculateDistance } from '@/hooks/useGeolocation';
import { useBypassSettings } from '@/hooks/useBypassSettings';
import { WeighStation, BypassResult, PendingBypassReport } from '@/types/bypass';
import BypassPromptModal from '@/components/bypass/BypassPromptModal';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/i18n/LanguageContext';
import { useActiveNavigation } from '@/contexts/ActiveNavigationContext';

const PENDING_REPORTS_KEY = 'pending_bypass_reports';
const LAST_PROMPTED_KEY = 'bypass_last_prompted';

// Geofence thresholds - use station's radius_m or defaults
const DEFAULT_ENTER_RADIUS_M = 400;
const EXIT_BUFFER_M = 150; // How far past the radius to trigger prompt
const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours cooldown
const MIN_STAY_TIME_MS = 10000; // Minimum 10 seconds inside to trigger prompt

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

// Load last prompted times from localStorage
const loadLastPrompted = (): Record<string, number> => {
  try {
    const stored = localStorage.getItem(LAST_PROMPTED_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

// Save last prompted times to localStorage
const saveLastPrompted = (data: Record<string, number>) => {
  try {
    localStorage.setItem(LAST_PROMPTED_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save last prompted data:', e);
  }
};

// Load pending reports from localStorage (offline-first)
const loadPendingReports = (): PendingBypassReport[] => {
  try {
    const stored = localStorage.getItem(PENDING_REPORTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

// Save pending reports to localStorage
const savePendingReports = (reports: PendingBypassReport[]) => {
  try {
    localStorage.setItem(PENDING_REPORTS_KEY, JSON.stringify(reports));
  } catch (e) {
    console.error('Failed to save pending reports:', e);
  }
};

export const GeofenceProvider = ({ children }: GeofenceProviderProps) => {
  // Use active navigation position if navigating, otherwise fallback to geolocation
  const { userPosition: navPosition, isNavigating, progress } = useActiveNavigation();
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
  const [userId, setUserId] = useState<string | null>(null);
  
  // Use refs for cached data to avoid re-renders and dependency issues
  const stationsCacheRef = useRef<{ data: WeighStation[]; timestamp: number } | null>(null);
  const lastPromptedRef = useRef<Record<string, number>>(loadLastPrompted());
  const entryTimeRef = useRef<number | null>(null);
  const pendingReportsRef = useRef<PendingBypassReport[]>(loadPendingReports());

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

  // Sync pending reports when online
  useEffect(() => {
    if (!userId) return;

    const syncPendingReports = async () => {
      const pending = pendingReportsRef.current.filter(r => !r.synced);
      if (pending.length === 0) return;

      for (const report of pending) {
        try {
          const { error } = await supabase.from('bypass_events').insert({
            user_id: userId,
            weigh_station_id: report.weigh_station_id,
            occurred_at: report.occurred_at,
            result: report.result,
            lat: report.lat,
            lng: report.lng,
            source: 'driver_report',
            confidence_score: 40,
          });

          if (!error) {
            report.synced = true;
          }
        } catch (e) {
          console.error('Failed to sync report:', e);
        }
      }

      // Remove synced reports
      pendingReportsRef.current = pendingReportsRef.current.filter(r => !r.synced);
      savePendingReports(pendingReportsRef.current);
    };

    // Sync on mount and when online
    syncPendingReports();
    
    window.addEventListener('online', syncPendingReports);
    return () => window.removeEventListener('online', syncPendingReports);
  }, [userId]);

  // Fetch nearby weigh stations with caching (5 min cache)
  const fetchNearbyStations = useCallback(async (): Promise<WeighStation[]> => {
    const now = Date.now();
    const cache = stationsCacheRef.current;
    
    if (cache && now - cache.timestamp < 5 * 60 * 1000) {
      return cache.data;
    }

    try {
      const { data, error } = await supabase
        .from('weigh_stations')
        .select('*')
        .eq('active', true);

      if (error) throw error;

      const stations = (data || []) as WeighStation[];
      stationsCacheRef.current = { data: stations, timestamp: now };
      return stations;
    } catch (error) {
      console.error('Error fetching weigh stations:', error);
      return cache?.data || [];
    }
  }, []);

  // Check if can submit (24h cooldown per station)
  const canPromptForStation = useCallback((stationId: string): boolean => {
    const lastPrompted = lastPromptedRef.current[stationId] || 0;
    return Date.now() - lastPrompted > COOLDOWN_MS;
  }, []);

  // Check if in critical navigation maneuver
  const isInCriticalManeuver = useCallback((): boolean => {
    if (!isNavigating || !progress) return false;
    // Don't prompt if next maneuver is within 300m
    return progress.distanceToNextManeuver !== null && progress.distanceToNextManeuver < 300;
  }, [isNavigating, progress]);

  // Submit bypass event (with offline support)
  const submitBypassEvent = useCallback(async (station: WeighStation, result: BypassResult) => {
    if (!latitude || !longitude) {
      setShowPrompt(false);
      return;
    }

    const report: PendingBypassReport = {
      id: crypto.randomUUID(),
      weigh_station_id: station.id,
      station_name: station.name,
      result,
      lat: latitude,
      lng: longitude,
      occurred_at: new Date().toISOString(),
      synced: false,
    };

    // Save locally first (offline-first)
    pendingReportsRef.current.push(report);
    savePendingReports(pendingReportsRef.current);

    // Try to sync if online and user is logged in
    if (navigator.onLine && userId && settings.saveHistory) {
      try {
        const { error } = await supabase.from('bypass_events').insert({
          user_id: userId,
          weigh_station_id: station.id,
          occurred_at: report.occurred_at,
          result,
          lat: latitude,
          lng: longitude,
          source: 'driver_report',
          confidence_score: 40,
        });

        if (!error) {
          // Mark as synced
          const idx = pendingReportsRef.current.findIndex(r => r.id === report.id);
          if (idx >= 0) {
            pendingReportsRef.current.splice(idx, 1);
            savePendingReports(pendingReportsRef.current);
          }
          
          toast({
            title: t.bypass.thankYou,
            description: t.bypass.reportSaved,
          });
        }
      } catch (error) {
        console.error('Error saving bypass event:', error);
        // Report is already saved locally, will sync later
      }
    } else {
      toast({
        title: t.bypass.thankYou,
        description: t.bypass.reportSaved,
      });
    }

    setShowPrompt(false);
  }, [userId, latitude, longitude, settings.saveHistory, toast, t]);

  // Monitor geofence
  useEffect(() => {
    if (!latitude || !longitude || !settings.enableReminder) return;

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
        const enterRadius = station.radius_m || DEFAULT_ENTER_RADIUS_M;
        
        if (distance <= enterRadius) {
          // Entered a station
          if (!insideStationId) {
            console.log('[GEOFENCE] Entered weigh station:', station.name);
            setInsideStationId(station.id);
            setCurrentStation(station);
            entryTimeRef.current = Date.now();
          }
          return;
        }
      }

      // If we were inside a station and now we're outside
      if (insideStationId) {
        const station = nearby.find(s => s.id === insideStationId);
        if (station) {
          const distance = calculateDistance(latitude, longitude, station.lat, station.lng);
          const exitRadius = (station.radius_m || DEFAULT_ENTER_RADIUS_M) + EXIT_BUFFER_M;
          
          if (distance > exitRadius) {
            console.log('[GEOFENCE] Exited weigh station:', station.name, 'distance:', distance);
            
            // Check minimum stay time
            const stayTime = entryTimeRef.current ? Date.now() - entryTimeRef.current : 0;
            
            // Check cooldown and not in critical maneuver
            if (canPromptForStation(station.id) && stayTime >= MIN_STAY_TIME_MS && !isInCriticalManeuver()) {
              console.log('[GEOFENCE] Showing bypass prompt for:', station.name);
              setPromptStation(station);
              setShowPrompt(true);
              
              // Update last prompted
              lastPromptedRef.current[station.id] = Date.now();
              saveLastPrompted(lastPromptedRef.current);
            }
            
            setInsideStationId(null);
            setCurrentStation(null);
            entryTimeRef.current = null;
          }
        } else {
          // Station no longer in list, reset
          setInsideStationId(null);
          setCurrentStation(null);
          entryTimeRef.current = null;
        }
      }
    };

    checkGeofence();
  }, [latitude, longitude, settings.enableReminder, insideStationId, fetchNearbyStations, canPromptForStation, isInCriticalManeuver]);

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
