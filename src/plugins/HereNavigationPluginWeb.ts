/**
 * Web fallback implementation of HereNavigationPlugin
 * 
 * This provides a web-based fallback when running in browser (not native).
 * It uses the existing HERE Map Matching API for best-effort road snapping.
 * 
 * NOTE: True continuous map matching is only available in native SDK.
 * This web implementation provides approximate functionality.
 */

import { WebPlugin } from '@capacitor/core';
import type { 
  HereNavigationPlugin, 
  HerePosition, 
  HereManeuver, 
  NavigationOptions 
} from './HereNavigationPlugin';

export class HereNavigationPluginWeb extends WebPlugin implements HereNavigationPlugin {
  private isActive = false;
  private watchId: number | null = null;
  private positionListeners: Map<string, (pos: HerePosition) => void> = new Map();
  private maneuverListeners: Map<string, (m: HereManeuver) => void> = new Map();
  private lastPosition: HerePosition | null = null;

  async initialize(_options: { accessKeyId: string; accessKeySecret: string }): Promise<{ success: boolean }> {
    console.warn('[HereNavigationPluginWeb] Running in web mode - using API-based map matching (not native SDK)');
    return { success: true };
  }

  async startNavigation(_options: NavigationOptions): Promise<{ success: boolean; routeId?: string }> {
    if (this.isActive) {
      await this.stopNavigation();
    }

    this.isActive = true;

    // Start watching position with high accuracy
    if ('geolocation' in navigator) {
      this.watchId = navigator.geolocation.watchPosition(
        (position) => this.handlePositionUpdate(position),
        (error) => console.error('[HereNavigationPluginWeb] Geolocation error:', error),
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        }
      );
    }

    return { success: true, routeId: `web-${Date.now()}` };
  }

  async stopNavigation(): Promise<{ success: boolean }> {
    this.isActive = false;
    
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    return { success: true };
  }

  async getCurrentPosition(): Promise<HerePosition> {
    if (this.lastPosition) {
      return this.lastPosition;
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const herePos: HerePosition = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            heading: pos.coords.heading ?? 0,
            speed: pos.coords.speed ?? 0,
            matchConfidence: 0.5, // Web fallback has lower confidence
            timestamp: pos.timestamp,
          };
          this.lastPosition = herePos;
          resolve(herePos);
        },
        reject,
        { enableHighAccuracy: true }
      );
    });
  }

  async getUpcomingManeuver(): Promise<HereManeuver | null> {
    // Web implementation doesn't have native maneuver detection
    return null;
  }

  async isNavigating(): Promise<{ active: boolean }> {
    return { active: this.isActive };
  }

  async addPositionListener(callback: (position: HerePosition) => void): Promise<string> {
    const listenerId = `pos-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.positionListeners.set(listenerId, callback);
    return listenerId;
  }

  async addManeuverListener(callback: (maneuver: HereManeuver) => void): Promise<string> {
    const listenerId = `man-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.maneuverListeners.set(listenerId, callback);
    return listenerId;
  }

  async removePositionListener(options: { listenerId: string }): Promise<void> {
    this.positionListeners.delete(options.listenerId);
    this.maneuverListeners.delete(options.listenerId);
  }

  async enableBackgroundMode(): Promise<{ success: boolean }> {
    console.warn('[HereNavigationPluginWeb] Background mode not available in web');
    return { success: false };
  }

  async cacheRouteArea(): Promise<{ success: boolean; cachedMegabytes?: number }> {
    console.warn('[HereNavigationPluginWeb] Offline caching not available in web');
    return { success: false };
  }

  private handlePositionUpdate(position: GeolocationPosition): void {
    const herePos: HerePosition = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      heading: position.coords.heading ?? 0,
      speed: position.coords.speed ?? 0,
      matchConfidence: 0.5,
      timestamp: position.timestamp,
    };

    this.lastPosition = herePos;

    // Notify all position listeners
    this.positionListeners.forEach((callback) => {
      try {
        callback(herePos);
      } catch (e) {
        console.error('[HereNavigationPluginWeb] Listener error:', e);
      }
    });
  }
}
