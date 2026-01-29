/**
 * useNativeNavigation Hook
 * 
 * Provides seamless integration with native iOS navigation.
 * Falls back to web geolocation when native is unavailable.
 * 
 * Features:
 * - Automatic native/web detection
 * - Route polyline sync
 * - Real-time location updates
 * - Reroute handling
 * - Debug logging
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  TruckerNavigation, 
  TruckerLocationUpdate, 
  TruckerNavigationConfig,
  isNativeNavigationAvailable,
  HIGHWAY_CONFIG,
  CITY_CONFIG
} from '@/plugins/TruckerNavigationPlugin';

interface NativeNavigationState {
  // Position (use these in UI)
  latitude: number;
  longitude: number;
  heading: number;
  speed: number; // m/s
  speedMph: number;
  speedKph: number;
  
  // Route status
  isOnRoute: boolean;
  distanceToRoute: number;
  snapOffset: number;
  
  // Metadata
  isNative: boolean;
  updateFrequency: number;
  lastUpdateTime: number;
  
  // Debug
  rawLatitude: number;
  rawLongitude: number;
  rawSpeed: number;
}

interface UseNativeNavigationOptions {
  autoStart?: boolean;
  config?: TruckerNavigationConfig;
  onReroute?: (reason: string) => void;
  onOffRoute?: (distance: number, duration: number) => void;
}

export function useNativeNavigation(options: UseNativeNavigationOptions = {}) {
  const { 
    autoStart = false, 
    config = HIGHWAY_CONFIG,
    onReroute,
    onOffRoute
  } = options;

  const [state, setState] = useState<NativeNavigationState>({
    latitude: 0,
    longitude: 0,
    heading: 0,
    speed: 0,
    speedMph: 0,
    speedKph: 0,
    isOnRoute: true,
    distanceToRoute: 0,
    snapOffset: 0,
    isNative: false,
    updateFrequency: 0,
    lastUpdateTime: 0,
    rawLatitude: 0,
    rawLongitude: 0,
    rawSpeed: 0,
  });

  const [isInitialized, setIsInitialized] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rerouteCount, setRerouteCount] = useState(0);
  
  const listenersRef = useRef<Array<{ remove: () => Promise<void> }>>([]);
  const routePolylineRef = useRef<Array<{ lat: number; lng: number }>>([]);
  const webWatchIdRef = useRef<number | null>(null);

  // Initialize the navigation engine
  const initialize = useCallback(async () => {
    try {
      const result = await TruckerNavigation.initialize(config);
      
      setState(prev => ({
        ...prev,
        isNative: result.source === 'native_ios'
      }));
      
      setIsInitialized(true);
      setError(null);
      
      console.log(`[useNativeNavigation] Initialized: ${result.source}`);
      
      return result.success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize');
      return false;
    }
  }, [config]);

  // Start receiving location updates
  const startUpdates = useCallback(async () => {
    if (!isInitialized) {
      const success = await initialize();
      if (!success) return false;
    }
    
    try {
      // Set up listeners
      const locationListener = await TruckerNavigation.addListener(
        'nativeLocationUpdate',
        (update: TruckerLocationUpdate) => {
          setState(prev => ({
            ...prev,
            latitude: update.latitude,
            longitude: update.longitude,
            heading: update.heading,
            speed: update.speed,
            speedMph: update.speedMph,
            speedKph: update.speedKph,
            isOnRoute: update.isOnRoute,
            distanceToRoute: update.distanceToRouteMeters ?? 0,
            snapOffset: update.snapOffsetMeters ?? 0,
            updateFrequency: update.updateFrequencyHz,
            lastUpdateTime: update.timestamp,
            rawLatitude: update.rawLatitude,
            rawLongitude: update.rawLongitude,
            rawSpeed: update.rawSpeed,
          }));
        }
      );
      listenersRef.current.push(locationListener);
      
      // Off-route listener
      const offRouteListener = await TruckerNavigation.addListener(
        'nativeOffRouteDetected',
        (data) => {
          onOffRoute?.(data.distanceMeters, data.durationSeconds);
        }
      );
      listenersRef.current.push(offRouteListener);
      
      // Reroute listener
      const rerouteListener = await TruckerNavigation.addListener(
        'nativeRerouteRequired',
        (data) => {
          setRerouteCount(prev => prev + 1);
          onReroute?.(data.reason);
        }
      );
      listenersRef.current.push(rerouteListener);
      
      // Start native updates
      await TruckerNavigation.startLocationUpdates();
      
      // If web fallback, also start web geolocation
      if (!isNativeNavigationAvailable()) {
        startWebFallback();
      }
      
      setIsActive(true);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start updates');
      return false;
    }
  }, [isInitialized, initialize, onOffRoute, onReroute]);

  // Stop location updates
  const stopUpdates = useCallback(async () => {
    try {
      await TruckerNavigation.stopLocationUpdates();
      
      // Remove all listeners
      for (const listener of listenersRef.current) {
        await listener.remove();
      }
      listenersRef.current = [];
      
      // Stop web fallback
      if (webWatchIdRef.current !== null) {
        navigator.geolocation.clearWatch(webWatchIdRef.current);
        webWatchIdRef.current = null;
      }
      
      setIsActive(false);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop updates');
      return false;
    }
  }, []);

  // Set route for snap-to-road
  const setRoute = useCallback(async (polyline: Array<{ lat: number; lng: number }>) => {
    routePolylineRef.current = polyline;
    
    try {
      const result = await TruckerNavigation.setRoute({ polyline });
      return result.success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set route');
      return false;
    }
  }, []);

  // Clear route
  const clearRoute = useCallback(async () => {
    routePolylineRef.current = [];
    
    try {
      await TruckerNavigation.clearRoute();
      return true;
    } catch (err) {
      return false;
    }
  }, []);

  // Update configuration
  const updateConfig = useCallback(async (newConfig: TruckerNavigationConfig) => {
    try {
      await TruckerNavigation.updateConfig(newConfig);
      return true;
    } catch (err) {
      return false;
    }
  }, []);

  // Switch to city mode
  const switchToCityMode = useCallback(() => {
    return updateConfig(CITY_CONFIG);
  }, [updateConfig]);

  // Switch to highway mode
  const switchToHighwayMode = useCallback(() => {
    return updateConfig(HIGHWAY_CONFIG);
  }, [updateConfig]);

  // Web fallback geolocation
  const startWebFallback = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      return;
    }
    
    webWatchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, heading, speed } = position.coords;
        
        setState(prev => ({
          ...prev,
          latitude,
          longitude,
          heading: heading ?? prev.heading,
          speed: speed ?? 0,
          speedMph: (speed ?? 0) * 2.23694,
          speedKph: (speed ?? 0) * 3.6,
          lastUpdateTime: position.timestamp,
          rawLatitude: latitude,
          rawLongitude: longitude,
          rawSpeed: speed ?? 0,
        }));
      },
      (err) => {
        console.error('[useNativeNavigation] Web geolocation error:', err);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 5000,
      }
    );
  }, []);

  // Auto-start if requested
  useEffect(() => {
    if (autoStart) {
      startUpdates();
    }
    
    return () => {
      stopUpdates();
    };
  }, [autoStart]); // Only run on mount

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopUpdates();
    };
  }, [stopUpdates]);

  return {
    // State
    ...state,
    isInitialized,
    isActive,
    error,
    rerouteCount,
    
    // Actions
    initialize,
    startUpdates,
    stopUpdates,
    setRoute,
    clearRoute,
    updateConfig,
    switchToCityMode,
    switchToHighwayMode,
    
    // Helpers
    isNativeAvailable: isNativeNavigationAvailable,
  };
}

export default useNativeNavigation;
