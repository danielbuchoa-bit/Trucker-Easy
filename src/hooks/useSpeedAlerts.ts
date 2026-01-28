import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SpeedAlert, SpeedAlertWithDistance, SpeedAlertType, ALERT_TYPE_CONFIG } from '@/types/speedAlerts';

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
  reportAlert: (type: SpeedAlertType) => Promise<boolean>;
  confirmAlert: (id: string) => Promise<void>;
  denyAlert: (id: string) => Promise<void>;
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

  // Speed alerts are now user-reported only (no external API)
  // NextBillion.ai doesn't provide speed trap/camera data
  const fetchExternalAlerts = useCallback(async (_userLat: number, _userLng: number): Promise<SpeedAlert[]> => {
    // External speed alerts API removed - using user-reported alerts only
    return [];
  }, []);

  // Fetch user-reported alerts from database
  const fetchUserAlerts = useCallback(async (userLat: number, userLng: number): Promise<SpeedAlert[]> => {
    try {
      // Fetch alerts within a bounding box (~10 miles)
      const latDelta = 0.15; // ~10 miles
      const lngDelta = 0.15 / Math.cos((userLat * Math.PI) / 180);

      const { data, error } = await supabase
        .from('speed_alerts')
        .select('*')
        .gte('lat', userLat - latDelta)
        .lte('lat', userLat + latDelta)
        .gte('lng', userLng - lngDelta)
        .lte('lng', userLng + lngDelta);

      if (error) {
        console.error('[SPEED_ALERTS] Database error:', error);
        return [];
      }

      console.log('[SPEED_ALERTS] Received', data?.length || 0, 'user-reported alerts');

      return (data || []).map(alert => ({
        id: alert.id,
        type: alert.alert_type as SpeedAlertType,
        lat: alert.lat,
        lng: alert.lng,
        speedLimit: alert.speed_limit ?? undefined,
        active: alert.active,
        reportedAt: alert.created_at,
        confirmations: alert.confirmations,
        denials: alert.denials,
        source: 'user' as const,
      }));
    } catch (err) {
      console.error('[SPEED_ALERTS] User alerts fetch error:', err);
      return [];
    }
  }, []);

  // Calculate nearby alerts with distance/bearing
  useEffect(() => {
    if (!enabled || lat === null || lng === null) {
      setAlerts([]);
      return;
    }

    const processAlerts = async () => {
      setLoading(true);
      
      try {
        // Fetch user-reported alerts from database
        const userAlerts = await fetchUserAlerts(lat, lng);

        // Use only user-reported alerts
        const allAlerts = [...userAlerts];
        
        // Deduplicate by proximity (50m threshold)
        const deduped: SpeedAlert[] = [];
        for (const alert of allAlerts) {
          const isDupe = deduped.some(
            existing => haversineDistance(alert.lat, alert.lng, existing.lat, existing.lng) < 50
          );
          if (!isDupe) {
            deduped.push(alert);
          }
        }

        const maxDistanceMeters = 5000;

        const nearbyAlerts = deduped
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
        setLastFetch(new Date());
      } finally {
        setLoading(false);
      }
    };

    processAlerts();
    
    // Refresh every 30 seconds
    const interval = setInterval(processAlerts, 30000);
    return () => clearInterval(interval);
  }, [lat, lng, heading, speedMph, enabled, dismissedIds, fetchUserAlerts]);

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
  const reportAlert = useCallback(async (type: SpeedAlertType): Promise<boolean> => {
    if (lat === null || lng === null) return false;
    
    console.log('[SPEED_ALERTS] User reporting:', type, 'at', lat, lng);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error('[SPEED_ALERTS] User not authenticated');
        return false;
      }

      const { data, error } = await supabase
        .from('speed_alerts')
        .insert({
          user_id: user.id,
          alert_type: type,
          lat,
          lng,
        })
        .select()
        .single();

      if (error) {
        console.error('[SPEED_ALERTS] Insert error:', error);
        return false;
      }

      console.log('[SPEED_ALERTS] Alert saved:', data.id);

      // Add to local state immediately
      const newAlert: SpeedAlertWithDistance = {
        id: data.id,
        type,
        lat,
        lng,
        active: true,
        reportedAt: data.created_at,
        confirmations: 1,
        denials: 0,
        source: 'user',
        distanceMeters: 0,
        distanceMiles: 0,
        bearing: heading || 0,
        isApproaching: true,
      };
      
      setAlerts(prev => [newAlert, ...prev]);
      return true;
    } catch (err) {
      console.error('[SPEED_ALERTS] Report error:', err);
      return false;
    }
  }, [lat, lng, heading]);

  // Confirm an alert (increases reliability)
  const confirmAlert = useCallback(async (alertId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Insert vote
      const { error: voteError } = await supabase
        .from('speed_alert_votes')
        .insert({
          alert_id: alertId,
          user_id: user.id,
          vote_type: 'confirm',
        });

      if (voteError) {
        if (voteError.code === '23505') {
          console.log('[SPEED_ALERTS] Already voted');
        } else {
          console.error('[SPEED_ALERTS] Vote error:', voteError);
        }
        return;
      }

      // Update confirmations count
      const alert = alerts.find(a => a.id === alertId);
      if (alert) {
        await supabase
          .from('speed_alerts')
          .update({ confirmations: (alert.confirmations || 0) + 1 })
          .eq('id', alertId);
      }

      console.log('[SPEED_ALERTS] Alert confirmed:', alertId);
    } catch (err) {
      console.error('[SPEED_ALERTS] Confirm error:', err);
    }
  }, [alerts]);

  // Deny an alert (decreases reliability)
  const denyAlert = useCallback(async (alertId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Insert vote
      const { error: voteError } = await supabase
        .from('speed_alert_votes')
        .insert({
          alert_id: alertId,
          user_id: user.id,
          vote_type: 'deny',
        });

      if (voteError) {
        if (voteError.code === '23505') {
          console.log('[SPEED_ALERTS] Already voted');
        } else {
          console.error('[SPEED_ALERTS] Vote error:', voteError);
        }
        return;
      }

      // Update denials count and potentially deactivate
      const alert = alerts.find(a => a.id === alertId);
      if (alert) {
        const newDenials = (alert.denials || 0) + 1;
        const shouldDeactivate = newDenials >= 3 && newDenials > (alert.confirmations || 0);
        
        await supabase
          .from('speed_alerts')
          .update({ 
            denials: newDenials,
            active: !shouldDeactivate,
          })
          .eq('id', alertId);
      }

      console.log('[SPEED_ALERTS] Alert denied:', alertId);
      
      // Dismiss locally
      setDismissedIds(prev => new Set([...prev, alertId]));
    } catch (err) {
      console.error('[SPEED_ALERTS] Deny error:', err);
    }
  }, [alerts]);

  // Dismiss an alert locally
  const dismissAlert = useCallback((id: string) => {
    setDismissedIds(prev => new Set([...prev, id]));
  }, []);

  return {
    alerts,
    criticalAlert,
    warningAlerts,
    reportAlert,
    confirmAlert,
    denyAlert,
    dismissAlert,
    dismissedIds,
    loading,
    lastFetch,
  };
}
