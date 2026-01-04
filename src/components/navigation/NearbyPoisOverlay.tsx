import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Fuel, Truck, ParkingCircle, ChevronRight, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface NearbyPoisOverlayProps {
  lat: number | null;
  lng: number | null;
  heading: number | null;
  onNavigateTo?: (poi: Poi) => void;
}

interface Poi {
  id: string;
  name: string;
  lat: number;
  lng: number;
  distance: number;
  distanceMiles: number;
  category: 'fuel' | 'truck_stop' | 'rest_area' | 'truck_service';
  address: string;
  chainName: string | null;
  openingHours: string | null;
  contacts: string | null;
}

// HERE category IDs for truck-related POIs
const TRUCK_CATEGORIES = [
  '700-7600-0000',   // Fuel/Gas station
  '700-7600-0116',   // Truck stop
  '550-5510-0000',   // Rest area
];

const CategoryIcon: React.FC<{ category: Poi['category']; className?: string }> = ({ 
  category, 
  className = "w-5 h-5" 
}) => {
  switch (category) {
    case 'truck_stop':
      return <Truck className={`${className} text-orange-500`} />;
    case 'rest_area':
      return <ParkingCircle className={`${className} text-green-500`} />;
    case 'truck_service':
      return <Truck className={`${className} text-blue-500`} />;
    case 'fuel':
    default:
      return <Fuel className={`${className} text-amber-500`} />;
  }
};

const CategoryBadge: React.FC<{ category: Poi['category'] }> = ({ category }) => {
  const labels: Record<Poi['category'], string> = {
    fuel: 'Fuel',
    truck_stop: 'Truck Stop',
    rest_area: 'Rest Area',
    truck_service: 'Service',
  };

  const colors: Record<Poi['category'], string> = {
    fuel: 'bg-amber-500/20 text-amber-700',
    truck_stop: 'bg-orange-500/20 text-orange-700',
    rest_area: 'bg-green-500/20 text-green-700',
    truck_service: 'bg-blue-500/20 text-blue-700',
  };

  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${colors[category]}`}>
      {labels[category]}
    </span>
  );
};

const PoiCard: React.FC<{ 
  poi: Poi; 
  onClick: () => void;
  compact?: boolean;
}> = ({ poi, onClick, compact = true }) => {
  const distanceDisplay = poi.distanceMiles < 10 
    ? `${poi.distanceMiles.toFixed(1)} mi`
    : `${Math.round(poi.distanceMiles)} mi`;

  if (compact) {
    return (
      <button
        onClick={onClick}
        className="w-full bg-background/95 backdrop-blur-sm rounded-lg shadow-md p-2.5 flex items-center gap-2.5 hover:bg-accent/50 transition-colors text-left"
      >
        <div className="shrink-0 w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
          <CategoryIcon category={poi.category} className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">
            {poi.chainName || poi.name}
          </div>
          <div className="flex items-center gap-1.5">
            <CategoryBadge category={poi.category} />
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-sm font-bold text-primary">{distanceDisplay}</div>
          <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
        </div>
      </button>
    );
  }

  return null;
};

const NearbyPoisOverlay: React.FC<NearbyPoisOverlayProps> = ({ 
  lat, 
  lng, 
  heading,
  onNavigateTo 
}) => {
  const [pois, setPois] = useState<Poi[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPoi, setSelectedPoi] = useState<Poi | null>(null);
  const lastFetchRef = useRef<{ lat: number; lng: number; time: number } | null>(null);

  useEffect(() => {
    if (lat === null || lng === null) return;

    // Throttle: fetch every 15 seconds or 0.5 miles (~800m)
    const now = Date.now();
    if (lastFetchRef.current) {
      const timeDiff = now - lastFetchRef.current.time;
      const distanceMoved = Math.sqrt(
        Math.pow((lat - lastFetchRef.current.lat) * 111000, 2) +
        Math.pow((lng - lastFetchRef.current.lng) * 111000 * Math.cos(lat * Math.PI / 180), 2)
      );
      
      if (timeDiff < 15000 && distanceMoved < 800) {
        return;
      }
    }

    const fetchPois = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('here_browse_pois', {
          body: { 
            lat, 
            lng,
            heading: heading ?? undefined,
            radiusMeters: 80000, // 50 miles
            categories: TRUCK_CATEGORIES,
            limit: 10,
          },
        });

        if (!error && data?.pois) {
          lastFetchRef.current = { lat, lng, time: now };
          setPois(data.pois.slice(0, 5)); // Show max 5
        }
      } catch (err) {
        console.error('POI fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPois();
  }, [lat, lng, heading]);

  const handleNavigateTo = () => {
    if (selectedPoi && onNavigateTo) {
      onNavigateTo(selectedPoi);
      setSelectedPoi(null);
    }
  };

  if (pois.length === 0 && !loading) {
    return null;
  }

  return (
    <>
      {/* POI Cards Stack - Bottom Left */}
      <div className="absolute bottom-28 left-4 z-30 w-56 space-y-2">
        {loading && pois.length === 0 && (
          <div className="bg-background/90 backdrop-blur-sm rounded-lg p-3 text-center">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <span className="text-xs text-muted-foreground mt-1 block">Finding stops...</span>
          </div>
        )}
        
        {pois.slice(0, 4).map((poi) => (
          <PoiCard
            key={poi.id}
            poi={poi}
            onClick={() => setSelectedPoi(poi)}
          />
        ))}

        {pois.length > 0 && (
          <div className="text-center">
            <span className="text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
              {pois.length} stops ahead
            </span>
          </div>
        )}
      </div>

      {/* POI Detail Sheet */}
      <Sheet open={!!selectedPoi} onOpenChange={(open) => !open && setSelectedPoi(null)}>
        <SheetContent side="bottom" className="h-auto max-h-[50vh]">
          {selectedPoi && (
            <>
              <SheetHeader>
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center shrink-0">
                    <CategoryIcon category={selectedPoi.category} className="w-7 h-7" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <SheetTitle className="text-left truncate">
                      {selectedPoi.chainName || selectedPoi.name}
                    </SheetTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <CategoryBadge category={selectedPoi.category} />
                      <span className="text-sm font-semibold text-primary">
                        {selectedPoi.distanceMiles.toFixed(1)} mi
                      </span>
                    </div>
                  </div>
                </div>
              </SheetHeader>

              <div className="mt-4 space-y-3">
                <div className="text-sm text-muted-foreground">
                  {selectedPoi.address}
                </div>

                {selectedPoi.openingHours && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Hours: </span>
                    {selectedPoi.openingHours}
                  </div>
                )}

                {selectedPoi.contacts && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Phone: </span>
                    <a href={`tel:${selectedPoi.contacts}`} className="text-primary">
                      {selectedPoi.contacts}
                    </a>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button 
                    className="flex-1" 
                    onClick={handleNavigateTo}
                  >
                    <Navigation className="w-4 h-4 mr-2" />
                    Navigate Here
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setSelectedPoi(null)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
};

export default NearbyPoisOverlay;
