/**
 * HERE Navigation SDK Plugin Interface
 * 
 * This plugin bridges the native HERE Navigation SDK with the web layer.
 * It provides continuous map matching and road-snapped positioning.
 * 
 * IMPORTANT: This file defines the TypeScript interface for the native plugin.
 * The actual native implementation must be added in:
 * - ios/App/App/Plugins/HereNavigationPlugin.swift
 * - android/app/src/main/java/com/truckerpath/plugins/HereNavigationPlugin.java
 */

import { registerPlugin } from '@capacitor/core';

export interface HerePosition {
  /** Latitude snapped to road geometry */
  latitude: number;
  /** Longitude snapped to road geometry */
  longitude: number;
  /** Heading/bearing in degrees (0-360) */
  heading: number;
  /** Speed in m/s */
  speed: number;
  /** Road name if available */
  roadName?: string;
  /** Speed limit in km/h if available */
  speedLimit?: number;
  /** Whether position is on a ramp */
  isOnRamp?: boolean;
  /** Whether position is on service road */
  isServiceRoad?: boolean;
  /** Lane guidance info */
  laneGuidance?: {
    totalLanes: number;
    recommendedLanes: number[];
    currentLane?: number;
  };
  /** Confidence of map matching (0-1) */
  matchConfidence: number;
  /** Timestamp of position update */
  timestamp: number;
}

export interface HereManeuver {
  /** Distance to maneuver in meters */
  distanceMeters: number;
  /** Maneuver type (turn-left, turn-right, exit-left, etc.) */
  type: string;
  /** Road name after maneuver */
  nextRoadName?: string;
  /** Exit number if applicable */
  exitNumber?: string;
  /** Signpost text */
  signpostText?: string;
  /** Junction name */
  junctionName?: string;
}

export interface TruckProfile {
  /** Height in meters */
  heightMeters: number;
  /** Weight in kg */
  weightKg: number;
  /** Length in meters */
  lengthMeters: number;
  /** Width in meters */
  widthMeters: number;
  /** Number of axles */
  axleCount: number;
  /** Number of trailers */
  trailerCount: number;
  /** Whether carrying hazmat */
  hazmatEnabled: boolean;
}

export interface NavigationOptions {
  /** Destination coordinates */
  destination: { lat: number; lng: number };
  /** Truck profile for restrictions */
  truckProfile: TruckProfile;
  /** Whether to avoid tolls */
  avoidTolls?: boolean;
  /** Whether to avoid ferries */
  avoidFerries?: boolean;
  /** Whether to enable offline caching (10km corridor) */
  enableOfflineCaching?: boolean;
}

export interface HereNavigationPlugin {
  /**
   * Initialize the HERE SDK with credentials
   */
  initialize(options: { 
    accessKeyId: string; 
    accessKeySecret: string;
  }): Promise<{ success: boolean }>;

  /**
   * Start a navigation session with continuous map matching
   */
  startNavigation(options: NavigationOptions): Promise<{ 
    success: boolean; 
    routeId?: string;
  }>;

  /**
   * Stop the current navigation session
   */
  stopNavigation(): Promise<{ success: boolean }>;

  /**
   * Get current map-matched position
   * Returns the latest road-snapped position from HERE SDK
   */
  getCurrentPosition(): Promise<HerePosition>;

  /**
   * Get upcoming maneuver information
   */
  getUpcomingManeuver(): Promise<HereManeuver | null>;

  /**
   * Check if navigation is currently active
   */
  isNavigating(): Promise<{ active: boolean }>;

  /**
   * Add listener for position updates (called every 1 second)
   */
  addPositionListener(
    callback: (position: HerePosition) => void
  ): Promise<string>;

  /**
   * Add listener for maneuver updates
   */
  addManeuverListener(
    callback: (maneuver: HereManeuver) => void
  ): Promise<string>;

  /**
   * Remove a listener by ID
   */
  removePositionListener(options: { listenerId: string }): Promise<void>;

  /**
   * Enable background location updates (iOS only)
   */
  enableBackgroundMode(): Promise<{ success: boolean }>;

  /**
   * Cache offline maps for route corridor (10km radius)
   */
  cacheRouteArea(): Promise<{ 
    success: boolean; 
    cachedMegabytes?: number;
  }>;
}

/**
 * Register the plugin - will be available after native implementation
 * 
 * Usage:
 * import { HereNavigation } from '@/plugins/HereNavigationPlugin';
 * 
 * // Initialize
 * await HereNavigation.initialize({ accessKeyId: '...', accessKeySecret: '...' });
 * 
 * // Start navigation
 * await HereNavigation.startNavigation({
 *   destination: { lat: 40.7128, lng: -74.0060 },
 *   truckProfile: { heightMeters: 4.1, weightKg: 36000, ... }
 * });
 * 
 * // Listen for road-snapped positions
 * HereNavigation.addPositionListener((pos) => {
 *   console.log('Snapped position:', pos.latitude, pos.longitude);
 *   console.log('On ramp:', pos.isOnRamp);
 *   console.log('Match confidence:', pos.matchConfidence);
 * });
 */
export const HereNavigation = registerPlugin<HereNavigationPlugin>('HereNavigation', {
  web: () => import('./HereNavigationPluginWeb').then(m => new m.HereNavigationPluginWeb()),
});
