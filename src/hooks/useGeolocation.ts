import { useState, useEffect, useCallback } from 'react';

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  error: string | null;
  loading: boolean;
}

interface UseGeolocationOptions {
  enableHighAccuracy?: boolean;
  maximumAge?: number;
  timeout?: number;
  watchPosition?: boolean;
}

export const useGeolocation = (options: UseGeolocationOptions = {}) => {
  const {
    enableHighAccuracy = true,
    maximumAge = 30000,
    timeout = 27000,
    watchPosition = false,
  } = options;

  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    error: null,
    loading: true,
  });

  const handleSuccess = useCallback((position: GeolocationPosition) => {
    setState({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      error: null,
      loading: false,
    });
  }, []);

  const handleError = useCallback((error: GeolocationPositionError) => {
    setState(prev => ({
      ...prev,
      error: error.message,
      loading: false,
    }));
  }, []);

  const requestPosition = useCallback(() => {
    if (!navigator.geolocation) {
      setState(prev => ({
        ...prev,
        error: 'Geolocation is not supported',
        loading: false,
      }));
      return;
    }

    setState(prev => ({ ...prev, loading: true }));
    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
      enableHighAccuracy,
      maximumAge,
      timeout,
    });
  }, [enableHighAccuracy, maximumAge, timeout, handleSuccess, handleError]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setState(prev => ({
        ...prev,
        error: 'Geolocation is not supported',
        loading: false,
      }));
      return;
    }

    if (watchPosition) {
      const watchId = navigator.geolocation.watchPosition(
        handleSuccess,
        handleError,
        { enableHighAccuracy, maximumAge, timeout }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    } else {
      navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
        enableHighAccuracy,
        maximumAge,
        timeout,
      });
    }
  }, [watchPosition, enableHighAccuracy, maximumAge, timeout, handleSuccess, handleError]);

  return { ...state, requestPosition };
};

// Calculate distance between two points in meters (Haversine formula)
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};
