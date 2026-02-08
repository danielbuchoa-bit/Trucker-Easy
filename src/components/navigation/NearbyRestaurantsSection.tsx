import React, { useEffect, useState } from 'react';
import { Utensils, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  lat: number;
  lng: number;
  poiId: string;
}

const NearbyRestaurantsSection: React.FC<Props> = ({ lat, lng, poiId }) => {
  const [restaurants, setRestaurants] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      setLoading(true);
      try {
        const { data } = await supabase.functions.invoke('nearby_restaurants', {
          body: { lat, lng, radiusMeters: 500 },
        });
        if (!cancelled) {
          setRestaurants(data?.restaurants || []);
        }
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetch();
    return () => { cancelled = true; };
  }, [lat, lng, poiId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Buscando restaurantes...</span>
      </div>
    );
  }

  return (
    <div className="p-3 bg-muted/50 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <Utensils className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium">Restaurantes</span>
      </div>
      {restaurants.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {restaurants.slice(0, 6).map((name, idx) => (
            <Badge key={idx} variant="secondary" className="text-xs">
              {name}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Desconhecido</p>
      )}
    </div>
  );
};

export default NearbyRestaurantsSection;
