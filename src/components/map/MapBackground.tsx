import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';

interface MapBackgroundProps {
  userLocation: { lat: number; lng: number } | null;
  className?: string;
  children?: React.ReactNode;
}

const MapBackground: React.FC<MapBackgroundProps> = ({ 
  userLocation, 
  className = '',
  children 
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const userMarker = useRef<mapboxgl.Marker | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const initMap = async () => {
      try {
        // Get Mapbox token
        const { data, error: tokenError } = await supabase.functions.invoke('get_mapbox_token');
        
        if (tokenError || !data?.token) {
          throw new Error('Failed to get map token');
        }

        mapboxgl.accessToken = data.token;

        // Default center (US)
        const center = userLocation 
          ? [userLocation.lng, userLocation.lat] 
          : [-98.5795, 39.8283];

        map.current = new mapboxgl.Map({
          container: mapContainer.current!,
          style: 'mapbox://styles/mapbox/satellite-streets-v12',
          center: center as [number, number],
          zoom: userLocation ? 14 : 4,
          attributionControl: false,
          logoPosition: 'bottom-left',
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

  // Update user marker when location changes
  useEffect(() => {
    if (!map.current || !mapReady || !userLocation) return;

    // Create or update user marker
    if (!userMarker.current) {
      // Create custom blue pulsing dot
      const el = document.createElement('div');
      el.className = 'user-location-marker';
      el.innerHTML = `
        <div class="pulse-ring"></div>
        <div class="pulse-dot"></div>
      `;
      
      userMarker.current = new mapboxgl.Marker({ element: el })
        .setLngLat([userLocation.lng, userLocation.lat])
        .addTo(map.current);
    } else {
      userMarker.current.setLngLat([userLocation.lng, userLocation.lat]);
    }

    // Smoothly fly to user location
    map.current.flyTo({
      center: [userLocation.lng, userLocation.lat],
      zoom: 14,
      duration: 1500,
    });
  }, [userLocation, mapReady]);

  return (
    <div className={`relative ${className}`}>
      {/* Map Container */}
      <div 
        ref={mapContainer} 
        className="absolute inset-0 w-full h-full"
      />
      
      {/* Loading State */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-secondary/80 z-10">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Loading map...</span>
          </div>
        </div>
      )}
      
      {/* Error State */}
      {error && !loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-secondary/80 z-10">
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      )}

      {/* Overlay gradient for readability */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-background/40 via-transparent to-background/60 z-10" />
      
      {/* Children (floating elements) */}
      <div className="relative z-20 h-full">
        {children}
      </div>

      {/* Custom marker styles */}
      <style>{`
        .user-location-marker {
          position: relative;
          width: 24px;
          height: 24px;
        }
        
        .pulse-ring {
          position: absolute;
          inset: -8px;
          border-radius: 50%;
          background: hsl(var(--info) / 0.3);
          animation: pulse-ring 2s ease-out infinite;
        }
        
        .pulse-dot {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: hsl(var(--info));
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }
        
        @keyframes pulse-ring {
          0% {
            transform: scale(0.5);
            opacity: 1;
          }
          100% {
            transform: scale(2);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default MapBackground;
