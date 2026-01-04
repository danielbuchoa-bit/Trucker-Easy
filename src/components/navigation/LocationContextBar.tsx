import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, Route } from 'lucide-react';

interface LocationContextBarProps {
  lat: number | null;
  lng: number | null;
}

interface LocationContext {
  city: string | null;
  stateCode: string | null;
  road: string | null;
}

const LocationContextBar: React.FC<LocationContextBarProps> = ({ lat, lng }) => {
  const [context, setContext] = useState<LocationContext>({
    city: null,
    stateCode: null,
    road: null,
  });
  const [loading, setLoading] = useState(false);
  const lastFetchRef = useRef<{ lat: number; lng: number; time: number } | null>(null);

  useEffect(() => {
    if (lat === null || lng === null) return;

    // Throttle: only fetch every 30 seconds or 0.5 miles (~800m)
    const now = Date.now();
    if (lastFetchRef.current) {
      const timeDiff = now - lastFetchRef.current.time;
      const distanceMoved = Math.sqrt(
        Math.pow((lat - lastFetchRef.current.lat) * 111000, 2) +
        Math.pow((lng - lastFetchRef.current.lng) * 111000 * Math.cos(lat * Math.PI / 180), 2)
      );
      
      if (timeDiff < 30000 && distanceMoved < 800) {
        return;
      }
    }

    const fetchContext = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('here_reverse_geocode', {
          body: { lat, lng },
        });

        if (!error && data) {
          lastFetchRef.current = { lat, lng, time: now };
          setContext({
            city: data.city || data.district || null,
            stateCode: data.stateCode || null,
            road: data.road || null,
          });
        }
      } catch (err) {
        console.error('Reverse geocode error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchContext();
  }, [lat, lng]);

  // Format road name - try to extract route number
  const formatRoad = (road: string | null): string => {
    if (!road) return '-';
    
    // Common patterns: I-80, US-191, SR-89, Hwy 101
    const patterns = [
      /\b(I-\d+)\b/i,           // Interstate
      /\b(US-\d+)\b/i,          // US Highway
      /\b(SR-\d+)\b/i,          // State Route
      /\b(Hwy\s*\d+)\b/i,       // Highway
      /\b(Route\s*\d+)\b/i,     // Route
    ];

    for (const pattern of patterns) {
      const match = road.match(pattern);
      if (match) return match[1].toUpperCase();
    }

    // If no pattern matched, return first part of road name (max 20 chars)
    return road.length > 20 ? road.substring(0, 20) + '...' : road;
  };

  const cityDisplay = context.city 
    ? `Near ${context.city}${context.stateCode ? `, ${context.stateCode}` : ''}`
    : 'Location unknown';

  return (
    <div className="absolute top-4 left-4 right-20 z-30">
      <div className="bg-background/90 backdrop-blur-sm rounded-lg shadow-lg px-3 py-2 flex items-center gap-3">
        {/* City */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <MapPin className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm font-medium truncate">
            {loading ? '...' : cityDisplay}
          </span>
        </div>
        
        {/* Road/Route */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Route className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
            {formatRoad(context.road)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default LocationContextBar;
