import { useState, useEffect, useCallback, useRef } from 'react';
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

// Mock speed alerts database - In production, this would come from an API
const MOCK_SPEED_ALERTS: SpeedAlert[] = [
  // Montana - I-90
  { id: 'mt-1', type: 'speed_camera', lat: 45.7833, lng: -108.5007, speedLimitMph: 75, active: true, name: 'I-90 MM 455' },
  { id: 'mt-2', type: 'enforcement_zone', lat: 45.9631, lng: -109.2476, active: true, name: 'Laurel Enforcement' },
  { id: 'mt-3', type: 'construction_zone', lat: 46.0156, lng: -110.4298, speedLimitMph: 55, active: true, name: 'Bozeman Pass Construction' },
  
  // Idaho - I-90/I-84
  { id: 'id-1', type: 'speed_camera', lat: 47.6769, lng: -116.7802, speedLimitMph: 70, active: true, name: 'Coeur d\'Alene Camera' },
  { id: 'id-2', type: 'weigh_station', lat: 47.5412, lng: -116.1234, active: true, name: 'ID Weigh Station I-90' },
  { id: 'id-3', type: 'mobile_patrol', lat: 43.6150, lng: -116.2023, active: true, name: 'Boise Patrol Area' },
  
  // Washington
  { id: 'wa-1', type: 'speed_camera', lat: 47.6062, lng: -122.3321, speedLimitMph: 60, active: true, name: 'Seattle I-5 Camera' },
  { id: 'wa-2', type: 'school_zone', lat: 47.2529, lng: -122.4443, speedLimitMph: 20, active: true, name: 'Tacoma School Zone' },
  
  // Oregon
  { id: 'or-1', type: 'speed_camera', lat: 45.5152, lng: -122.6784, speedLimitMph: 55, active: true, name: 'Portland I-5 Camera' },
  { id: 'or-2', type: 'red_light_camera', lat: 45.5231, lng: -122.6765, active: true, name: 'Portland Red Light' },
  { id: 'or-3', type: 'enforcement_zone', lat: 44.9429, lng: -123.0351, speedLimitMph: 65, active: true, name: 'Salem Enforcement' },
  { id: 'or-4', type: 'average_speed', lat: 44.0521, lng: -123.0868, speedLimitMph: 55, active: true, name: 'Eugene Avg Speed Zone' },
  
  // California
  { id: 'ca-1', type: 'speed_camera', lat: 37.7749, lng: -122.4194, speedLimitMph: 65, active: true, name: 'SF Bay Bridge Camera' },
  { id: 'ca-2', type: 'construction_zone', lat: 34.0522, lng: -118.2437, speedLimitMph: 45, active: true, name: 'LA I-10 Construction' },
];

export function useSpeedAlerts({
  lat,
  lng,
  heading,
  speedMph,
  enabled = true,
}: UseSpeedAlertsProps): UseSpeedAlertsReturn {
  const [alerts, setAlerts] = useState<SpeedAlertWithDistance[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const lastAlertRef = useRef<string | null>(null);

  // Calculate nearby alerts
  useEffect(() => {
    if (!enabled || lat === null || lng === null) {
      setAlerts([]);
      return;
    }

    const maxDistanceMeters = 5000; // 3+ miles

    const nearbyAlerts = MOCK_SPEED_ALERTS
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
  }, [lat, lng, heading, speedMph, enabled, dismissedIds]);

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
    
    // In production, this would send to an API
    console.log('[SPEED_ALERTS] User reported:', type, 'at', lat, lng);
    
    // Add to local alerts temporarily
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
  };
}
