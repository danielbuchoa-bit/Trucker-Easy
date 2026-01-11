import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SpeedAlert, SpeedAlertWithDistance, ALERT_TYPE_CONFIG } from '@/types/speedAlerts';

interface UseSpeedAlertsProps {
  lat: number | null;
  lng: number | null;
  heading: number | null;
  speedMph: number;
  enabled?: boolean;
}

interface UseSpeedAlertsReturn {
  alerts: SpeedAlertWithDistance[];
  criticalAlert: SpeedAlertWithDistance | null;
  warningAlerts: SpeedAlertWithDistance[];
  reportAlert: (type: SpeedAlert['type']) => void;
  dismissAlert: (id: string) => void;
  dismissedIds: Set<string>;
  loading: boolean;
  lastFetch: Date | null;
}

// Calculate distance between two points in meters
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + 
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Calculate bearing between two points
function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const dLng = toRad(lng2 - lng1);
  const lat1Rad = toRad(lat1);
  const lat2Rad = toRad(lat2);
  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
  return ((toDeg(Math.atan2(y, x)) % 360) + 360) % 360;
}

// Check if alert is within heading cone
function isWithinCone(alertBearing: number, heading: number, coneAngle = 45): boolean {
  let diff = Math.abs(alertBearing - heading);
  if (diff > 180) diff = 360 - diff;
  return diff <= coneAngle;
}

// Cache for API responses
interface CacheEntry {
  alerts: SpeedAlert[];
  timestamp: number;
}

const alertsCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60000; // 1 minute cache
const FETCH_THROTTLE_MS = 30000; // Fetch every 30 seconds max
const MIN_DISTANCE_FOR_REFETCH = 1000; // 1km movement triggers refetch

function getCacheKey(lat: number, lng: number): string {
  // Round to ~1km precision for cache key
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

export function useSpeedAlerts({
  lat,
  lng,
  heading,
  speedMph,
  enabled = true,
}: UseSpeedAlertsProps): UseSpeedAlertsReturn {
  const [alerts, setAlerts] = useState<SpeedAlertWithDistance[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  
  const lastFetchRef = useRef<{ lat: number; lng: number; time: number } | null>(null);
  const lastAlertRef = useRef<string | null>(null);

  // Fetch alerts from API
  const fetchAlerts = useCallback(async (userLat: number, userLng: number) => {
    // Check cache first
    const cacheKey = getCacheKey(userLat, userLng);
    const cached = alertsCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      console.log('[SPEED_ALERTS] Using cached data');
      return cached.alerts;
    }

    // Check throttle
    if (lastFetchRef.current) {
      const timeSinceLastFetch = Date.now() - lastFetchRef.current.time;
      const distanceMoved = haversineDistance(
        userLat, userLng,
        lastFetchRef.current.lat, lastFetchRef.current.lng
      );
      
      if (timeSinceLastFetch < FETCH_THROTTLE_MS && distanceMoved < MIN_DISTANCE_FOR_REFETCH) {
        console.log('[SPEED_ALERTS] Throttled, using existing data');
        return null; // Use existing state
      }
    }

    setLoading(true);
    
    try {
      console.log('[SPEED_ALERTS] Fetching from API...');
      
      const { data, error } = await supabase.functions.invoke('here_speed_alerts', {
        body: {
          lat: userLat,
          lng: userLng,
          radiusMeters: 16000, // 10 miles
        },
      });

      if (error) {
        console.error('[SPEED_ALERTS] API error:', error);
        return null;
      }

      if (data?.ok && data.alerts) {
        console.log('[SPEED_ALERTS] Received', data.alerts.length, 'alerts from API');
        
        // Cache the results
        alertsCache.set(cacheKey, {
          alerts: data.alerts,
          timestamp: Date.now(),
        });
        
        lastFetchRef.current = { lat: userLat, lng: userLng, time: Date.now() };
        setLastFetch(new Date());
        
        return data.alerts as SpeedAlert[];
      }
      
      return null;
    } catch (err) {
      console.error('[SPEED_ALERTS] Fetch error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Calculate nearby alerts with distance/bearing
  useEffect(() => {
    if (!enabled || lat === null || lng === null) {
      setAlerts([]);
      return;
    }

    const processAlerts = async () => {
      // Fetch new alerts (will use cache if available)
      const apiAlerts = await fetchAlerts(lat, lng);
      
      // Get alerts to process (either new or from existing state via cache)
      const alertsToProcess = apiAlerts || alertsCache.get(getCacheKey(lat, lng))?.alerts || [];
      
      const maxDistanceMeters = 5000; // Show alerts within 3+ miles

      const nearbyAlerts = alertsToProcess
        .filter(alert => alert.active && !dismissedIds.has(alert.id))
        .map(alert => {
          const distanceMeters = haversineDistance(lat, lng, alert.lat, alert.lng);
          const bearing = calculateBearing(lat, lng, alert.lat, alert.lng);
          const isApproaching = heading !== null ? isWithinCone(bearing, heading) : true;
          const eta = speedMph > 0 ? (distanceMeters / 1609.34) / speedMph * 3600 : undefined;

          return {
            ...alert,
            distanceMeters,
            distanceMiles: distanceMeters / 1609.34,
            bearing,
            isApproaching,
            eta,
          };
        })
        .filter(alert => alert.distanceMeters <= maxDistanceMeters && alert.isApproaching)
        .sort((a, b) => a.distanceMeters - b.distanceMeters);

      setAlerts(nearbyAlerts);
    };

    processAlerts();
  }, [lat, lng, heading, speedMph, enabled, dismissedIds, fetchAlerts]);

  // Get critical alert (closest within critical distance)
  const criticalAlert = alerts.find(alert => {
    const config = ALERT_TYPE_CONFIG[alert.type];
    return alert.distanceMeters <= config.criticalDistanceMeters;
  }) || null;

  // Get warning alerts (within warning distance but not critical)
  const warningAlerts = alerts.filter(alert => {
    const config = ALERT_TYPE_CONFIG[alert.type];
    return alert.distanceMeters <= config.warningDistanceMeters &&
           alert.distanceMeters > config.criticalDistanceMeters;
  });

  // Report a new alert at current location
  const reportAlert = useCallback((type: SpeedAlert['type']) => {
    if (lat === null || lng === null) return;
    
    console.log('[SPEED_ALERTS] User reported:', type, 'at', lat, lng);
    
    // In production, this would send to an API
    // For now, add to local alerts temporarily
    const newAlert: SpeedAlertWithDistance = {
      id: `user-${Date.now()}`,
      type,
      lat,
      lng,
      active: true,
      reportedAt: new Date().toISOString(),
      distanceMeters: 0,
      distanceMiles: 0,
      bearing: heading || 0,
      isApproaching: true,
    };
    
    setAlerts(prev => [newAlert, ...prev]);
    
    // Optionally save to database for other users
    // This would be implemented with a separate edge function
  }, [lat, lng, heading]);

  // Dismiss an alert
  const dismissAlert = useCallback((id: string) => {
    setDismissedIds(prev => new Set([...prev, id]));
  }, []);

  return {
    alerts,
    criticalAlert,
    warningAlerts,
    reportAlert,
    dismissAlert,
    dismissedIds,
    loading,
    lastFetch,
  };
}
