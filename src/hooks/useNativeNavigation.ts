/**
 * useNativeNavigation Hook
 * 
 * Provides access to native HERE Navigation SDK when running in Capacitor.
 * Falls back to web-based navigation when running in browser.
 * 
 * This hook manages the bridge between native map-matched positions
 * and the web-based navigation UI.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { 
  HereNavigation, 
  HerePosition, 
  HereManeuver, 
  TruckProfile,
  NavigationOptions 
} from '@/plugins/HereNavigationPlugin';

export interface NativeNavigationState {
  /** Whether native SDK is available */
  isNativeAvailable: boolean;
  /** Whether navigation is currently active */
  isNavigating: boolean;
  /** Whether SDK is initialized */
  isInitialized: boolean;
  /** Current road-snapped position */
  currentPosition: HerePosition | null;
  /** Upcoming maneuver */
  upcomingManeuver: HereManeuver | null;
  /** Any error that occurred */
  error: string | null;
}

interface UseNativeNavigationReturn extends NativeNavigationState {
  /** Initialize the HERE SDK (call once on app start) */
  initialize: (accessKeyId: string, accessKeySecret: string) => Promise<boolean>;
  /** Start navigation to a destination */
  startNavigation: (
    destination: { lat: number; lng: number },
    truckProfile: TruckProfile,
    options?: Partial<NavigationOptions>
  ) => Promise<boolean>;
  /** Stop current navigation */
  stopNavigation: () => Promise<void>;
  /** Enable background location updates (iOS) */
  enableBackground: () => Promise<boolean>;
  /** Cache offline maps for route */
  cacheOffline: () => Promise<boolean>;
}

export function useNativeNavigation(): UseNativeNavigationReturn {
  const [state, setState] = useState<NativeNavigationState>({
    isNativeAvailable: Capacitor.isNativePlatform(),
    isNavigating: false,
    isInitialized: false,
    currentPosition: null,
    upcomingManeuver: null,
    error: null,
  });

  const positionListenerId = useRef<string | null>(null);
  const maneuverListenerId = useRef<string | null>(null);

  // Check if running in native environment
  useEffect(() => {
    setState(prev => ({
      ...prev,
      isNativeAvailable: Capacitor.isNativePlatform(),
    }));

    if (!Capacitor.isNativePlatform()) {
      console.log('[useNativeNavigation] Running in web mode - native SDK not available');
    }
  }, []);

  // Initialize the HERE SDK
  const initialize = useCallback(async (
    accessKeyId: string, 
    accessKeySecret: string
  ): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, error: null }));
      
      const result = await HereNavigation.initialize({ 
        accessKeyId, 
        accessKeySecret 
      });

      if (result.success) {
        setState(prev => ({ ...prev, isInitialized: true }));
        console.log('[useNativeNavigation] HERE SDK initialized successfully');
        return true;
      }

      setState(prev => ({ 
        ...prev, 
        error: 'Failed to initialize HERE SDK' 
      }));
      return false;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({ ...prev, error: errorMsg }));
      console.error('[useNativeNavigation] Initialization error:', error);
      return false;
    }
  }, []);

  // Start navigation with position and maneuver listeners
  const startNavigation = useCallback(async (
    destination: { lat: number; lng: number },
    truckProfile: TruckProfile,
    options?: Partial<NavigationOptions>
  ): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, error: null }));

      // Start navigation session
      const result = await HereNavigation.startNavigation({
        destination,
        truckProfile,
        avoidTolls: options?.avoidTolls ?? false,
        avoidFerries: options?.avoidFerries ?? false,
        enableOfflineCaching: options?.enableOfflineCaching ?? true,
      });

      if (!result.success) {
        setState(prev => ({ 
          ...prev, 
          error: 'Failed to start navigation' 
        }));
        return false;
      }

      // Add position listener for continuous updates
      positionListenerId.current = await HereNavigation.addPositionListener(
        (position: HerePosition) => {
          setState(prev => ({ ...prev, currentPosition: position }));
        }
      );

      // Add maneuver listener
      maneuverListenerId.current = await HereNavigation.addManeuverListener(
        (maneuver: HereManeuver) => {
          setState(prev => ({ ...prev, upcomingManeuver: maneuver }));
        }
      );

      setState(prev => ({ ...prev, isNavigating: true }));
      console.log('[useNativeNavigation] Navigation started with route:', result.routeId);
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({ ...prev, error: errorMsg }));
      console.error('[useNativeNavigation] Start navigation error:', error);
      return false;
    }
  }, []);

  // Stop navigation and clean up listeners
  const stopNavigation = useCallback(async (): Promise<void> => {
    try {
      // Remove listeners first
      if (positionListenerId.current) {
        await HereNavigation.removePositionListener({ listenerId: positionListenerId.current });
        positionListenerId.current = null;
      }
      if (maneuverListenerId.current) {
        await HereNavigation.removePositionListener({ listenerId: maneuverListenerId.current });
        maneuverListenerId.current = null;
      }

      await HereNavigation.stopNavigation();
      
      setState(prev => ({ 
        ...prev, 
        isNavigating: false,
        currentPosition: null,
        upcomingManeuver: null,
      }));
      
      console.log('[useNativeNavigation] Navigation stopped');
    } catch (error) {
      console.error('[useNativeNavigation] Stop navigation error:', error);
    }
  }, []);

  // Enable background mode (iOS)
  const enableBackground = useCallback(async (): Promise<boolean> => {
    try {
      const result = await HereNavigation.enableBackgroundMode();
      return result.success;
    } catch (error) {
      console.error('[useNativeNavigation] Enable background error:', error);
      return false;
    }
  }, []);

  // Cache offline maps
  const cacheOffline = useCallback(async (): Promise<boolean> => {
    try {
      const result = await HereNavigation.cacheRouteArea();
      if (result.success) {
        console.log(`[useNativeNavigation] Cached ${result.cachedMegabytes}MB for offline use`);
      }
      return result.success;
    } catch (error) {
      console.error('[useNativeNavigation] Cache offline error:', error);
      return false;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (state.isNavigating) {
        stopNavigation();
      }
    };
  }, [state.isNavigating, stopNavigation]);

  return {
    ...state,
    initialize,
    startNavigation,
    stopNavigation,
    enableBackground,
    cacheOffline,
  };
}
