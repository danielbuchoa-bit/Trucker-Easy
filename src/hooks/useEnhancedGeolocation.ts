import { useState, useEffect, useCallback, useRef } from 'react';

// === CONFIGURATION ===
const LOCATION_STORAGE_KEY = 'lastKnownPosition';
const MAX_STORED_AGE_MS = 30 * 60 * 1000; // 30 minutes
const QUICK_FIX_TIMEOUT = 3000; // 3 seconds for initial low-accuracy fix
const HIGH_ACCURACY_TIMEOUT = 15000; // 15 seconds for high-accuracy refinement

// Kalman filter constants - tuned for highway driving
const KALMAN_Q = 1.5; // Process noise - lower = smoother position
const KALMAN_R = 5; // Measurement noise - higher = trust GPS less

// Spike rejection - tuned for vehicle speed
const MAX_SPEED_MPS = 55; // ~200 km/h - reject jumps faster than this
const MIN_FIX_INTERVAL_MS = 100; // Minimum time between updates (10fps max)

// Accuracy weighting
const HIGH_ACCURACY_THRESHOLD = 15; // meters

export interface EnhancedPosition {
  lat: number;
  lng: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number;
  source: 'stored' | 'quick' | 'accurate' | 'watch';
  isHighAccuracy: boolean;
}

interface KalmanState {
  lat: number;
  lng: number;
  latVariance: number;
  lngVariance: number;
}

interface UseEnhancedGeolocationOptions {
  enableHighAccuracy?: boolean;
  watchPosition?: boolean;
  maxAge?: number;
}

interface GeolocationResult {
  position: EnhancedPosition | null;
  error: string | null;
  loading: boolean;
  permissionState: 'prompt' | 'granted' | 'denied' | 'unknown';
  requestPermission: () => void;
}

/**
 * Enhanced geolocation hook with:
 * - Progressive boot sequence (lastKnown → quick fix → accurate fix)
 * - Kalman filtering for smooth position
 * - Spike rejection (impossible jumps)
 * - Permission handling
 */
export function useEnhancedGeolocation(
  options: UseEnhancedGeolocationOptions = {}
): GeolocationResult {
  const {
    enableHighAccuracy = true,
    watchPosition = false,
    maxAge = 5000,
  } = options;

  const [position, setPosition] = useState<EnhancedPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'unknown'>('unknown');

  // Kalman filter state
  const kalmanRef = useRef<KalmanState | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const watchIdRef = useRef<number | null>(null);
  const hasAccurateFix = useRef(false);

  // Calculate distance between two points in meters
  const haversineDistance = useCallback((lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, []);

  // Initialize/update Kalman filter with accuracy weighting
  const updateKalman = useCallback((rawLat: number, rawLng: number, accuracy: number): { lat: number; lng: number } => {
    const now = Date.now();
    const dt = (now - lastUpdateRef.current) / 1000; // seconds
    lastUpdateRef.current = now;

    // Weight measurements based on accuracy
    const accuracyWeight = accuracy <= HIGH_ACCURACY_THRESHOLD ? 0.8 : 0.4;

    if (!kalmanRef.current || dt > 10) {
      // Initialize or reset Kalman state
      const initialVariance = accuracy ** 2;
      kalmanRef.current = {
        lat: rawLat,
        lng: rawLng,
        latVariance: initialVariance,
        lngVariance: initialVariance,
      };
      return { lat: rawLat, lng: rawLng };
    }

    // Prediction step - process noise increases with time
    const predictedVariance = kalmanRef.current.latVariance + KALMAN_Q * dt;
    
    // Update step - trust GPS more when accuracy is better
    const measurementVariance = (accuracy ** 2) / accuracyWeight;
    const kalmanGain = predictedVariance / (predictedVariance + KALMAN_R * measurementVariance);
    
    // Clamp kalman gain for stability
    const clampedGain = Math.min(0.8, Math.max(0.1, kalmanGain));
    
    const newLat = kalmanRef.current.lat + clampedGain * (rawLat - kalmanRef.current.lat);
    const newLng = kalmanRef.current.lng + clampedGain * (rawLng - kalmanRef.current.lng);
    const newVariance = (1 - clampedGain) * predictedVariance;

    kalmanRef.current = {
      lat: newLat,
      lng: newLng,
      latVariance: newVariance,
      lngVariance: newVariance,
    };

    return { lat: newLat, lng: newLng };
  }, []);

  // Spike rejection - check if movement is physically possible
  const isValidMove = useCallback((newLat: number, newLng: number): boolean => {
    if (!position) return true;
    
    const timeDelta = (Date.now() - position.timestamp) / 1000;
    if (timeDelta < 0.1) return false; // Too fast, ignore
    
    const distance = haversineDistance(position.lat, position.lng, newLat, newLng);
    const speed = distance / timeDelta;
    
    // Reject if speed exceeds maximum possible (with some margin for GPS jumps)
    if (speed > MAX_SPEED_MPS * 1.5) {
      console.log('[GEO] Spike rejected:', { distance: Math.round(distance), speed: Math.round(speed), timeDelta });
      return false;
    }
    
    return true;
  }, [position, haversineDistance]);

  // Process a new position reading
  const processPosition = useCallback((
    coords: GeolocationCoordinates,
    source: 'quick' | 'accurate' | 'watch'
  ) => {
    const now = Date.now();
    
    // Rate limiting
    if (now - lastUpdateRef.current < MIN_FIX_INTERVAL_MS && source === 'watch') {
      return;
    }

    const rawLat = coords.latitude;
    const rawLng = coords.longitude;
    const accuracy = coords.accuracy ?? 50;

    // Spike rejection
    if (!isValidMove(rawLat, rawLng)) {
      return;
    }

    // Apply Kalman filter
    const filtered = updateKalman(rawLat, rawLng, accuracy);

    const isAccurate = accuracy <= 25;
    if (isAccurate) hasAccurateFix.current = true;

    const newPosition: EnhancedPosition = {
      lat: filtered.lat,
      lng: filtered.lng,
      accuracy,
      heading: coords.heading,
      speed: coords.speed,
      timestamp: now,
      source,
      isHighAccuracy: isAccurate,
    };

    setPosition(newPosition);
    setLoading(false);

    // Store for next boot
    try {
      localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify({
        ...newPosition,
        storedAt: now,
      }));
    } catch (e) {
      // Ignore storage errors
    }
  }, [isValidMove, updateKalman]);

  // Handle position error
  const handleError = useCallback((err: GeolocationPositionError) => {
    console.warn('[GEO] Error:', err.code, err.message);
    
    if (err.code === 1) {
      setPermissionState('denied');
      setError('Location permission denied');
    } else if (err.code === 2) {
      setError('Location unavailable');
    } else {
      setError('Location timeout');
    }
    
    // Don't set loading false if we have a cached position
    if (!position) {
      setLoading(false);
    }
  }, [position]);

  // Check permission state
  useEffect(() => {
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        setPermissionState(result.state as 'prompt' | 'granted' | 'denied');
        result.addEventListener('change', () => {
          setPermissionState(result.state as 'prompt' | 'granted' | 'denied');
        });
      }).catch(() => {
        setPermissionState('unknown');
      });
    }
  }, []);

  // Boot sequence
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setError('Geolocation not supported');
      setLoading(false);
      return;
    }

    // 1. Try to restore last known position immediately
    try {
      const stored = localStorage.getItem(LOCATION_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const age = Date.now() - (parsed.storedAt || 0);
        if (age < MAX_STORED_AGE_MS) {
          setPosition({
            ...parsed,
            source: 'stored',
            timestamp: Date.now(),
          });
          console.log('[GEO] Restored cached position, age:', Math.round(age / 1000), 's');
        }
      }
    } catch (e) {
      // Ignore
    }

    // 2. Get quick fix (low accuracy, fast)
    navigator.geolocation.getCurrentPosition(
      (pos) => processPosition(pos.coords, 'quick'),
      handleError,
      { enableHighAccuracy: false, timeout: QUICK_FIX_TIMEOUT, maximumAge: 60000 }
    );

    // 3. Get accurate fix
    const accurateTimer = setTimeout(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => processPosition(pos.coords, 'accurate'),
        handleError,
        { enableHighAccuracy: true, timeout: HIGH_ACCURACY_TIMEOUT, maximumAge: 0 }
      );
    }, 500); // Slight delay to not block quick fix

    return () => clearTimeout(accurateTimer);
  }, [processPosition, handleError]);

  // Watch position for continuous updates
  useEffect(() => {
    if (!watchPosition || !('geolocation' in navigator)) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => processPosition(pos.coords, 'watch'),
      handleError,
      {
        enableHighAccuracy,
        maximumAge: maxAge,
        timeout: 10000,
      }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [watchPosition, enableHighAccuracy, maxAge, processPosition, handleError]);

  // Request permission callback
  const requestPermission = useCallback(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPermissionState('granted');
          processPosition(pos.coords, 'accurate');
        },
        (err) => {
          if (err.code === 1) setPermissionState('denied');
          handleError(err);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, [processPosition, handleError]);

  return {
    position,
    error,
    loading,
    permissionState,
    requestPermission,
  };
}
