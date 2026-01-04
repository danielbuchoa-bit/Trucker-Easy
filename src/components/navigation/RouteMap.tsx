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

// Polyline decoding moved to src/lib/hereFlexiblePolyline.ts (official HERE decoder)


const RouteMap = ({ routePolyline, originLat, originLng, destLat, destLng, className }: RouteMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const originMarker = useRef<mapboxgl.Marker | null>(null);
  const destMarker = useRef<mapboxgl.Marker | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const initializeMap = useCallback(async () => {
    if (!mapContainer.current || map.current) return;

    try {
      console.log('Fetching Mapbox token...');
      const { data, error: tokenError } = await supabase.functions.invoke('get_mapbox_token');
      
      console.log('Mapbox token response:', { data, error: tokenError });
      
      if (tokenError) {
        setError('Failed to load map');
        console.error('Mapbox token error:', tokenError);
        return;
      }
      
      if (!data?.token) {
        setError('Mapbox token not configured');
        console.error('No token in response:', data);
        return;
      }

      mapboxgl.accessToken = data.token;
      
      const centerLng = originLng ?? -46.6333;
      const centerLat = originLat ?? -23.5505;
      
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/navigation-night-v1',
        zoom: 4,
        center: [centerLng, centerLat],
      });

      map.current.addControl(
        new mapboxgl.NavigationControl({ visualizePitch: true }),
        'top-right'
      );

      const markReady = () => {
        setMapReady(true);
        setLoading(false);
      };

      map.current.once('load', () => {
        console.log('Map loaded successfully');
        markReady();
      });

      // Fallback: some environments emit 'idle' before 'load'
      map.current.once('idle', () => {
        console.log('Map idle');
        markReady();
      });
      
      map.current.on('error', (e) => {
        console.error('Map error:', e);
        setError('Map loading error');
        setLoading(false);
      });

    } catch (err) {
      console.error('Map initialization error:', err);
      setError('Failed to initialize map');
      setLoading(false);
    }
  }, [originLat, originLng]);

  useEffect(() => {
    initializeMap();

    return () => {
      originMarker.current?.remove();
      destMarker.current?.remove();
      map.current?.remove();
      map.current = null;
    };
  }, [initializeMap]);

  // Update markers and route when props change
  useEffect(() => {
    if (!map.current || !mapReady) return;

    // Update origin marker
    if (typeof originLat === 'number' && typeof originLng === 'number') {
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
    if (typeof destLat === 'number' && typeof destLng === 'number') {
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

    // Update route
    if (routePolyline) {
      try {
        const coordinates = decodeHereFlexiblePolyline(routePolyline);

        if (coordinates.length === 0) return;

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
      } catch (e) {
        console.error('Error rendering route on map:', e);
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
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
};

export default RouteMap;
