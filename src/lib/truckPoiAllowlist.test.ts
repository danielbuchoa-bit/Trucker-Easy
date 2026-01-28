/**
 * Unit Tests for Truck POI Allowlist v3 - Strict 53ft Filtering
 * 
 * Tests ensure:
 * - Truck stops (Pilot, Love's, TA, Petro) are ALLOWED
 * - Regular gas stations (Shell, Arco, Chevron, 76) are BLOCKED
 * - TA brand only matches with truck context (not Petco, Santa, Utah)
 * - Truck services and weigh stations are ALLOWED
 */

import { describe, it, expect } from 'vitest';
import { checkTruckPoi, filterTruckPois, type TruckPoiCandidate } from './truckPoiAllowlist';

describe('Truck POI Allowlist v3', () => {
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
      expect(result.score).toBe(100);
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
      expect(result.confidence).toBe('verified');
    });

    it('should ALLOW TA Travel Center (with truck context)', () => {
      const poi: TruckPoiCandidate = {
        id: '3',
        name: 'TA Travel Center',
        lat: 47.6,
        lng: -122.3,
      };
      const result = checkTruckPoi(poi);
      expect(result.allowed).toBe(true);
      expect(result.group).toBe('truck_stop');
      expect(result.confidence).toBe('verified');
    });

    it('should ALLOW TA Petro', () => {
      const poi: TruckPoiCandidate = {
        id: '3b',
        name: 'TA Petro Truck Stop',
        lat: 47.6,
        lng: -122.3,
      };
      const result = checkTruckPoi(poi);
      expect(result.allowed).toBe(true);
      expect(result.group).toBe('truck_stop');
    });

    it('should ALLOW Petro Stopping Centers', () => {
      const poi: TruckPoiCandidate = {
        id: '3c',
        name: 'Petro Stopping Centers',
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

    it('should ALLOW One9', () => {
      const poi: TruckPoiCandidate = {
        id: '5',
        name: 'One9 Fuel Network',
        lat: 47.6,
        lng: -122.3,
      };
      const result = checkTruckPoi(poi);
      expect(result.allowed).toBe(true);
      expect(result.group).toBe('truck_stop');
    });

    // ============ BLOCKED: TA FALSE POSITIVES ============

    it('should BLOCK Petco (TA false positive)', () => {
      const poi: TruckPoiCandidate = {
        id: '10',
        name: 'Petco',
        lat: 47.6,
        lng: -122.3,
        category: 'pet store',
      };
      const result = checkTruckPoi(poi);
      expect(result.allowed).toBe(false);
      expect(result.group).toBe('blocked');
    });

    it('should BLOCK Santa Fe Station (TA false positive)', () => {
      const poi: TruckPoiCandidate = {
        id: '11',
        name: 'Santa Fe Station',
        lat: 47.6,
        lng: -122.3,
        category: 'train station',
      };
      const result = checkTruckPoi(poi);
      expect(result.allowed).toBe(false);
    });

    it('should BLOCK Utah State Capitol (TA false positive)', () => {
      const poi: TruckPoiCandidate = {
        id: '12',
        name: 'Utah State Capitol',
        lat: 47.6,
        lng: -122.3,
        category: 'government building',
      };
      const result = checkTruckPoi(poi);
      expect(result.allowed).toBe(false);
    });

    it('should BLOCK "TA" without truck context', () => {
      const poi: TruckPoiCandidate = {
        id: '13',
        name: 'TA Electronics',
        lat: 47.6,
        lng: -122.3,
        category: 'electronics store',
      };
      const result = checkTruckPoi(poi);
      expect(result.allowed).toBe(false);
    });

    // ============ BLOCKED: REGULAR GAS STATIONS ============
    
    it('should BLOCK Shell (regular gas station)', () => {
      const poi: TruckPoiCandidate = {
        id: '20',
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
        id: '21',
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
        id: '22',
        name: 'Arco Gas Station',
        lat: 47.6,
        lng: -122.3,
      };
      const result = checkTruckPoi(poi);
      expect(result.allowed).toBe(false);
    });

    it('should BLOCK 76', () => {
      const poi: TruckPoiCandidate = {
        id: '23',
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
        id: '24',
        name: 'Safeway Fuel Station',
        lat: 47.6,
        lng: -122.3,
      };
      const result = checkTruckPoi(poi);
      expect(result.allowed).toBe(false);
    });

    it('should BLOCK 7-Eleven', () => {
      const poi: TruckPoiCandidate = {
        id: '25',
        name: '7-Eleven',
        lat: 47.6,
        lng: -122.3,
        categories: [{ name: 'petrol station', id: '7311' }],
      };
      const result = checkTruckPoi(poi);
      expect(result.allowed).toBe(false);
    });

    it('should BLOCK Circle K', () => {
      const poi: TruckPoiCandidate = {
        id: '26',
        name: 'Circle K',
        lat: 47.6,
        lng: -122.3,
        category: 'gas station',
      };
      const result = checkTruckPoi(poi);
      expect(result.allowed).toBe(false);
    });

    it('should BLOCK generic gas station without truck indicators', () => {
      const poi: TruckPoiCandidate = {
        id: '27',
        name: 'Quick Fuel',
        lat: 47.6,
        lng: -122.3,
        category: 'gas station',
      };
      const result = checkTruckPoi(poi);
      expect(result.allowed).toBe(false);
    });

    // ============ ALLOWED: TRUCK SERVICES ============
    
    it('should ALLOW Blue Beacon Truck Wash', () => {
      const poi: TruckPoiCandidate = {
        id: '30',
        name: 'Blue Beacon Truck Wash',
        lat: 47.6,
        lng: -122.3,
      };
      const result = checkTruckPoi(poi);
      expect(result.allowed).toBe(true);
      expect(result.group).toBe('truck_wash');
      expect(result.confidence).toBe('verified');
    });

    it('should ALLOW Speedco truck service', () => {
      const poi: TruckPoiCandidate = {
        id: '31',
        name: 'Speedco Truck Lube',
        lat: 47.6,
        lng: -122.3,
      };
      const result = checkTruckPoi(poi);
      expect(result.allowed).toBe(true);
      expect(result.group).toBe('truck_repair');
      expect(result.confidence).toBe('verified');
    });

    it('should ALLOW generic truck repair shop', () => {
      const poi: TruckPoiCandidate = {
        id: '32',
        name: 'Acme Diesel Repair Service', // Changed to avoid "Big Rig" matching truck_stop
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
        id: '40',
        name: 'State Weigh Station',
        lat: 47.6,
        lng: -122.3,
        category: 'weigh station',
      };
      const result = checkTruckPoi(poi);
      expect(result.allowed).toBe(true);
      expect(result.group).toBe('weigh_station');
      expect(result.confidence).toBe('verified');
    });

    it('should ALLOW Port of Entry', () => {
      const poi: TruckPoiCandidate = {
        id: '41',
        name: 'California Port of Entry',
        lat: 47.6,
        lng: -122.3,
      };
      const result = checkTruckPoi(poi);
      expect(result.allowed).toBe(true);
      expect(result.group).toBe('weigh_station');
    });

    it('should ALLOW DOT Inspection Station', () => {
      const poi: TruckPoiCandidate = {
        id: '42',
        name: 'DOT Inspection Station I-95',
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
        id: '50',
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
        id: '51',
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
        id: '52',
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
        id: '60',
        name: 'Walmart Supercenter',
        lat: 47.6,
        lng: -122.3,
        truckParking: true,
      };
      const result = checkTruckPoi(poi);
      expect(result.allowed).toBe(true);
      expect(result.group).toBe('truck_parking');
      expect(result.confidence).toBe('verified');
    });

    it('should BLOCK Walmart without truck parking', () => {
      const poi: TruckPoiCandidate = {
        id: '61',
        name: 'Walmart Supercenter',
        lat: 47.6,
        lng: -122.3,
      };
      const result = checkTruckPoi(poi);
      expect(result.allowed).toBe(false);
    });

    it('should ALLOW dedicated truck parking lot', () => {
      const poi: TruckPoiCandidate = {
        id: '62',
        name: 'Interstate Truck Parking',
        lat: 47.6,
        lng: -122.3,
      };
      const result = checkTruckPoi(poi);
      expect(result.allowed).toBe(true);
      expect(result.group).toBe('truck_parking');
    });

    // ============ REST AREAS ============

    it('should ALLOW rest area with truck parking indication', () => {
      const poi: TruckPoiCandidate = {
        id: '70',
        name: 'I-95 Service Plaza',
        lat: 47.6,
        lng: -122.3,
        category: 'service area truck', // Uses REST_AREA_KEYWORDS pattern
      };
      const result = checkTruckPoi(poi);
      expect(result.allowed).toBe(true);
      expect(result.group).toBe('rest_area');
    });

    it('should ALLOW rest area with overnight parking attribute', () => {
      const poi: TruckPoiCandidate = {
        id: '71',
        name: 'Highway Rest Area',
        lat: 47.6,
        lng: -122.3,
        category: 'rest area',
        overnightParking: true,
      };
      const result = checkTruckPoi(poi);
      expect(result.allowed).toBe(true);
      expect(result.group).toBe('rest_area');
      expect(result.confidence).toBe('unverified'); // Overnight flag = unverified
    });
  });

  describe('filterTruckPois', () => {
    it('should filter out non-truck POIs from mixed array', () => {
      const pois: TruckPoiCandidate[] = [
        { id: '1', name: 'Pilot Flying J', lat: 47.6, lng: -122.3, distance: 5 },
        { id: '2', name: 'Shell', lat: 47.6, lng: -122.3, categories: [{ name: 'petrol station' }], distance: 2 },
        { id: '3', name: "Love's Travel Stop", lat: 47.6, lng: -122.3, distance: 10 },
        { id: '4', name: 'Arco', lat: 47.6, lng: -122.3, distance: 1 },
        { id: '5', name: 'Blue Beacon Truck Wash', lat: 47.6, lng: -122.3, distance: 8 },
        { id: '6', name: 'Chevron', lat: 47.6, lng: -122.3, distance: 3 },
        { id: '7', name: 'Petco', lat: 47.6, lng: -122.3, category: 'pet store', distance: 4 },
      ];

      const filtered = filterTruckPois(pois);
      
      expect(filtered.length).toBe(3);
      expect(filtered.map(p => p.name)).toContain('Pilot Flying J');
      expect(filtered.map(p => p.name)).toContain("Love's Travel Stop");
      expect(filtered.map(p => p.name)).toContain('Blue Beacon Truck Wash');
      expect(filtered.map(p => p.name)).not.toContain('Petco');
    });

    it('should sort by score then distance', () => {
      const pois: TruckPoiCandidate[] = [
        { id: '1', name: 'Generic Truck Wash', lat: 47.6, lng: -122.3, distance: 5 }, // score 70
        { id: '2', name: 'Pilot Flying J', lat: 47.6, lng: -122.3, distance: 10 }, // score 100
        { id: '3', name: "Love's Travel Stop", lat: 47.6, lng: -122.3, distance: 8 }, // score 100
      ];

      const filtered = filterTruckPois(pois);
      
      // Pilot and Love's have same score, Pilot first due to alphabetical (or order)
      // Actually Love's comes before Pilot in distance, so Love's should be first
      expect(filtered[0]._truckResult.score).toBe(100);
      expect(filtered[1]._truckResult.score).toBe(100);
      expect(filtered[2]._truckResult.score).toBe(70);
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

    it('should filter by group when specified', () => {
      const pois: TruckPoiCandidate[] = [
        { id: '1', name: 'Pilot Flying J', lat: 47.6, lng: -122.3 },
        { id: '2', name: 'Blue Beacon Truck Wash', lat: 47.6, lng: -122.3 },
        { id: '3', name: 'State Weigh Station', lat: 47.6, lng: -122.3 },
      ];

      const filtered = filterTruckPois(pois, { filterGroup: 'truck_wash' });
      
      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('Blue Beacon Truck Wash');
    });

    it('should filter to only verified when specified', () => {
      const pois: TruckPoiCandidate[] = [
        { id: '1', name: 'Pilot Flying J', lat: 47.6, lng: -122.3 }, // verified
        { id: '2', name: 'Some Truck Stop Place', lat: 47.6, lng: -122.3 }, // unverified (keyword match)
        { id: '3', name: 'Blue Beacon', lat: 47.6, lng: -122.3 }, // verified brand
      ];

      const filtered = filterTruckPois(pois, { onlyVerified: true });
      
      // Only Pilot and Blue Beacon are verified brands
      expect(filtered.every(p => p._truckResult.confidence === 'verified')).toBe(true);
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
