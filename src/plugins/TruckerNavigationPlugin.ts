/**
 * Trucker Navigation Plugin - Native iOS GPS Bridge
 * 
 * This plugin interfaces with the native TruckerNavigationBridge to get
 * real GPS data from iOS CoreLocation with:
 * - Kalman filtering
 * - Speed smoothing
 * - Snap-to-road / map matching
 * - Teleport rejection
 * 
 * IMPORTANT: This is the ONLY source of truth for GPS data in the app.
 * Do NOT use browser geolocation when this plugin is available.
 */

import { registerPlugin, PluginListenerHandle } from '@capacitor/core';

// ============= Types =============

export interface TruckerLocationUpdate {
  // Primary display values (use these in UI)
  latitude: number;
  longitude: number;
  heading: number;
  speed: number; // m/s
  speedMph: number;
  speedKph: number;
  
  // Raw GPS values (for debug)
  rawLatitude: number;
  rawLongitude: number;
  rawSpeed: number;
  rawCourse: number;
  rawAccuracy: number;
  
  // Filtered values (Kalman applied)
  filteredLatitude: number;
  filteredLongitude: number;
  
  // Snapped values (only when route is active)
  snappedLatitude: number | null;
  snappedLongitude: number | null;
  snapOffsetMeters: number | null;
  distanceToRouteMeters: number | null;
  
  // Status
  isOnRoute: boolean;
  isStale: boolean;
  isRejected: boolean;
  rejectionReason: string | null;
  
  // Timing
  timestamp: number; // Unix ms
  updateFrequencyHz: number;
  timeSinceLastUpdateMs: number;
  
  // Source indicator
  source: 'native_ios' | 'web_fallback';
}

export interface TruckerNavigationConfig {
  // CoreLocation
  distanceFilter?: number; // meters, default 5

  // Kalman filter
  kalmanQ?: number; // Process noise, default 0.00001
  kalmanR?: number; // Measurement noise, default 0.01

  // Speed
  speedSmoothingSamples?: number; // default 5
  minSpeedThreshold?: number; // m/s, below this show 0

  // Heading
  headingLerpFactor?: number; // 0-1, default 0.15
  minSpeedForHeading?: number; // m/s, use course only above this

  // Snap/Route
  snapThresholdMeters?: number; // snap if within this, default 25
  offRouteThresholdMeters?: number; // reroute threshold, default 50
  offRouteDurationSeconds?: number; // time before reroute, default 4

  // Teleport prevention
  maxPositionJumpMeters?: number; // reject jumps larger, default 100

  // Debug
  enableDebugLogging?: boolean;
}

export interface RoutePoint {
  lat: number;
  lng: number;
}

export interface NavigationStatistics {
  totalUpdates: number;
  rejectedUpdates: number;
  rerouteCount: number;
  acceptanceRate: number;
}

export interface TruckerNavigationPlugin {
  /**
   * Initialize the native location engine
   */
  initialize(config?: TruckerNavigationConfig): Promise<{ success: boolean; source: string }>;

  /**
   * Start receiving location updates
   */
  startLocationUpdates(): Promise<{ success: boolean }>;

  /**
   * Stop location updates
   */
  stopLocationUpdates(): Promise<{ success: boolean }>;

  /**
   * Set the active route for snap-to-road
   */
  setRoute(options: { polyline: RoutePoint[] }): Promise<{ success: boolean; pointCount: number }>;

  /**
   * Clear the active route
   */
  clearRoute(): Promise<{ success: boolean }>;

  /**
   * Update configuration at runtime
   */
  updateConfig(config: TruckerNavigationConfig): Promise<{ success: boolean }>;

  /**
   * Get engine statistics
   */
  getStatistics(): Promise<NavigationStatistics>;

  /**
   * Get debug logs
   */
  getDebugLogs(options?: { limit?: number }): Promise<{ logs: string[] }>;

  /**
   * Request location permissions
   */
  requestPermissions(): Promise<{ success: boolean }>;

  /**
   * Add listener for location updates
   */
  addListener(
    eventName: 'nativeLocationUpdate',
    callback: (update: TruckerLocationUpdate) => void
  ): Promise<PluginListenerHandle>;

  /**
   * Add listener for off-route detection
   */
  addListener(
    eventName: 'nativeOffRouteDetected',
    callback: (data: { distanceMeters: number; durationSeconds: number }) => void
  ): Promise<PluginListenerHandle>;

  /**
   * Add listener for reroute requests
   */
  addListener(
    eventName: 'nativeRerouteRequired',
    callback: (data: { reason: string; timestamp: number }) => void
  ): Promise<PluginListenerHandle>;

  /**
   * Add listener for debug logs
   */
  addListener(
    eventName: 'nativeDebugLog',
    callback: (data: { message: string }) => void
  ): Promise<PluginListenerHandle>;

  /**
   * Remove all listeners
   */
  removeAllListeners(): Promise<void>;
}

// ============= Web Fallback Implementation =============

const webFallback: TruckerNavigationPlugin = {
  async initialize() {
    console.warn('[TruckerNavigation] Running in web fallback mode - NOT for production!');
    return { success: true, source: 'web_fallback' };
  },

  async startLocationUpdates() {
    console.warn('[TruckerNavigation] Web fallback: Using browser geolocation');
    return { success: true };
  },

  async stopLocationUpdates() {
    return { success: true };
  },

  async setRoute(options) {
    console.log('[TruckerNavigation] Web fallback: Route set with', options.polyline.length, 'points');
    return { success: true, pointCount: options.polyline.length };
  },

  async clearRoute() {
    return { success: true };
  },

  async updateConfig() {
    return { success: true };
  },

  async getStatistics() {
    return {
      totalUpdates: 0,
      rejectedUpdates: 0,
      rerouteCount: 0,
      acceptanceRate: 1.0,
    };
  },

  async getDebugLogs() {
    return { logs: ['[Web Fallback] No native logs available'] };
  },

  async requestPermissions() {
    return { success: true };
  },

  async addListener(eventName: string, callback: (data: any) => void) {
    console.log('[TruckerNavigation] Web fallback: Listener added for', eventName);
    // Return a dummy listener handle
    return {
      remove: async () => {
        console.log('[TruckerNavigation] Web fallback: Listener removed for', eventName);
      },
    };
  },

  async removeAllListeners() {
    console.log('[TruckerNavigation] Web fallback: All listeners removed');
  },
};

// ============= Plugin Registration =============

export const TruckerNavigation = registerPlugin<TruckerNavigationPlugin>(
  'TruckerNavigationBridge',
  {
    web: () => webFallback,
  }
);

// ============= Utility Functions =============

/**
 * Check if native navigation is available
 */
export function isNativeNavigationAvailable(): boolean {
  // Check if we're in a Capacitor native context
  return typeof (window as any).Capacitor !== 'undefined' && 
         (window as any).Capacitor.isNativePlatform?.();
}

/**
 * Default configuration for highway driving
 */
export const HIGHWAY_CONFIG: TruckerNavigationConfig = {
  distanceFilter: 5,
  kalmanQ: 0.00001,
  kalmanR: 0.01,
  speedSmoothingSamples: 5,
  minSpeedThreshold: 0.5,
  headingLerpFactor: 0.15,
  minSpeedForHeading: 2.0,
  snapThresholdMeters: 25,
  offRouteThresholdMeters: 50,
  offRouteDurationSeconds: 4,
  maxPositionJumpMeters: 100,
  enableDebugLogging: true,
};

/**
 * Configuration for city driving
 */
export const CITY_CONFIG: TruckerNavigationConfig = {
  ...HIGHWAY_CONFIG,
  snapThresholdMeters: 15,
  offRouteThresholdMeters: 25,
  offRouteDurationSeconds: 3,
};

/**
 * Convert m/s to mph
 */
export function msToMph(mps: number): number {
  return mps * 2.23694;
}

/**
 * Convert m/s to kph
 */
export function msToKph(mps: number): number {
  return mps * 3.6;
}
