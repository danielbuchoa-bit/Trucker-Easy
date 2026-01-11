import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import { decodePolyline } from '@/lib/polylineDecoder';
import { useDiagnosticsSafe } from '@/contexts/DiagnosticsContext';
import { useDiagnosticsTap } from '@/hooks/useDiagnosticsTap';

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
  const [error, setError] = useState<string | null>(null);
  const mapInitialized = useRef(false);
  const initializingRef = useRef(false);

  // Diagnostics integration
  const diagnostics = useDiagnosticsSafe();
  const diagnosticsRef = useRef(diagnostics);
  diagnosticsRef.current = diagnostics;
  
  const handleDiagnosticsTap = useDiagnosticsTap();

  // Get user's current location - stored in ref to avoid re-renders triggering map reinit
  const userLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<'getting' | 'ready' | 'error'>('getting');

  // Request user location on mount - only once
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus('ready');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        userLocationRef.current = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setLocationStatus('ready');
      },
      (err) => {
        console.warn('[RouteMap] Geolocation error:', err.message);
        setLocationStatus('ready'); // Still ready, just without location
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }, []);

  // Initialize map ONCE when location is ready
  useEffect(() => {
    // Wait for location status
    if (locationStatus !== 'ready') return;
    
    // Prevent double initialization
    if (mapInitialized.current || initializingRef.current) return;
    if (!mapContainer.current) return;
    
    initializingRef.current = true;

    const initializeMap = async () => {
      console.log('[RouteMap] 🗺️ Architecture: Mapbox for rendering (tiles), HERE for routing/POIs');

      try {
        console.log('[RouteMap] Fetching Mapbox token...');
        const { data, error: tokenError } = await supabase.functions.invoke<{ token: string }>(
          'get_mapbox_token'
        );

        const token = data?.token;

        if (tokenError || !token) {
          const errorStatus = (tokenError as any)?.status || 'error';
          console.error('[RouteMap] ❌ MAPBOX TOKEN ERROR:', {
            status: errorStatus,
            message: tokenError?.message || 'Token not returned',
          });
          
          diagnosticsRef.current?.logMapboxCall({
            endpoint: 'get_mapbox_token',
            status: errorStatus,
            message: tokenError?.message || 'Token not returned',
          });
          
          setError('Failed to load map');
          setLoading(false);
          initializingRef.current = false;
          return;
        }

        diagnosticsRef.current?.logMapboxCall({
          endpoint: 'get_mapbox_token',
          status: 'ok',
        });

        console.log('[RouteMap] ✅ Mapbox token obtained');
        mapboxgl.accessToken = token;

        // Determine initial center
        const userLoc = userLocationRef.current;
        let initialCenter: [number, number] = [-46.6333, -23.5505]; // Fallback
        let initialZoom = 4;
        
        if (userLoc) {
          initialCenter = [userLoc.lng, userLoc.lat];
          initialZoom = 15;
        } else if (typeof originLng === 'number' && typeof originLat === 'number') {
          initialCenter = [originLng, originLat];
          initialZoom = 10;
        }

        console.log('[RouteMap] Initializing Mapbox GL map...', { 
          center: initialCenter, 
          zoom: initialZoom,
          hasUserLocation: !!userLoc,
        });

        // Ensure container is clean
        if (mapContainer.current) {
          mapContainer.current.innerHTML = '';
        }

        map.current = new mapboxgl.Map({
          container: mapContainer.current!,
          style: 'mapbox://styles/mapbox/navigation-night-v1',
          zoom: initialZoom,
          center: initialCenter,
        });

        map.current.addControl(
          new mapboxgl.NavigationControl({ visualizePitch: true }),
          'top-right'
        );

        map.current.once('load', () => {
          console.log('[RouteMap] ✅ Map loaded');
          mapInitialized.current = true;
          setMapReady(true);
          setLoading(false);
          
          // Add user location marker if available
          const loc = userLocationRef.current;
          if (loc && map.current) {
            const el = document.createElement('div');
            el.className = 'w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg animate-pulse';
            userLocationMarker.current = new mapboxgl.Marker(el)
              .setLngLat([loc.lng, loc.lat])
              .addTo(map.current);
          }
        });

        map.current.on('error', (e: any) => {
          console.error('[RouteMap] ❌ MAPBOX ERROR:', e);
          setError('Map loading error');
          setLoading(false);
        });

      } catch (e) {
        console.error('[RouteMap] ❌ INIT FAILED:', e);
        setError('Failed to initialize map');
        setLoading(false);
        initializingRef.current = false;
      }
    };

    initializeMap();

    return () => {
      originMarker.current?.remove();
      destMarker.current?.remove();
      userLocationMarker.current?.remove();
      map.current?.remove();
      map.current = null;
      mapInitialized.current = false;
      initializingRef.current = false;
    };
  }, [locationStatus]); // Only depend on locationStatus, not on props that change

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

    // Update route - supports both HERE Flexible Polyline and Google Encoded Polyline (NextBillion)
    if (routePolyline) {
      try {
        console.log('[RouteMap] 🛣️ Drawing route polyline on Mapbox');
        
        // Auto-detect and decode polyline format
        const coordinates = decodePolyline(routePolyline);

        if (coordinates.length === 0) {
          console.warn('[RouteMap] Empty coordinates from polyline');
          return;
        }

        console.log('[RouteMap] Route decoded:', coordinates.length, 'points');

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

  const isGettingLocation = locationStatus === 'getting';

  return (
    <div 
      className={`relative ${className}`}
      onClick={handleDiagnosticsTap}
    >
      <div ref={mapContainer} className="absolute inset-0" />
      {(loading || isGettingLocation) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/50 gap-2">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          {isGettingLocation && (
            <p className="text-sm text-muted-foreground">Obtendo localização atual…</p>
          )}
        </div>
      )}
    </div>
  );
};

export default RouteMap;
