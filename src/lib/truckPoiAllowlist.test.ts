/**
 * Unit Tests for Truck POI Allowlist - P0-1 Verification
 * 
 * Tests the filter rules to ensure:
 * - Truck stops and fuel stations are ALLOWED
 * - Irrelevant retail/restaurants are BLOCKED
 */

import { describe, it, expect } from 'vitest';
import { checkTruckPoiAllowlist, filterTruckOnlyPois, type TruckPoiCandidate } from './truckPoiAllowlist';

describe('Truck POI Allowlist', () => {
  describe('checkTruckPoiAllowlist', () => {
    
    // ============ ALLOWED: TRUCK STOPS ============
    
    it('should ALLOW Pilot Flying J', () => {
      const poi: TruckPoiCandidate = {
        id: '1',
        name: 'Pilot Flying J Travel Center',
        lat: 47.6,
        lng: -122.3,
      };
      const result = checkTruckPoiAllowlist(poi);
      expect(result.allowed).toBe(true);
      expect(result.category).toBe('truck_stop');
      expect(result.confidence).toBe('confirmed');
    });

    it('should ALLOW Love\'s Travel Stop', () => {
      const poi: TruckPoiCandidate = {
        id: '2',
        name: "Love's Travel Stop",
        lat: 47.6,
        lng: -122.3,
      };
      const result = checkTruckPoiAllowlist(poi);
      expect(result.allowed).toBe(true);
      expect(result.category).toBe('truck_stop');
    });

    it('should ALLOW TA Petro', () => {
      const poi: TruckPoiCandidate = {
        id: '3',
        name: 'TA Petro Truck Stop',
        lat: 47.6,
        lng: -122.3,
      };
      const result = checkTruckPoiAllowlist(poi);
      expect(result.allowed).toBe(true);
      expect(result.category).toBe('truck_stop');
    });

    it('should ALLOW Sapp Bros', () => {
      const poi: TruckPoiCandidate = {
        id: '4',
        name: 'Sapp Bros Travel Center',
        lat: 47.6,
        lng: -122.3,
      };
      const result = checkTruckPoiAllowlist(poi);
      expect(result.allowed).toBe(true);
      expect(result.category).toBe('truck_stop');
    });

    // ============ ALLOWED: TRUCK-FRIENDLY FUEL STATIONS ============
    
    it('should ALLOW Shell (major fuel station)', () => {
      const poi: TruckPoiCandidate = {
        id: '10',
        name: 'Shell Gas Station',
        lat: 47.6,
        lng: -122.3,
        category: 'fuel_station',
        categories: [{ name: 'Fuel Station', id: '700-7600-0000' }],
      };
      const result = checkTruckPoiAllowlist(poi);
      // Shell is allowed because category includes 'fuel station'
      expect(result.allowed).toBe(true);
    });

    it('should ALLOW Chevron with diesel category', () => {
      const poi: TruckPoiCandidate = {
        id: '11',
        name: 'Chevron',
        lat: 47.6,
        lng: -122.3,
        category: 'diesel fuel station',
      };
      const result = checkTruckPoiAllowlist(poi);
      expect(result.allowed).toBe(true);
    });

    it('should ALLOW QuikTrip (QT)', () => {
      const poi: TruckPoiCandidate = {
        id: '12',
        name: 'QuikTrip',
        lat: 47.6,
        lng: -122.3,
      };
      const result = checkTruckPoiAllowlist(poi);
      expect(result.allowed).toBe(true);
      expect(result.category).toBe('truck_stop');
    });

    it('should ALLOW Speedway', () => {
      const poi: TruckPoiCandidate = {
        id: '13',
        name: 'Speedway Gas Station',
        lat: 47.6,
        lng: -122.3,
      };
      const result = checkTruckPoiAllowlist(poi);
      expect(result.allowed).toBe(true);
    });

    // ============ ALLOWED: TRUCK SERVICES ============
    
    it('should ALLOW Blue Beacon Truck Wash', () => {
      const poi: TruckPoiCandidate = {
        id: '20',
        name: 'Blue Beacon Truck Wash',
        lat: 47.6,
        lng: -122.3,
      };
      const result = checkTruckPoiAllowlist(poi);
      expect(result.allowed).toBe(true);
      expect(result.category).toBe('truck_service');
    });

    // ============ ALLOWED: WEIGH STATIONS ============
    
    it('should ALLOW DOT Weigh Station', () => {
      const poi: TruckPoiCandidate = {
        id: '30',
        name: 'State Weigh Station',
        lat: 47.6,
        lng: -122.3,
        category: 'weigh station',
      };
      const result = checkTruckPoiAllowlist(poi);
      expect(result.allowed).toBe(true);
      expect(result.category).toBe('weigh_station');
    });

    it('should ALLOW Port of Entry', () => {
      const poi: TruckPoiCandidate = {
        id: '31',
        name: 'California Port of Entry',
        lat: 47.6,
        lng: -122.3,
      };
      const result = checkTruckPoiAllowlist(poi);
      expect(result.allowed).toBe(true);
      expect(result.category).toBe('weigh_station');
    });

    // ============ ALLOWED: REST AREAS ============
    
    it('should ALLOW Rest Area', () => {
      const poi: TruckPoiCandidate = {
        id: '40',
        name: 'I-90 Rest Area',
        lat: 47.6,
        lng: -122.3,
      };
      const result = checkTruckPoiAllowlist(poi);
      expect(result.allowed).toBe(true);
      expect(result.category).toBe('rest_area');
    });

    it('should ALLOW Service Plaza', () => {
      const poi: TruckPoiCandidate = {
        id: '41',
        name: 'Highway Service Plaza',
        lat: 47.6,
        lng: -122.3,
      };
      const result = checkTruckPoiAllowlist(poi);
      expect(result.allowed).toBe(true);
      expect(result.category).toBe('rest_area');
    });

    // ============ BLOCKED: IRRELEVANT POIs ============
    
    it('should BLOCK Starbucks (coffee shop)', () => {
      const poi: TruckPoiCandidate = {
        id: '100',
        name: 'Starbucks',
        lat: 47.6,
        lng: -122.3,
        category: 'coffee shop',
      };
      const result = checkTruckPoiAllowlist(poi);
      expect(result.allowed).toBe(false);
      expect(result.category).toBe('blocked');
    });

    it('should BLOCK McDonald\'s (restaurant)', () => {
      const poi: TruckPoiCandidate = {
        id: '101',
        name: "McDonald's",
        lat: 47.6,
        lng: -122.3,
        category: 'restaurant',
      };
      const result = checkTruckPoiAllowlist(poi);
      expect(result.allowed).toBe(false);
    });

    it('should BLOCK Safeway (grocery)', () => {
      const poi: TruckPoiCandidate = {
        id: '102',
        name: 'Safeway',
        lat: 47.6,
        lng: -122.3,
        category: 'grocery supermarket',
      };
      const result = checkTruckPoiAllowlist(poi);
      expect(result.allowed).toBe(false);
    });

    it('should BLOCK random auto repair shop', () => {
      const poi: TruckPoiCandidate = {
        id: '103',
        name: 'Joe\'s Auto Repair',
        lat: 47.6,
        lng: -122.3,
        category: 'business',
      };
      const result = checkTruckPoiAllowlist(poi);
      expect(result.allowed).toBe(false);
    });

    it('should BLOCK downtown plaza locations', () => {
      const poi: TruckPoiCandidate = {
        id: '104',
        name: 'City Center Gas',
        lat: 47.6,
        lng: -122.3,
        address: 'Downtown City Center Plaza',
      };
      const result = checkTruckPoiAllowlist(poi);
      expect(result.allowed).toBe(false);
    });

    // ============ CONDITIONAL: WALMART ============
    
    it('should BLOCK Walmart without verified truck parking', () => {
      const poi: TruckPoiCandidate = {
        id: '110',
        name: 'Walmart Supercenter',
        lat: 47.6,
        lng: -122.3,
      };
      const result = checkTruckPoiAllowlist(poi);
      expect(result.allowed).toBe(false);
    });

    it('should ALLOW Walmart WITH verified truck parking', () => {
      const poi: TruckPoiCandidate = {
        id: '111',
        name: 'Walmart Supercenter',
        lat: 47.6,
        lng: -122.3,
        truckParking: true,
      };
      const result = checkTruckPoiAllowlist(poi);
      expect(result.allowed).toBe(true);
      expect(result.category).toBe('walmart');
    });
  });

  describe('filterTruckOnlyPois', () => {
    it('should filter out non-truck POIs from mixed array', () => {
      const pois: TruckPoiCandidate[] = [
        { id: '1', name: 'Pilot Flying J', lat: 47.6, lng: -122.3 },
        { id: '2', name: 'Starbucks', lat: 47.6, lng: -122.3, category: 'coffee shop' },
        { id: '3', name: "Love's Travel Stop", lat: 47.6, lng: -122.3 },
        { id: '4', name: "McDonald's", lat: 47.6, lng: -122.3, category: 'restaurant' },
        { id: '5', name: 'Blue Beacon Truck Wash', lat: 47.6, lng: -122.3 },
        { id: '6', name: 'Target Store', lat: 47.6, lng: -122.3, category: 'retail' },
      ];

      const filtered = filterTruckOnlyPois(pois);
      
      expect(filtered.length).toBe(3);
      expect(filtered.map(p => p.name)).toEqual([
        'Pilot Flying J',
        "Love's Travel Stop",
        'Blue Beacon Truck Wash',
      ]);
    });

    it('should keep fuel stations with truck-related categories', () => {
      const pois: TruckPoiCandidate[] = [
        { 
          id: '1', 
          name: 'Shell', 
          lat: 47.6, 
          lng: -122.3,
          category: 'fuel_station',
          categories: [{ name: 'Fuel Station', id: '700-7600-0000' }],
        },
        { 
          id: '2', 
          name: 'Exxon', 
          lat: 47.6, 
          lng: -122.3,
          category: 'diesel fuel station',
        },
      ];

      const filtered = filterTruckOnlyPois(pois);
      expect(filtered.length).toBe(2);
    });

    it('should return empty array when no truck POIs exist', () => {
      const pois: TruckPoiCandidate[] = [
        { id: '1', name: 'Starbucks', lat: 47.6, lng: -122.3, category: 'coffee shop' },
        { id: '2', name: 'Target', lat: 47.6, lng: -122.3, category: 'retail store' },
      ];

      const filtered = filterTruckOnlyPois(pois);
      expect(filtered.length).toBe(0);
    });
  });
});
