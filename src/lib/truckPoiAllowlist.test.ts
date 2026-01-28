/**
 * Unit Tests for Truck POI Allowlist v2 - Strict 53ft Filtering
 * 
 * Tests ensure:
 * - Truck stops (Pilot, Love's, TA, Petro) are ALLOWED
 * - Regular gas stations (Shell, Arco, Chevron, 76) are BLOCKED
 * - Truck services and weigh stations are ALLOWED
 */

import { describe, it, expect } from 'vitest';
import { checkTruckPoi, filterTruckPois, type TruckPoiCandidate } from './truckPoiAllowlist';

describe('Truck POI Allowlist v2', () => {
  describe('checkTruckPoi', () => {
    
    // ============ ALLOWED: TRUCK STOPS ============
    
    it('should ALLOW Pilot Flying J', () => {
      const poi: TruckPoiCandidate = {
        id: '1',
        name: 'Pilot Flying J Travel Center',
        lat: 47.6,
        lng: -122.3,
      };
      const result = checkTruckPoi(poi);
      expect(result.allowed).toBe(true);
      expect(result.group).toBe('truck_stop');
      expect(result.confidence).toBe('verified');
    });

    it('should ALLOW Love\'s Travel Stop', () => {
      const poi: TruckPoiCandidate = {
        id: '2',
        name: "Love's Travel Stop",
        lat: 47.6,
        lng: -122.3,
      };
      const result = checkTruckPoi(poi);
      expect(result.allowed).toBe(true);
      expect(result.group).toBe('truck_stop');
    });

    it('should ALLOW TA Petro', () => {
      const poi: TruckPoiCandidate = {
        id: '3',
        name: 'TA Petro Truck Stop',
        lat: 47.6,
        lng: -122.3,
      };
      const result = checkTruckPoi(poi);
      expect(result.allowed).toBe(true);
      expect(result.group).toBe('truck_stop');
    });

    it('should ALLOW Sapp Bros', () => {
      const poi: TruckPoiCandidate = {
        id: '4',
        name: 'Sapp Bros Travel Center',
        lat: 47.6,
        lng: -122.3,
      };
      const result = checkTruckPoi(poi);
      expect(result.allowed).toBe(true);
      expect(result.group).toBe('truck_stop');
    });

    // ============ BLOCKED: REGULAR GAS STATIONS ============
    
    it('should BLOCK Shell (regular gas station)', () => {
      const poi: TruckPoiCandidate = {
        id: '10',
        name: 'Shell Gas Station',
        lat: 47.6,
        lng: -122.3,
        category: 'petrol station',
        categories: [{ name: 'petrol station', id: '7311' }],
      };
      const result = checkTruckPoi(poi);
      expect(result.allowed).toBe(false);
      expect(result.group).toBe('blocked');
    });

    it('should BLOCK Chevron', () => {
      const poi: TruckPoiCandidate = {
        id: '11',
        name: 'Chevron',
        lat: 47.6,
        lng: -122.3,
        category: 'petrol station',
      };
      const result = checkTruckPoi(poi);
      expect(result.allowed).toBe(false);
    });

    it('should BLOCK Arco', () => {
      const poi: TruckPoiCandidate = {
        id: '12',
        name: 'Arco Gas Station',
        lat: 47.6,
        lng: -122.3,
      };
      const result = checkTruckPoi(poi);
      expect(result.allowed).toBe(false);
    });

    it('should BLOCK 76', () => {
      const poi: TruckPoiCandidate = {
        id: '13',
        name: '76',
        lat: 47.6,
        lng: -122.3,
        categories: [{ name: 'petrol station', id: '7311' }],
      };
      const result = checkTruckPoi(poi);
      expect(result.allowed).toBe(false);
    });

    it('should BLOCK Safeway Fuel Station', () => {
      const poi: TruckPoiCandidate = {
        id: '14',
        name: 'Safeway Fuel Station',
        lat: 47.6,
        lng: -122.3,
      };
      const result = checkTruckPoi(poi);
      expect(result.allowed).toBe(false);
    });

    it('should BLOCK 7-Eleven', () => {
      const poi: TruckPoiCandidate = {
        id: '15',
        name: '7-Eleven',
        lat: 47.6,
        lng: -122.3,
        categories: [{ name: 'petrol station', id: '7311' }],
      };
      const result = checkTruckPoi(poi);
      expect(result.allowed).toBe(false);
    });

    // ============ ALLOWED: TRUCK SERVICES ============
    
    it('should ALLOW Blue Beacon Truck Wash', () => {
      const poi: TruckPoiCandidate = {
        id: '20',
        name: 'Blue Beacon Truck Wash',
        lat: 47.6,
        lng: -122.3,
      };
      const result = checkTruckPoi(poi);
      expect(result.allowed).toBe(true);
      expect(result.group).toBe('truck_wash');
    });

    it('should ALLOW Speedco truck service', () => {
      const poi: TruckPoiCandidate = {
        id: '21',
        name: 'Speedco Truck Lube',
        lat: 47.6,
        lng: -122.3,
      };
      const result = checkTruckPoi(poi);
      expect(result.allowed).toBe(true);
      expect(result.group).toBe('truck_repair');
    });

    // ============ ALLOWED: WEIGH STATIONS ============
    
    it('should ALLOW Weigh Station', () => {
      const poi: TruckPoiCandidate = {
        id: '30',
        name: 'State Weigh Station',
        lat: 47.6,
        lng: -122.3,
        category: 'weigh station',
      };
      const result = checkTruckPoi(poi);
      expect(result.allowed).toBe(true);
      expect(result.group).toBe('weigh_station');
    });

    it('should ALLOW Port of Entry', () => {
      const poi: TruckPoiCandidate = {
        id: '31',
        name: 'California Port of Entry',
        lat: 47.6,
        lng: -122.3,
      };
      const result = checkTruckPoi(poi);
      expect(result.allowed).toBe(true);
      expect(result.group).toBe('weigh_station');
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
      const result = checkTruckPoi(poi);
      expect(result.allowed).toBe(false);
      expect(result.group).toBe('blocked');
    });

    it('should BLOCK McDonald\'s (restaurant)', () => {
      const poi: TruckPoiCandidate = {
        id: '101',
        name: "McDonald's",
        lat: 47.6,
        lng: -122.3,
        category: 'restaurant',
      };
      const result = checkTruckPoi(poi);
      expect(result.allowed).toBe(false);
    });

    it('should BLOCK "Love" daycare (false positive)', () => {
      const poi: TruckPoiCandidate = {
        id: '102',
        name: 'Imprint of Love Daycare',
        lat: 47.6,
        lng: -122.3,
        category: 'child care facility',
      };
      const result = checkTruckPoi(poi);
      expect(result.allowed).toBe(false);
    });

    // ============ TRUCK PARKING ============
    
    it('should ALLOW POI with truckParking attribute', () => {
      const poi: TruckPoiCandidate = {
        id: '110',
        name: 'Walmart Supercenter',
        lat: 47.6,
        lng: -122.3,
        truckParking: true,
      };
      const result = checkTruckPoi(poi);
      expect(result.allowed).toBe(true);
      expect(result.group).toBe('truck_parking');
    });

    it('should BLOCK Walmart without truck parking', () => {
      const poi: TruckPoiCandidate = {
        id: '111',
        name: 'Walmart Supercenter',
        lat: 47.6,
        lng: -122.3,
      };
      const result = checkTruckPoi(poi);
      expect(result.allowed).toBe(false);
    });
  });

  describe('filterTruckPois', () => {
    it('should filter out non-truck POIs from mixed array', () => {
      const pois: TruckPoiCandidate[] = [
        { id: '1', name: 'Pilot Flying J', lat: 47.6, lng: -122.3 },
        { id: '2', name: 'Shell', lat: 47.6, lng: -122.3, categories: [{ name: 'petrol station' }] },
        { id: '3', name: "Love's Travel Stop", lat: 47.6, lng: -122.3 },
        { id: '4', name: "Arco", lat: 47.6, lng: -122.3 },
        { id: '5', name: 'Blue Beacon Truck Wash', lat: 47.6, lng: -122.3 },
        { id: '6', name: 'Chevron', lat: 47.6, lng: -122.3 },
      ];

      const filtered = filterTruckPois(pois);
      
      expect(filtered.length).toBe(3);
      expect(filtered.map(p => p.name)).toContain('Pilot Flying J');
      expect(filtered.map(p => p.name)).toContain("Love's Travel Stop");
      expect(filtered.map(p => p.name)).toContain('Blue Beacon Truck Wash');
    });

    it('should block all regular gas stations', () => {
      const pois: TruckPoiCandidate[] = [
        { id: '1', name: 'Shell', lat: 47.6, lng: -122.3, categories: [{ name: 'petrol station' }] },
        { id: '2', name: 'Arco', lat: 47.6, lng: -122.3 },
        { id: '3', name: 'Chevron', lat: 47.6, lng: -122.3 },
        { id: '4', name: '76', lat: 47.6, lng: -122.3, categories: [{ name: 'petrol station' }] },
        { id: '5', name: 'Safeway Fuel Station', lat: 47.6, lng: -122.3 },
      ];

      const filtered = filterTruckPois(pois);
      expect(filtered.length).toBe(0);
    });

    it('should return empty array when no truck POIs exist', () => {
      const pois: TruckPoiCandidate[] = [
        { id: '1', name: 'Starbucks', lat: 47.6, lng: -122.3, category: 'coffee shop' },
        { id: '2', name: 'Target', lat: 47.6, lng: -122.3, category: 'retail store' },
      ];

      const filtered = filterTruckPois(pois);
      expect(filtered.length).toBe(0);
    });
  });
});
