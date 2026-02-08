import { useRef, useCallback } from 'react';
import { calculateDistance } from '@/hooks/useGeolocation';

// ========================================
// UNIVERSAL TRUCK STOP DETECTION ENGINE
// Scoring, dynamic radius, dwell fallback
// ========================================

// Search radius for POI queries
export const SEARCH_RADIUS_METERS = 3500;

// Base detection radii
export const DEFAULT_RADIUS_METERS = 700;
export const HIGH_CONFIDENCE_RADIUS = 1200;

// Exit radius (always generous)
export const EXIT_RADIUS_M = 800;

// Stop + dwell fallback
const STOP_SPEED_THRESHOLD_MPS = 1.2; // ~4.3 km/h
const STOP_DWELL_MINUTES = 2.5;
const STOP_DWELL_METERS = 80;

// Anti-spam: don't re-trigger for N minutes
const TRIGGER_COOLDOWN_MINUTES = 20;

// Categories that indicate a truck stop
const TRUCKSTOP_CATEGORIES = [
  'truck_stop', 'travel_center', 'fuel', 'fuel_station',
  'gas_station', 'service_station', 'rest_area', 'parking',
  'diesel', '7850', '7600',
];

// Strong evidence signals (tags/amenities)
const STRONG_TRUCKSTOP_SIGNALS = [
  'diesel', 'truck_parking', 'semi_truck_parking',
  'showers', 'weigh_station', 'scales', 'cat_scale',
  'truck_service', 'repair', 'tire_shop',
];

// Known truck stop brands (bonus scoring)
export const KNOWN_BRANDS = [
  "love's", 'loves', "love's travel", 'loves travel',
  'pilot', 'flying j', 'flyingj', 'pilot flying j',
  'ta ', 'travelcenters', 'travelamerica', 'travel center',
  'petro', 'petro stopping',
  'one9', 'one 9',
  'sapp bros', 'sappbros',
  "buc-ee's", 'bucees', "buc-ees",
  'ambest', 'am best',
  'kenly 95', 'iowa 80', 'road ranger', 'town pump',
  'little america', 'boss truck', "roady's",
  'maverik', 'speedway', 'casey', 'sheetz', 'wawa',
  'quiktrip', 'qt ', 'racetrac',
];

export interface ScoredPoi {
  poi: any;
  score: number;
  confidence: 'high' | 'medium' | 'low' | 'none';
  distanceMeters: number;
  effectiveRadius: number;
}

interface StopDwellState {
  startedAt: number;
  anchorLat: number;
  anchorLng: number;
}

// Detect brand from POI name
export function detectBrandFromName(name: string): string | null {
  const n = name.toLowerCase();
  if (n.includes("love's") || n.includes("loves")) return "Love's";
  if (n.includes("pilot") || n.includes("flying j")) return "Pilot Flying J";
  if (n.includes("ta ") || n.includes("travelcenter") || n.includes("travel center") || n.includes("travelamerica")) return "TA";
  if (n.includes("petro")) return "Petro";
  if (n.includes("sapp bros") || n.includes("sappbros")) return "Sapp Bros";
  if (n.includes("bucee") || n.includes("buc-ee")) return "Buc-ee's";
  if (n.includes("ambest") || n.includes("am best")) return "AmBest";
  if (n.includes("one9") || n.includes("one 9")) return "One9";
  if (n.includes("kenly 95")) return "Kenly 95";
  if (n.includes("iowa 80")) return "Iowa 80";
  if (n.includes("town pump")) return "Town Pump";
  if (n.includes("boss truck")) return "Boss Truck";
  if (n.includes("little america")) return "Little America";
  if (n.includes("maverik")) return "Maverik";
  if (n.includes("sheetz")) return "Sheetz";
  if (n.includes("wawa")) return "Wawa";
  if (n.includes("quiktrip") || n.includes("qt ")) return "QuikTrip";
  if (n.includes("casey")) return "Casey's";
  return null;
}

// Score a POI for truck stop likelihood
export function scoreTruckStopPoi(
  userLat: number,
  userLng: number,
  poi: any
): ScoredPoi {
  const poiLat = poi.position?.lat ?? poi.lat;
  const poiLng = poi.position?.lng ?? poi.lng;
  const distanceMeters = calculateDistance(userLat, userLng, poiLat, poiLng);

  const name = (poi.title || poi.name || '').toLowerCase();
  const categories = (poi.categories || []).map((c: any) =>
    (typeof c === 'string' ? c : c?.id || '').toLowerCase()
  );
  const tags = (poi.tags || poi.amenities || poi.attributes || [])
    .map((t: any) => (typeof t === 'string' ? t : '').toLowerCase());

  const hasCategory = categories.some((c: string) => TRUCKSTOP_CATEGORIES.includes(c));
  const hasStrongSignal = tags.some((t: string) => STRONG_TRUCKSTOP_SIGNALS.includes(t));
  const isBranded = KNOWN_BRANDS.some(b => name.includes(b));

  let score = 0;
  if (hasCategory) score += 5;
  if (hasStrongSignal) score += 6;
  if (isBranded) score += 3;

  // Distance penalty
  if (distanceMeters > 2000) score -= 2;
  if (distanceMeters > 3000) score -= 4;

  const confidence: ScoredPoi['confidence'] =
    hasStrongSignal || (hasCategory && isBranded) ? 'high' :
    hasCategory || isBranded ? 'medium' :
    score > 0 ? 'low' : 'none';

  const effectiveRadius =
    confidence === 'high' ? HIGH_CONFIDENCE_RADIUS : DEFAULT_RADIUS_METERS;

  return { poi, score, confidence, distanceMeters, effectiveRadius };
}

// Hook for stop + dwell detection
export function useDwellDetection() {
  const dwellState = useRef<StopDwellState | null>(null);

  const checkDwell = useCallback((lat: number, lng: number, speedMps?: number | null): boolean => {
    const speed = speedMps ?? 0;
    const isStopped = speed < STOP_SPEED_THRESHOLD_MPS;

    if (!isStopped) {
      dwellState.current = null;
      return false;
    }

    if (!dwellState.current) {
      dwellState.current = { startedAt: Date.now(), anchorLat: lat, anchorLng: lng };
      return false;
    }

    const moved = calculateDistance(lat, lng, dwellState.current.anchorLat, dwellState.current.anchorLng);

    if (moved > STOP_DWELL_METERS) {
      dwellState.current = { startedAt: Date.now(), anchorLat: lat, anchorLng: lng };
      return false;
    }

    const minutes = (Date.now() - dwellState.current.startedAt) / 60000;
    return minutes >= STOP_DWELL_MINUTES;
  }, []);

  const resetDwell = useCallback(() => {
    dwellState.current = null;
  }, []);

  return { checkDwell, resetDwell };
}

// Anti-spam hook
export function useTriggerCooldown() {
  const lastTriggerTime = useRef<number>(0);

  const canTrigger = useCallback((): boolean => {
    const now = Date.now();
    const elapsed = (now - lastTriggerTime.current) / 60000;
    return elapsed >= TRIGGER_COOLDOWN_MINUTES || lastTriggerTime.current === 0;
  }, []);

  const markTriggered = useCallback(() => {
    lastTriggerTime.current = Date.now();
  }, []);

  const reset = useCallback(() => {
    lastTriggerTime.current = 0;
  }, []);

  return { canTrigger, markTriggered, reset };
}
