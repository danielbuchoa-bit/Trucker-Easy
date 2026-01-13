import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface NearbyPoi {
  name: string;
  address: string;
  type: string;
  distance: number;
}

interface UseNearbyPoiResult {
  poi: NearbyPoi | null;
  loading: boolean;
  error: string | null;
}

export const useNearbyPoi = (lat: number | null, lng: number | null): UseNearbyPoiResult => {
  const [poi, setPoi] = useState<NearbyPoi | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastFetchRef = useRef<{ lat: number; lng: number; time: number } | null>(null);

  useEffect(() => {
    if (!lat || !lng) {
      setPoi(null);
      return;
    }

    const fetchNearbyPoi = async () => {
      // Throttle: don't fetch if we fetched recently for similar coordinates
      const now = Date.now();
      if (lastFetchRef.current) {
        const timeDiff = now - lastFetchRef.current.time;
        const latDiff = Math.abs(lat - lastFetchRef.current.lat);
        const lngDiff = Math.abs(lng - lastFetchRef.current.lng);
        
        // Skip if less than 30 seconds and less than 0.001 degree change (~100m)
        if (timeDiff < 30000 && latDiff < 0.001 && lngDiff < 0.001) {
          return;
        }
      }

      setLoading(true);
      setError(null);

      try {
        // Use HERE Browse POIs to find nearby truck stops, gas stations, etc.
        const { data, error: fnError } = await supabase.functions.invoke('here_browse_pois', {
          body: {
            lat,
            lng,
            radius: 500, // 500 meters
            categories: 'fuel-station,truck-stop,rest-area',
            limit: 1
          }
        });

        if (fnError) throw fnError;

        if (data?.items && data.items.length > 0) {
          const item = data.items[0];
          setPoi({
            name: item.title || item.name || 'Unknown',
            address: item.address?.label || formatAddress(item.address) || '',
            type: item.categories?.[0]?.name || 'Location',
            distance: item.distance || 0
          });
        } else {
          // Fallback to reverse geocode if no POI found
          const { data: geoData, error: geoError } = await supabase.functions.invoke('here_reverse_geocode', {
            body: { lat, lng }
          });

          if (geoError) throw geoError;

          if (geoData) {
            const addressParts = [];
            if (geoData.road) addressParts.push(geoData.road);
            if (geoData.city) addressParts.push(geoData.city);
            if (geoData.stateCode) addressParts.push(geoData.stateCode);

            setPoi({
              name: geoData.road || geoData.city || 'Current Location',
              address: addressParts.join(', '),
              type: 'Road',
              distance: 0
            });
          } else {
            setPoi(null);
          }
        }

        lastFetchRef.current = { lat, lng, time: now };
      } catch (err) {
        console.error('Error fetching nearby POI:', err);
        setError('Failed to get location info');
        setPoi(null);
      } finally {
        setLoading(false);
      }
    };

    fetchNearbyPoi();
  }, [lat, lng]);

  return { poi, loading, error };
};

function formatAddress(address: any): string {
  if (!address) return '';
  const parts = [];
  if (address.street) parts.push(address.street);
  if (address.city) parts.push(address.city);
  if (address.state || address.stateCode) parts.push(address.state || address.stateCode);
  if (address.postalCode) parts.push(address.postalCode);
  return parts.join(', ');
}
