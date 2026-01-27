/**
 * POI Cache Service - P0-1 Fix
 * 
 * Implements:
 * - In-memory cache with TTL (30-60 min)
 * - Geohash-based cache keys
 * - Stale-while-revalidate pattern
 * - Distance-based invalidation (5-10 miles)
 */

interface CachedPoi {
  data: any;
  timestamp: number;
  geohash: string;
  filterType: string;
  isStale: boolean;
}

interface CacheConfig {
  ttlMs: number;           // Time-to-live in milliseconds
  staleMs: number;         // Time after which data is considered stale but usable
  maxEntries: number;      // Maximum cache entries
  invalidationDistanceM: number; // Distance moved to invalidate cache (meters)
}

// Geohash precision for cache keys (5 = ~4.9km x 4.9km cells)
const GEOHASH_PRECISION = 5;

// Base32 alphabet for geohash
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

class PoiCacheService {
  private cache: Map<string, CachedPoi> = new Map();
  private config: CacheConfig = {
    ttlMs: 45 * 60 * 1000,      // 45 minutes TTL
    staleMs: 30 * 60 * 1000,    // 30 minutes stale threshold
    maxEntries: 100,
    invalidationDistanceM: 8000, // 5 miles = ~8km
  };

  /**
   * Generate a geohash from lat/lng coordinates
   */
  private encodeGeohash(lat: number, lng: number, precision: number = GEOHASH_PRECISION): string {
    let latRange = [-90, 90];
    let lngRange = [-180, 180];
    let geohash = '';
    let bit = 0;
    let ch = 0;
    let isEven = true;

    while (geohash.length < precision) {
      if (isEven) {
        const mid = (lngRange[0] + lngRange[1]) / 2;
        if (lng >= mid) {
          ch |= 1 << (4 - bit);
          lngRange[0] = mid;
        } else {
          lngRange[1] = mid;
        }
      } else {
        const mid = (latRange[0] + latRange[1]) / 2;
        if (lat >= mid) {
          ch |= 1 << (4 - bit);
          latRange[0] = mid;
        } else {
          latRange[1] = mid;
        }
      }
      isEven = !isEven;
      if (bit < 4) {
        bit++;
      } else {
        geohash += BASE32[ch];
        bit = 0;
        ch = 0;
      }
    }
    return geohash;
  }

  /**
   * Generate cache key from location and filter type
   */
  private getCacheKey(lat: number, lng: number, filterType: string, radiusM: number): string {
    const geohash = this.encodeGeohash(lat, lng);
    // Round radius to nearest 10km for better cache hits
    const roundedRadius = Math.round(radiusM / 10000) * 10000;
    return `poi_${geohash}_${filterType}_${roundedRadius}`;
  }

  /**
   * Get cached POIs if available
   * Returns { data, isStale } or null if cache miss
   */
  get(lat: number, lng: number, filterType: string, radiusM: number): { data: any; isStale: boolean } | null {
    const key = this.getCacheKey(lat, lng, filterType, radiusM);
    const cached = this.cache.get(key);

    if (!cached) {
      console.log(`[PoiCache] MISS: ${key}`);
      return null;
    }

    const now = Date.now();
    const age = now - cached.timestamp;

    // Check if expired (beyond TTL)
    if (age > this.config.ttlMs) {
      console.log(`[PoiCache] EXPIRED: ${key} (age: ${Math.round(age / 1000)}s)`);
      this.cache.delete(key);
      return null;
    }

    // Check if stale but still usable
    const isStale = age > this.config.staleMs;
    console.log(`[PoiCache] HIT: ${key} (age: ${Math.round(age / 1000)}s, stale: ${isStale})`);

    return {
      data: cached.data,
      isStale,
    };
  }

  /**
   * Store POIs in cache
   */
  set(lat: number, lng: number, filterType: string, radiusM: number, data: any): void {
    // Enforce max entries
    if (this.cache.size >= this.config.maxEntries) {
      this.evictOldest();
    }

    const key = this.getCacheKey(lat, lng, filterType, radiusM);
    const geohash = this.encodeGeohash(lat, lng);

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      geohash,
      filterType,
      isStale: false,
    });

    console.log(`[PoiCache] SET: ${key} (${data?.pois?.length || 0} POIs)`);
  }

  /**
   * Check if location has moved enough to warrant new fetch
   */
  shouldRefetch(currentLat: number, currentLng: number, lastLat: number, lastLng: number): boolean {
    const distance = this.calculateDistance(currentLat, currentLng, lastLat, lastLng);
    const shouldFetch = distance > this.config.invalidationDistanceM;
    
    if (shouldFetch) {
      console.log(`[PoiCache] Movement invalidation: ${Math.round(distance)}m > ${this.config.invalidationDistanceM}m`);
    }
    
    return shouldFetch;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`[PoiCache] Cleared ${size} entries`);
  }

  /**
   * Clear cache for specific filter type
   */
  clearByFilter(filterType: string): void {
    let cleared = 0;
    for (const [key, value] of this.cache) {
      if (value.filterType === filterType) {
        this.cache.delete(key);
        cleared++;
      }
    }
    console.log(`[PoiCache] Cleared ${cleared} entries for filter: ${filterType}`);
  }

  /**
   * Get cache statistics
   */
  getStats(): { entries: number; oldest: number | null; newest: number | null } {
    if (this.cache.size === 0) {
      return { entries: 0, oldest: null, newest: null };
    }

    let oldest = Infinity;
    let newest = 0;

    for (const cached of this.cache.values()) {
      oldest = Math.min(oldest, cached.timestamp);
      newest = Math.max(newest, cached.timestamp);
    }

    return {
      entries: this.cache.size,
      oldest: Date.now() - oldest,
      newest: Date.now() - newest,
    };
  }

  /**
   * Evict oldest cache entry
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, value] of this.cache) {
      if (value.timestamp < oldestTime) {
        oldestTime = value.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      console.log(`[PoiCache] Evicted oldest: ${oldestKey}`);
    }
  }

  /**
   * Calculate distance between two points in meters
   */
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Earth radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}

// Singleton instance
export const poiCache = new PoiCacheService();
export default poiCache;
