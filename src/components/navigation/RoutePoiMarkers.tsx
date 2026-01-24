import React, { useEffect, useRef, useCallback, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { supabase } from '@/integrations/supabase/client';
import { detectBrand, MAJOR_TRUCK_STOP_BRANDS } from '@/lib/truckBrands';

export interface RoutePoi {
  id: string;
  name: string;
  lat: number;
  lng: number;
  distance: number;
  poiType: 'truckStop' | 'restArea' | 'weighStation' | 'truckWash';
  truckFriendlyConfidence?: 'confirmed' | 'likely' | 'unknown';
}

interface RoutePoiMarkersProps {
  map: mapboxgl.Map | null;
  mapReady: boolean;
  routeCoords: [number, number][];
  userLat: number | null;
  userLng: number | null;
  onPoiClick?: (poi: RoutePoi) => void;
  enabled?: boolean;
}

// Icons for each POI type
const POI_ICONS: Record<string, { svg: string; bgColor: string; size: number }> = {
  truckStop: {
    bgColor: '#ef4444', // red
    size: 36,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>`,
  },
  restArea: {
    bgColor: '#3b82f6', // blue
    size: 32,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>`,
  },
  weighStation: {
    bgColor: '#f59e0b', // amber
    size: 32,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>`,
  },
  truckWash: {
    bgColor: '#06b6d4', // cyan
    size: 32,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>`,
  },
};

// Calculate distance from a point to the nearest point on the route
function distanceToRoute(
  lat: number, 
  lng: number, 
  routeCoords: [number, number][]
): number {
  if (routeCoords.length === 0) return Infinity;
  
  let minDist = Infinity;
  for (const [routeLng, routeLat] of routeCoords) {
    const dist = Math.sqrt(
      Math.pow((lat - routeLat) * 111000, 2) +
      Math.pow((lng - routeLng) * 111000 * Math.cos(lat * Math.PI / 180), 2)
    );
    if (dist < minDist) minDist = dist;
  }
  return minDist;
}

const RoutePoiMarkers: React.FC<RoutePoiMarkersProps> = ({
  map,
  mapReady,
  routeCoords,
  userLat,
  userLng,
  onPoiClick,
  enabled = true,
}) => {
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const lastFetchRef = useRef<{ lat: number; lng: number; time: number } | null>(null);
  const [pois, setPois] = useState<RoutePoi[]>([]);

  // Fetch POIs along route
  const fetchPois = useCallback(async () => {
    if (!userLat || !userLng || routeCoords.length === 0) return;

    const now = Date.now();
    
    // Throttle: don't fetch if we fetched recently
    if (lastFetchRef.current) {
      const timeDiff = now - lastFetchRef.current.time;
      const distanceMoved = Math.sqrt(
        Math.pow((userLat - lastFetchRef.current.lat) * 111000, 2) +
        Math.pow((userLng - lastFetchRef.current.lng) * 111000 * Math.cos(userLat * Math.PI / 180), 2)
      );
      
      // Skip if less than 30 seconds and less than 1600m (~1 mile)
      if (timeDiff < 30000 && distanceMoved < 1600) {
        return;
      }
    }

    lastFetchRef.current = { lat: userLat, lng: userLng, time: now };

    try {
      // Fetch all POI types in parallel
      const [truckStopsResult, weighStationsResult, restAreasResult] = await Promise.all([
        // Truck stops
        supabase.functions.invoke('nb_browse_pois', {
          body: { 
            lat: userLat, 
            lng: userLng,
            radiusMeters: 80467, // 50 miles
            filterType: 'truckStops',
            limit: 30,
          },
        }),
        // Weigh stations
        supabase.functions.invoke('nb_browse_pois', {
          body: { 
            lat: userLat, 
            lng: userLng,
            radiusMeters: 80467, // 50 miles
            filterType: 'weighStations',
            limit: 20,
          },
        }),
        // Rest areas
        supabase.functions.invoke('nb_browse_pois', {
          body: { 
            lat: userLat, 
            lng: userLng,
            radiusMeters: 80467, // 50 miles
            filterType: 'restAreas',
            limit: 20,
          },
        }),
      ]);

      const allPois: RoutePoi[] = [];
      const seenIds = new Set<string>();

      // Process truck stops
      if (truckStopsResult.data?.pois) {
        truckStopsResult.data.pois.forEach((poi: any) => {
          // Only include major brands
          const brand = detectBrand(poi.name || poi.title, null);
          if (!brand || !MAJOR_TRUCK_STOP_BRANDS.includes(brand.key)) return;
          
          const id = poi.id || `ts-${poi.lat}-${poi.lng}`;
          if (seenIds.has(id)) return;
          seenIds.add(id);
          
          // Check if near route (within 3 miles)
          const distToRoute = distanceToRoute(poi.lat, poi.lng, routeCoords);
          if (distToRoute > 4828) return; // 3 miles
          
          allPois.push({
            id,
            name: poi.name || poi.title,
            lat: poi.lat,
            lng: poi.lng,
            distance: poi.distance,
            poiType: 'truckStop',
            truckFriendlyConfidence: poi.truckFriendlyConfidence,
          });
        });
      }

      // Process weigh stations
      if (weighStationsResult.data?.pois) {
        weighStationsResult.data.pois.forEach((poi: any) => {
          const id = poi.id || `ws-${poi.lat}-${poi.lng}`;
          if (seenIds.has(id)) return;
          seenIds.add(id);
          
          // Weigh stations within 5 miles of route
          const distToRoute = distanceToRoute(poi.lat, poi.lng, routeCoords);
          if (distToRoute > 8047) return; // 5 miles
          
          allPois.push({
            id,
            name: poi.name || poi.title,
            lat: poi.lat,
            lng: poi.lng,
            distance: poi.distance,
            poiType: 'weighStation',
            truckFriendlyConfidence: 'confirmed',
          });
        });
      }

      // Process rest areas
      if (restAreasResult.data?.pois) {
        restAreasResult.data.pois.forEach((poi: any) => {
          const id = poi.id || `ra-${poi.lat}-${poi.lng}`;
          if (seenIds.has(id)) return;
          seenIds.add(id);
          
          // Rest areas within 3 miles of route
          const distToRoute = distanceToRoute(poi.lat, poi.lng, routeCoords);
          if (distToRoute > 4828) return; // 3 miles
          
          allPois.push({
            id,
            name: poi.name || poi.title,
            lat: poi.lat,
            lng: poi.lng,
            distance: poi.distance,
            poiType: 'restArea',
            truckFriendlyConfidence: poi.truckFriendlyConfidence || 'likely',
          });
        });
      }

      console.log(`[RoutePoiMarkers] Found ${allPois.length} POIs along route`);
      setPois(allPois);

    } catch (err) {
      console.error('[RoutePoiMarkers] Error fetching POIs:', err);
    }
  }, [userLat, userLng, routeCoords]);

  // Fetch POIs when position changes
  useEffect(() => {
    if (!enabled) return;
    fetchPois();
  }, [fetchPois, enabled]);

  // Update markers on map
  useEffect(() => {
    if (!map || !mapReady || !enabled) return;

    const currentMarkers = markersRef.current;
    const currentPoiIds = new Set(pois.map(p => p.id));

    // Remove markers for POIs no longer in list
    currentMarkers.forEach((marker, id) => {
      if (!currentPoiIds.has(id)) {
        marker.remove();
        currentMarkers.delete(id);
      }
    });

    // Add or update markers
    pois.forEach((poi) => {
      if (currentMarkers.has(poi.id)) {
        // Update existing marker position
        const marker = currentMarkers.get(poi.id)!;
        marker.setLngLat([poi.lng, poi.lat]);
        return;
      }

      // Create new marker
      const iconConfig = POI_ICONS[poi.poiType] || POI_ICONS.truckStop;
      const el = document.createElement('div');
      el.className = 'route-poi-marker cursor-pointer transition-transform hover:scale-110';
      el.style.width = `${iconConfig.size}px`;
      el.style.height = `${iconConfig.size}px`;
      
      el.innerHTML = `
        <div class="relative">
          <div style="
            width: ${iconConfig.size}px;
            height: ${iconConfig.size}px;
            background-color: ${iconConfig.bgColor};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          ">
            ${iconConfig.svg}
          </div>
        </div>
      `;

      // Click handler
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onPoiClick?.(poi);
      });

      const marker = new mapboxgl.Marker({ 
        element: el, 
        anchor: 'center',
      })
        .setLngLat([poi.lng, poi.lat])
        .addTo(map);

      currentMarkers.set(poi.id, marker);
    });

  }, [map, mapReady, pois, enabled, onPoiClick]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current.clear();
    };
  }, []);

  return null; // This component manages Mapbox markers directly
};

export default RoutePoiMarkers;
