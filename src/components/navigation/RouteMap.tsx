import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';

interface RouteMapProps {
  routePolyline?: string;
  originLat?: number;
  originLng?: number;
  destLat?: number;
  destLng?: number;
  className?: string;
}

// Decode HERE flexible polyline format
function decodeFlexiblePolyline(encoded: string): [number, number][] {
  const coordinates: [number, number][] = [];
  
  if (!encoded) return coordinates;
  
  // Simple polyline decoding (HERE uses flexible polyline format)
  // This is a simplified decoder - for production use the official library
  try {
    let index = 0;
    let lat = 0;
    let lng = 0;
    
    // Skip header byte
    if (encoded.length > 0) {
      const header = encoded.charCodeAt(0) - 63;
      const precision = header & 15;
      const thirdDim = (header >> 4) & 7;
      const thirdDimPrecision = (header >> 7) & 15;
      index = 1;
      
      const factor = Math.pow(10, precision);
      
      while (index < encoded.length) {
        let result = 0;
        let shift = 0;
        let b;
        
        do {
          b = encoded.charCodeAt(index++) - 63;
          result |= (b & 0x1f) << shift;
          shift += 5;
        } while (b >= 0x20 && index < encoded.length);
        
        lat += ((result & 1) ? ~(result >> 1) : (result >> 1));
        
        result = 0;
        shift = 0;
        
        do {
          b = encoded.charCodeAt(index++) - 63;
          result |= (b & 0x1f) << shift;
          shift += 5;
        } while (b >= 0x20 && index < encoded.length);
        
        lng += ((result & 1) ? ~(result >> 1) : (result >> 1));
        
        // Skip third dimension if present
        if (thirdDim !== 0) {
          result = 0;
          shift = 0;
          do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
          } while (b >= 0x20 && index < encoded.length);
        }
        
        coordinates.push([lng / factor, lat / factor]);
      }
    }
  } catch (e) {
    console.error('Error decoding polyline:', e);
  }
  
  return coordinates;
}

const RouteMap = ({ routePolyline, originLat, originLng, destLat, destLng, className }: RouteMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const originMarker = useRef<mapboxgl.Marker | null>(null);
  const destMarker = useRef<mapboxgl.Marker | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initializeMap = useCallback(async () => {
    if (!mapContainer.current || map.current) return;

    try {
      const { data, error: tokenError } = await supabase.functions.invoke('get_mapbox_token');
      
      if (tokenError || !data?.token) {
        setError('Failed to load map');
        console.error('Mapbox token error:', tokenError);
        return;
      }

      mapboxgl.accessToken = data.token;
      
      const centerLng = originLng || -46.6333;
      const centerLat = originLat || -23.5505;
      
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        zoom: 10,
        center: [centerLng, centerLat],
      });

      map.current.addControl(
        new mapboxgl.NavigationControl({ visualizePitch: true }),
        'top-right'
      );

      map.current.on('load', () => {
        setMapReady(true);
      });

    } catch (err) {
      console.error('Map initialization error:', err);
      setError('Failed to initialize map');
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
    if (originLat && originLng) {
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
    if (destLat && destLng) {
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
      const coordinates = decodeFlexiblePolyline(routePolyline);
      
      if (coordinates.length > 0) {
        const source = map.current.getSource('route') as mapboxgl.GeoJSONSource;
        
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
        const bounds = coordinates.reduce((bounds, coord) => {
          return bounds.extend(coord as mapboxgl.LngLatLike);
        }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));

        map.current.fitBounds(bounds, { padding: 50 });
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
      <div ref={mapContainer} className="absolute inset-0 rounded-xl overflow-hidden" />
    </div>
  );
};

export default RouteMap;
