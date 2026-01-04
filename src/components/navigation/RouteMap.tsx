import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import { decodeHereFlexiblePolyline } from '@/lib/hereFlexiblePolyline';

interface RouteMapProps {
  routePolyline?: string;
  originLat?: number;
  originLng?: number;
  destLat?: number;
  destLng?: number;
  className?: string;
}

const RouteMap = ({ routePolyline, originLat, originLng, destLat, destLng, className }: RouteMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const originMarker = useRef<mapboxgl.Marker | null>(null);
  const destMarker = useRef<mapboxgl.Marker | null>(null);
  const userLocationMarker = useRef<mapboxgl.Marker | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [gettingLocation, setGettingLocation] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mapInitialized = useRef(false);

  // Get user's current location
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Request user location on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setGettingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setGettingLocation(false);
      },
      (err) => {
        console.warn('[RouteMap] Geolocation error:', err.message);
        setGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }, []);

  // Determine initial center: user location > origin > fallback
  const getInitialCenter = useCallback((): [number, number] => {
    if (userLocation) {
      return [userLocation.lng, userLocation.lat];
    }
    if (typeof originLng === 'number' && typeof originLat === 'number') {
      return [originLng, originLat];
    }
    return [-46.6333, -23.5505]; // Fallback
  }, [userLocation, originLat, originLng]);

  const initializeMap = useCallback(async () => {
    if (!mapContainer.current || mapInitialized.current) return;
    mapInitialized.current = true;

    console.log('[RouteMap] 🗺️ Architecture: Mapbox for rendering (tiles), HERE for routing/POIs');

    try {
      console.log('[RouteMap] Fetching Mapbox token...');
      const { data, error: tokenError } = await supabase.functions.invoke<{ token: string }>(
        'get_mapbox_token'
      );

      const token = data?.token;

      if (tokenError || !token) {
        console.error('[RouteMap] ❌ MAPBOX TOKEN ERROR:', {
          status: tokenError?.status || 'N/A',
          message: tokenError?.message || 'Token not returned',
          endpoint: 'get_mapbox_token',
          service: 'Mapbox (Tiles/Rendering)',
        });
        
        if (tokenError?.status === 401 || tokenError?.status === 403) {
          console.error('[RouteMap] 🔐 AUTH ISSUE: Mapbox token retrieval failed - check MAPBOX_PUBLIC_TOKEN secret');
        }
        
        setError('Failed to load map');
        setLoading(false);
        return;
      }

      console.log('[RouteMap] ✅ Mapbox token obtained');
      mapboxgl.accessToken = token;

      // Ensure container is empty
      mapContainer.current.innerHTML = '';

      const initialCenter = getInitialCenter();
      const initialZoom = userLocation ? 15 : 4;

      console.log('[RouteMap] Initializing Mapbox GL map...', { 
        center: initialCenter, 
        zoom: initialZoom,
        style: 'navigation-night-v1',
      });

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/navigation-night-v1',
        zoom: initialZoom,
        center: initialCenter,
      });

      map.current.addControl(
        new mapboxgl.NavigationControl({ visualizePitch: true }),
        'top-right'
      );

      const markReady = () => {
        console.log('[RouteMap] ✅ Map ready - Mapbox tiles loaded');
        setMapReady(true);
        setLoading(false);
      };

      map.current.once('load', markReady);
      map.current.once('idle', markReady);

      map.current.on('error', (e: any) => {
        console.error('[RouteMap] ❌ MAPBOX ERROR:', {
          message: e.error?.message || e.message || 'Unknown error',
          status: e.error?.status || 'N/A',
          service: 'Mapbox (Tiles/Rendering)',
        });
        
        const status = e.error?.status;
        if (status === 401 || status === 403) {
          console.error('[RouteMap] 🔐 AUTH ISSUE: Mapbox tiles access denied - verify token permissions');
        }
        
        setError('Map loading error');
        setLoading(false);
      });
    } catch (e) {
      console.error('[RouteMap] ❌ INIT FAILED:', e);
      setError('Failed to initialize map');
      setLoading(false);
    }
  }, [getInitialCenter, userLocation]);

  // Initialize map after we have location (or timeout)
  useEffect(() => {
    if (!gettingLocation) {
      initializeMap();
    }

    return () => {
      originMarker.current?.remove();
      destMarker.current?.remove();
      userLocationMarker.current?.remove();
      map.current?.remove();
      map.current = null;
      mapInitialized.current = false;
      if (mapContainer.current) mapContainer.current.innerHTML = '';
    };
  }, [gettingLocation, initializeMap]);

  // Center on user location when it becomes available (after map ready)
  useEffect(() => {
    if (!map.current || !mapReady || !userLocation) return;
    
    const hasOrigin = typeof originLat === 'number' && typeof originLng === 'number';
    const hasDest = typeof destLat === 'number' && typeof destLng === 'number';
    
    // Update user location marker
    if (userLocationMarker.current) {
      userLocationMarker.current.setLngLat([userLocation.lng, userLocation.lat]);
    } else {
      const el = document.createElement('div');
      el.className = 'w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg animate-pulse';
      userLocationMarker.current = new mapboxgl.Marker(el)
        .setLngLat([userLocation.lng, userLocation.lat])
        .addTo(map.current);
    }
    
    // Center map on user location if no route/origin/dest set
    if (!hasOrigin && !hasDest && !routePolyline) {
      map.current.easeTo({
        center: [userLocation.lng, userLocation.lat],
        zoom: 15,
        duration: 800,
      });
    }
  }, [userLocation, mapReady, originLat, originLng, destLat, destLng, routePolyline]);

  // Update markers and route when props change
  useEffect(() => {
    if (!map.current || !mapReady) return;

    const hasOrigin = typeof originLat === 'number' && typeof originLng === 'number';
    const hasDest = typeof destLat === 'number' && typeof destLng === 'number';

    // Update origin marker
    if (hasOrigin) {
      if (originMarker.current) {
        originMarker.current.setLngLat([originLng, originLat]);
      } else {
        const el = document.createElement('div');
        el.className = 'w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-lg';
        originMarker.current = new mapboxgl.Marker(el)
          .setLngLat([originLng, originLat])
          .addTo(map.current);
      }
    }

    // Update destination marker
    if (hasDest) {
      if (destMarker.current) {
        destMarker.current.setLngLat([destLng, destLat]);
      } else {
        const el = document.createElement('div');
        el.className = 'w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-lg';
        destMarker.current = new mapboxgl.Marker(el)
          .setLngLat([destLng, destLat])
          .addTo(map.current);
      }
    }

    // Keep the camera on pins before a route is calculated
    if (!routePolyline) {
      if (hasOrigin && hasDest) {
        const bounds = new mapboxgl.LngLatBounds([originLng, originLat], [originLng, originLat]);
        bounds.extend([destLng, destLat]);
        map.current.fitBounds(bounds, { padding: 50, duration: 600 });
      } else if (hasOrigin) {
        map.current.easeTo({ center: [originLng, originLat], zoom: 10, duration: 600 });
      } else if (hasDest) {
        map.current.easeTo({ center: [destLng, destLat], zoom: 10, duration: 600 });
      }
    }

    // Update route (from HERE Routing API)
    if (routePolyline) {
      try {
        console.log('[RouteMap] 🛣️ Drawing route from HERE polyline on Mapbox');
        const coordinates = decodeHereFlexiblePolyline(routePolyline);

        if (coordinates.length === 0) {
          console.warn('[RouteMap] Empty coordinates from HERE polyline');
          return;
        }

        console.log('[RouteMap] Route coordinates:', coordinates.length, 'points');

        const source = map.current.getSource('route') as mapboxgl.GeoJSONSource | undefined;

        const geojson: GeoJSON.Feature = {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates,
          },
        };

        if (source) {
          source.setData(geojson);
        } else {
          map.current.addSource('route', {
            type: 'geojson',
            data: geojson,
          });

          map.current.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': '#3b82f6',
              'line-width': 5,
              'line-opacity': 0.8,
            },
          });
        }

        // Fit bounds to route
        const bounds = coordinates.reduce((b, coord) => {
          return b.extend(coord as mapboxgl.LngLatLike);
        }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));

        map.current.fitBounds(bounds, { padding: 50 });
        console.log('[RouteMap] ✅ Route drawn on Mapbox');
      } catch (e) {
        console.error('[RouteMap] ❌ Error rendering route on map:', e);
        setError('Erro ao desenhar a rota no mapa');
      }
    }
  }, [routePolyline, originLat, originLng, destLat, destLng, mapReady]);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-muted ${className}`}>
        <p className="text-muted-foreground text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div ref={mapContainer} className="absolute inset-0" />
      {(loading || gettingLocation) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/50 gap-2">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          {gettingLocation && (
            <p className="text-sm text-muted-foreground">Obtendo localização atual…</p>
          )}
        </div>
      )}
    </div>
  );
};

export default RouteMap;
