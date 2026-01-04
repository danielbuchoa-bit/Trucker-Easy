import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Fuel, Truck, ParkingCircle, ChevronRight, Navigation, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

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

// Export Poi type for use in arrival detection
export type { Poi };

interface NearbyPoisOverlayProps {
  lat: number | null;
  lng: number | null;
  heading: number | null;
  onNavigateTo?: (poi: Poi) => void;
  onPoisUpdate?: (pois: Poi[]) => void;
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
      return <Truck className={`${className} text-orange-400`} />;
    case 'rest_area':
      return <ParkingCircle className={`${className} text-blue-400`} />;
    case 'truck_service':
      return <Scale className={`${className} text-purple-400`} />;
    case 'fuel':
    default:
      return <Fuel className={`${className} text-amber-400`} />;
  }
};

// Trucker Path style POI card with colored distance badge
const PoiCard: React.FC<{ 
  poi: Poi; 
  onClick: () => void;
  color: 'green' | 'teal' | 'orange' | 'red';
}> = ({ poi, onClick, color }) => {
  const distanceDisplay = poi.distanceMiles < 10 
    ? `${poi.distanceMiles.toFixed(0)}` 
    : `${Math.round(poi.distanceMiles)}`;

  const colorClasses = {
    green: 'bg-success text-success-foreground',
    teal: 'bg-info text-info-foreground',
    orange: 'bg-warning text-warning-foreground',
    red: 'bg-destructive text-destructive-foreground',
  };

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 text-left group"
    >
      {/* Distance badge - Trucker Path style */}
      <div className={`flex flex-col items-center justify-center min-w-[52px] px-2 py-1.5 rounded-lg ${colorClasses[color]}`}>
        <div className="flex items-center gap-0.5">
          <CategoryIcon category={poi.category} className="w-4 h-4" />
          {poi.chainName?.toLowerCase().includes("love") && (
            <span className="text-xs">❤️</span>
          )}
        </div>
        <span className="text-lg font-black leading-none">{distanceDisplay}</span>
        <span className="text-[10px] font-semibold leading-none">mi</span>
      </div>
    </button>
  );
};

const NearbyPoisOverlay: React.FC<NearbyPoisOverlayProps> = ({ 
  lat, 
  lng, 
  heading,
  onNavigateTo,
  onPoisUpdate,
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
          const allPois = data.pois.slice(0, 10);
          setPois(allPois.slice(0, 5));
          
          // Notify parent for arrival detection
          if (onPoisUpdate) {
            onPoisUpdate(allPois.map((p: Poi) => ({
              id: p.id,
              name: p.chainName || p.name,
              category: p.category,
              lat: p.lat,
              lng: p.lng,
              distance: p.distance,
              address: p.address,
            })));
          }
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

  // Get color based on distance
  const getPoiColor = (distanceMiles: number): 'green' | 'teal' | 'orange' | 'red' => {
    if (distanceMiles <= 10) return 'green';
    if (distanceMiles <= 25) return 'teal';
    if (distanceMiles <= 40) return 'orange';
    return 'red';
  };

  if (pois.length === 0 && !loading) {
    return null;
  }

  return (
    <>
      {/* POI Cards Stack - Left side, vertically stacked */}
      <div className="absolute top-32 left-4 z-30 flex flex-col gap-2 safe-top">
        {loading && pois.length === 0 && (
          <div className="bg-card/90 backdrop-blur-sm rounded-lg px-3 py-2 text-center">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        )}
        
        {pois.slice(0, 4).map((poi) => (
          <PoiCard
            key={poi.id}
            poi={poi}
            onClick={() => setSelectedPoi(poi)}
            color={getPoiColor(poi.distanceMiles)}
          />
        ))}
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
