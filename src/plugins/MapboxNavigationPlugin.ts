/**
 * Mapbox Navigation Plugin Interface
 * 
 * Native plugin for Mapbox Navigation SDK v2 with:
 * - Real GPS snap-to-route (15m threshold)
 * - PT-BR voice guidance
 * - Truck POI layers
 * - Offline route download
 */

import { registerPlugin } from '@capacitor/core';

export interface MapboxPosition {
  latitude: number;
  longitude: number;
  heading: number;
  speed: number;
  accuracy: number;
  roadName: string;
  speedLimit: number;
  matchConfidence: number;
  timestamp: number;
  distanceRemaining: number;
  durationRemaining: number;
}

export interface MapboxManeuver {
  distanceMeters: number;
  type: string;
  direction: string;
  nextRoadName: string;
  instruction: string;
  exitNumber: string;
}

export interface TruckProfile {
  heightMeters: number;
  weightKg: number;
  lengthMeters: number;
  widthMeters: number;
  axleCount: number;
}

export interface NavigationOptions {
  destLat: number;
  destLng: number;
  truckProfile?: TruckProfile;
  avoidTolls?: boolean;
  enableOffline?: boolean;
}

export interface MapboxNavigationPlugin {
  /**
   * Initialize with Mapbox access token
   */
  initialize(options: { accessToken: string }): Promise<{ success: boolean }>;

  /**
   * Start navigation to destination
   */
  startNavigation(options: NavigationOptions): Promise<{
    success: boolean;
    routeId: string;
    distanceMeters: number;
    durationSeconds: number;
  }>;

  /**
   * Stop current navigation
   */
  stopNavigation(): Promise<{ success: boolean }>;

  /**
   * Get current snapped position
   */
  getCurrentPosition(): Promise<MapboxPosition>;

  /**
   * Get upcoming maneuver
   */
  getUpcomingManeuver(): Promise<MapboxManeuver>;

  /**
   * Add position update listener
   */
  addPositionListener(
    callback: (position: MapboxPosition) => void
  ): Promise<{ listenerId: string }>;

  /**
   * Add maneuver update listener
   */
  addManeuverListener(
    callback: (maneuver: MapboxManeuver) => void
  ): Promise<{ listenerId: string }>;

  /**
   * Remove listener
   */
  removePositionListener(options: { listenerId: string }): Promise<void>;

  /**
   * Enable background location updates
   */
  enableBackgroundMode(): Promise<{ success: boolean }>;

  /**
   * Cache route area for offline use
   */
  cacheRouteArea(): Promise<{ success: boolean; cachedMegabytes: number }>;

  /**
   * Request location permission
   */
  requestLocationPermission(): Promise<{ success: boolean }>;
}

// Register plugin
export const MapboxNavigation = registerPlugin<MapboxNavigationPlugin>('MapboxNavigation', {
  web: () => {
    console.warn('[MapboxNavigation] Native plugin not available in web mode');
    return {
      initialize: async () => ({ success: false }),
      startNavigation: async () => ({ success: false, routeId: '', distanceMeters: 0, durationSeconds: 0 }),
      stopNavigation: async () => ({ success: false }),
      getCurrentPosition: async () => ({
        latitude: 0, longitude: 0, heading: 0, speed: 0, accuracy: 0,
        roadName: '', speedLimit: 0, matchConfidence: 0, timestamp: 0,
        distanceRemaining: 0, durationRemaining: 0
      }),
      getUpcomingManeuver: async () => ({
        distanceMeters: 0, type: '', direction: '', nextRoadName: '',
        instruction: '', exitNumber: ''
      }),
      addPositionListener: async () => ({ listenerId: '' }),
      addManeuverListener: async () => ({ listenerId: '' }),
      removePositionListener: async () => {},
      enableBackgroundMode: async () => ({ success: false }),
      cacheRouteArea: async () => ({ success: false, cachedMegabytes: 0 }),
      requestLocationPermission: async () => ({ success: false })
    };
  }
});
