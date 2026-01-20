import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import { decodePolyline } from '@/lib/polylineDecoder';
import { useDiagnosticsSafe } from '@/contexts/DiagnosticsContext';
import { useDiagnosticsTap } from '@/hooks/useDiagnosticsTap';
import { SpeedAlertWithDistance, SpeedAlertType, ALERT_TYPE_CONFIG } from '@/types/speedAlerts';

// SVG icons for alert markers
function getAlertIconSvg(type: SpeedAlertType, config: typeof ALERT_TYPE_CONFIG[SpeedAlertType]): string {
  const iconColor = 'white';
  const size = 16;
  
  switch (type) {
    case 'speed_camera':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>`;
    case 'red_light_camera':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="6" height="14" x="9" y="7" rx="1"/><circle cx="12" cy="10" r="1" fill="${iconColor}"/><circle cx="12" cy="14" r="1" fill="${iconColor}"/><circle cx="12" cy="18" r="1" fill="${iconColor}"/><path d="M4 11h5"/><path d="M15 11h5"/><path d="M12 2v5"/></svg>`;
    case 'mobile_patrol':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>`;
    case 'enforcement_zone':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>`;
    case 'school_zone':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"/></svg>`;
    case 'construction_zone':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="8" rx="1"/><path d="M17 14v7"/><path d="M7 14v7"/><path d="M17 3v3"/><path d="M7 3v3"/><path d="M10 14L2.3 6.3"/><path d="M14 6l7.7 7.7"/><path d="M8 6l8 8"/></svg>`;
    case 'average_speed':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg>`;
    case 'weigh_station':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>`;
    default:
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>`;
  }
}

interface RouteMapProps {
  routePolyline?: string;
  originLat?: number;
  originLng?: number;
  destLat?: number;
  destLng?: number;
  speedAlerts?: SpeedAlertWithDistance[];
  onAlertClick?: (alert: SpeedAlertWithDistance) => void;
  className?: string;
}

const RouteMap = ({ routePolyline, originLat, originLng, destLat, destLng, speedAlerts, onAlertClick, className }: RouteMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const originMarker = useRef<mapboxgl.Marker | null>(null);
  const destMarker = useRef<mapboxgl.Marker | null>(null);
  const userLocationMarker = useRef<mapboxgl.Marker | null>(null);
  const alertMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
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
      alertMarkersRef.current.forEach(marker => marker.remove());
      alertMarkersRef.current.clear();
      map.current?.remove();
      map.current = null;
      mapInitialized.current = false;
      initializingRef.current = false;
    };
  }, [locationStatus]);

  // Update speed alert markers
  useEffect(() => {
    if (!map.current || !mapReady) return;
    
    const currentAlerts = speedAlerts || [];
    const currentMarkers = alertMarkersRef.current;
    const currentAlertIds = new Set(currentAlerts.map(a => a.id));
    
    // Remove markers for alerts no longer in list
    currentMarkers.forEach((marker, id) => {
      if (!currentAlertIds.has(id)) {
        marker.remove();
        currentMarkers.delete(id);
      }
    });
    
    // Add or update markers for current alerts
    currentAlerts.forEach(alert => {
      if (currentMarkers.has(alert.id)) {
        // Update position if needed
        const marker = currentMarkers.get(alert.id)!;
        marker.setLngLat([alert.lng, alert.lat]);
        return;
      }
      
      // Create new marker
      const config = ALERT_TYPE_CONFIG[alert.type];
      const el = document.createElement('div');
      el.className = 'speed-alert-marker flex items-center justify-center cursor-pointer transition-transform hover:scale-110';
      el.style.width = '32px';
      el.style.height = '32px';
      
      // Get icon based on type
      const iconSvg = getAlertIconSvg(alert.type, config);
      el.innerHTML = `
        <div class="relative">
          <div class="absolute inset-0 ${config.bgColor} rounded-full opacity-30 animate-ping"></div>
          <div class="${config.bgColor} rounded-full p-1.5 shadow-lg border-2 border-white">
            ${iconSvg}
          </div>
          ${alert.speedLimit ? `
            <div class="absolute -bottom-1 -right-1 bg-white text-xs font-bold px-1 rounded shadow text-gray-900">
              ${alert.speedLimit}
            </div>
          ` : ''}
        </div>
      `;
      
      if (onAlertClick) {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onAlertClick(alert);
        });
      }
      
      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([alert.lng, alert.lat])
        .addTo(map.current!);
      
      currentMarkers.set(alert.id, marker);
    });
  }, [speedAlerts, mapReady, onAlertClick]);

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

          // Route outline/border layer - dark stroke for contrast on light maps
          map.current.addLayer({
            id: 'route-outline',
            type: 'line',
            source: 'route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': '#1e3a5f', // Dark navy blue outline
              'line-width': [
                'interpolate',
                ['linear'],
                ['zoom'],
                10, 10,  // At zoom 10: 10px width
                14, 14,  // At zoom 14: 14px width
                18, 18,  // At zoom 18: 18px width
              ],
              'line-opacity': 1,
            },
          });

          // Main route layer - bright, highly visible color
          map.current.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': '#00d4ff', // Bright cyan - high visibility in daylight
              'line-width': [
                'interpolate',
                ['linear'],
                ['zoom'],
                10, 6,   // At zoom 10: 6px width
                14, 10,  // At zoom 14: 10px width
                18, 14,  // At zoom 18: 14px width
              ],
              'line-opacity': 1,
            },
          });

          // Inner glow/highlight for extra visibility
          map.current.addLayer({
            id: 'route-highlight',
            type: 'line',
            source: 'route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': '#ffffff', // White center highlight
              'line-width': [
                'interpolate',
                ['linear'],
                ['zoom'],
                10, 2,  // At zoom 10: 2px width
                14, 3,  // At zoom 14: 3px width
                18, 4,  // At zoom 18: 4px width
              ],
              'line-opacity': 0.6,
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
