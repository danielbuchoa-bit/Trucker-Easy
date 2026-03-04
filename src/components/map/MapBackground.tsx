import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';

interface MapBackgroundProps {
  userLocation: { lat: number; lng: number } | null;
  className?: string;
  children?: React.ReactNode;
  onCityDetected?: (city: string) => void;
}

const MapBackground: React.FC<MapBackgroundProps> = ({ 
  userLocation, 
  className = '',
  children,
  onCityDetected,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const userMarker = useRef<mapboxgl.Marker | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastReverseGeocode = useRef<string>('');

  // Initialize map with 3D globe
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const initMap = async () => {
      try {
        const { data, error: tokenError } = await supabase.functions.invoke('get_mapbox_token');
        
        if (tokenError || !data?.token) {
          throw new Error('Failed to get map token');
        }

        mapboxgl.accessToken = data.token;

        const center = userLocation 
          ? [userLocation.lng, userLocation.lat] 
          : [-98.5795, 39.8283];

        map.current = new mapboxgl.Map({
          container: mapContainer.current!,
          style: 'mapbox://styles/mapbox/satellite-streets-v12',
          center: center as [number, number],
          zoom: userLocation ? 14 : 3,
          pitch: 45,
          bearing: 0,
          projection: 'globe',
          attributionControl: false,
          logoPosition: 'bottom-left',
          antialias: true,
        });

        map.current.on('style.load', () => {
          if (!map.current) return;
          
          // 3D terrain
          map.current.addSource('mapbox-dem', {
            type: 'raster-dem',
            url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
            tileSize: 512,
            maxzoom: 14,
          });
          map.current.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });

          // Atmosphere / sky
          map.current.setFog({
            color: 'rgb(186, 210, 235)',
            'high-color': 'rgb(36, 92, 223)',
            'horizon-blend': 0.02,
            'space-color': 'rgb(11, 11, 25)',
            'star-intensity': 0.6,
          });
        });

        map.current.on('load', () => {
          setMapReady(true);
          setLoading(false);
        });

        map.current.on('error', (e) => {
          console.error('Map error:', e);
          setError('Map failed to load');
          setLoading(false);
        });

      } catch (err) {
        console.error('Map init error:', err);
        setError('Could not initialize map');
        setLoading(false);
      }
    };

    initMap();

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Update user marker + reverse geocode city
  useEffect(() => {
    if (!map.current || !mapReady || !userLocation) return;

    // Create or update truck arrow marker
    if (!userMarker.current) {
      const el = document.createElement('div');
      el.className = 'truck-arrow-marker';
      el.innerHTML = `
        <div class="truck-pulse-ring"></div>
        <div class="truck-arrow">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L4 20L12 16L20 20L12 2Z" fill="hsl(var(--primary))" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
          </svg>
        </div>
      `;
      
      userMarker.current = new mapboxgl.Marker({ 
        element: el,
        rotationAlignment: 'map',
        pitchAlignment: 'map',
      })
        .setLngLat([userLocation.lng, userLocation.lat])
        .addTo(map.current);
    } else {
      userMarker.current.setLngLat([userLocation.lng, userLocation.lat]);
    }

    // Fly to user
    map.current.flyTo({
      center: [userLocation.lng, userLocation.lat],
      zoom: 14,
      pitch: 45,
      duration: 1500,
    });

    // Reverse geocode for city detection
    const coordKey = `${userLocation.lat.toFixed(2)},${userLocation.lng.toFixed(2)}`;
    if (onCityDetected && coordKey !== lastReverseGeocode.current) {
      lastReverseGeocode.current = coordKey;
      supabase.functions.invoke('nb_reverse_geocode', {
        body: { lat: userLocation.lat, lng: userLocation.lng },
      }).then(({ data }) => {
        if (data?.city || data?.address?.city) {
          const city = data.city || data.address?.city;
          const state = data.state || data.address?.state || '';
          const country = data.country || data.address?.countryName || '';
          const label = [city, state, country].filter(Boolean).join(', ');
          onCityDetected(label);
        }
      }).catch(() => {});
    }
  }, [userLocation, mapReady, onCityDetected]);

  return (
    <div className={`relative ${className}`}>
      <div 
        ref={mapContainer} 
        className="absolute inset-0 w-full h-full"
      />
      
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-secondary/80 z-10">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Loading 3D map...</span>
          </div>
        </div>
      )}
      
      {error && !loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-secondary/80 z-10">
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      )}

      {/* Overlay gradient */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-background/30 via-transparent to-background/50 z-10" />
      
      {/* Children */}
      <div className="relative z-20 h-full">
        {children}
      </div>

      <style>{`
        .truck-arrow-marker {
          position: relative;
          width: 32px;
          height: 32px;
        }
        
        .truck-pulse-ring {
          position: absolute;
          inset: -10px;
          border-radius: 50%;
          background: hsl(var(--primary) / 0.25);
          animation: truck-pulse 2s ease-out infinite;
        }
        
        .truck-arrow {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.5));
        }
        
        .truck-arrow svg {
          width: 28px;
          height: 28px;
        }
        
        @keyframes truck-pulse {
          0% { transform: scale(0.6); opacity: 1; }
          100% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default MapBackground;
