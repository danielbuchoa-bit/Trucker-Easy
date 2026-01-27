/**
 * Unit tests for POI Cache Service - P0-1 Verification
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { poiCache } from './PoiCacheService';

describe('PoiCacheService', () => {
  beforeEach(() => {
    poiCache.clear();
  });

  describe('generateCacheKey', () => {
    it('should generate consistent cache keys for same location', () => {
      const key1 = poiCache.generateCacheKey(47.6062, -122.3321, 'nearMe', 40000);
      const key2 = poiCache.generateCacheKey(47.6062, -122.3321, 'nearMe', 40000);
      expect(key1).toBe(key2);
    });

    it('should include filter type in cache key', () => {
      const keyNearMe = poiCache.generateCacheKey(47.6062, -122.3321, 'nearMe', 40000);
      const keyTruckStops = poiCache.generateCacheKey(47.6062, -122.3321, 'truckStops', 40000);
      expect(keyNearMe).not.toBe(keyTruckStops);
      expect(keyNearMe).toContain('nearMe');
      expect(keyTruckStops).toContain('truckStops');
    });

    it('should round radius to nearest 5km for better cache hits', () => {
      const key1 = poiCache.generateCacheKey(47.6062, -122.3321, 'nearMe', 38000);
      const key2 = poiCache.generateCacheKey(47.6062, -122.3321, 'nearMe', 42000);
      // Both should round to 40000
      expect(key1).toBe(key2);
    });

    it('should differentiate by onRoute flag', () => {
      const keyOnRoute = poiCache.generateCacheKey(47.6062, -122.3321, 'nearMe', 40000, { onRoute: true });
      const keyNearMe = poiCache.generateCacheKey(47.6062, -122.3321, 'nearMe', 40000, { onRoute: false });
      expect(keyOnRoute).not.toBe(keyNearMe);
      expect(keyOnRoute).toContain('_R_');
      expect(keyNearMe).toContain('_N_');
    });

    it('should include limit in cache key', () => {
      const key30 = poiCache.generateCacheKey(47.6062, -122.3321, 'nearMe', 40000, { limit: 30 });
      const key50 = poiCache.generateCacheKey(47.6062, -122.3321, 'nearMe', 40000, { limit: 50 });
      expect(key30).not.toBe(key50);
    });

    it('should include provider preference in cache key', () => {
      const keyNb = poiCache.generateCacheKey(47.6062, -122.3321, 'nearMe', 40000, { provider: 'nextbillion' });
      const keyHere = poiCache.generateCacheKey(47.6062, -122.3321, 'nearMe', 40000, { provider: 'here' });
      expect(keyNb).not.toBe(keyHere);
    });

    it('should generate different keys for different geohash cells', () => {
      // These locations are ~10 miles apart
      const keySeattle = poiCache.generateCacheKey(47.6062, -122.3321, 'nearMe', 40000);
      const keyBellevue = poiCache.generateCacheKey(47.6101, -122.2015, 'nearMe', 40000);
      expect(keySeattle).not.toBe(keyBellevue);
    });
  });

  describe('cache operations', () => {
    it('should store and retrieve POI data', () => {
      const mockData = { pois: [{ id: 'test-poi', name: 'Test Truck Stop' }] };
      
      poiCache.set(47.6062, -122.3321, 'nearMe', 40000, mockData);
      const cached = poiCache.get(47.6062, -122.3321, 'nearMe', 40000);
      
      expect(cached).not.toBeNull();
      expect(cached?.data).toEqual(mockData);
      expect(cached?.isStale).toBe(false);
    });

    it('should return null for cache miss', () => {
      const cached = poiCache.get(47.6062, -122.3321, 'nearMe', 40000);
      expect(cached).toBeNull();
    });

    it('should report correct stats', () => {
      poiCache.set(47.6062, -122.3321, 'nearMe', 40000, { pois: [] });
      poiCache.set(47.5, -122.5, 'truckStops', 40000, { pois: [] });
      
      const stats = poiCache.getStats();
      expect(stats.entries).toBe(2);
      expect(stats.newest).toBeLessThanOrEqual(100); // Should be very recent
    });

    it('should clear cache', () => {
      poiCache.set(47.6062, -122.3321, 'nearMe', 40000, { pois: [] });
      expect(poiCache.getStats().entries).toBe(1);
      
      poiCache.clear();
      expect(poiCache.getStats().entries).toBe(0);
    });
  });

  describe('shouldRefetch', () => {
    it('should not refetch if user has not moved significantly', () => {
      // Move only 1km
      const shouldFetch = poiCache.shouldRefetch(47.6062, -122.3321, 47.6072, -122.3321);
      expect(shouldFetch).toBe(false);
    });

    it('should refetch if user has moved more than 8km', () => {
      // Move ~15km
      const shouldFetch = poiCache.shouldRefetch(47.6062, -122.3321, 47.7062, -122.3321);
      expect(shouldFetch).toBe(true);
    });
  });
});
