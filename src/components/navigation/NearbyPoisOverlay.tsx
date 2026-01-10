import React, { useEffect, useState, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Navigation, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { detectBrand, getInitial, getColorForInitial, type TruckBrand } from '@/lib/truckBrands';

interface Poi {
  id: string;
  name: string;
  lat: number;
  lng: number;
  distance: number;
  distanceMiles: number;
  category: 'fuel' | 'truck_stop' | 'restaurant';
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
  hasActiveTrip?: boolean;
  onNavigateTo?: (poi: Poi) => void;
  onAddDetour?: (poi: Poi) => void;
  onPoisUpdate?: (pois: Poi[]) => void;
}

// HERE category IDs - ONLY Truck Stops (no regular gas stations)
const TRUCK_CATEGORIES = [
  '700-7850-0000',   // Truck Stop / Service Area ONLY
];

/**
 * Brand Badge Component - shows brand initial with brand-specific colors
 * Uses memoization to prevent re-renders
 */
const BrandBadge = React.memo<{ 
  name: string; 
  chainName: string | null;
  className?: string;
}>(({ name, chainName, className = '' }) => {
  const displayInfo = useMemo(() => {
    const brand = detectBrand(name, chainName);
    
    if (brand) {
      return {
        initial: brand.initial,
        bgColor: brand.color,
        textColor: brand.textColor,
        brandName: brand.name,
      };
    }
    
    // Fallback: use first letter with generated color
    const initial = getInitial(chainName || name);
    const colors = getColorForInitial(initial);
    
    return {
      initial,
      bgColor: colors.bg,
      textColor: colors.text,
      brandName: null,
    };
  }, [name, chainName]);

  return (
    <div 
      className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 ${displayInfo.bgColor} ${displayInfo.textColor} ${className}`}
      title={displayInfo.brandName || (chainName || name)}
    >
      {displayInfo.initial}
    </div>
  );
});
BrandBadge.displayName = 'BrandBadge';

/**
 * POI Card with brand badge and distance indicator
 * Trucker Path style with colored distance badge
 */
const PoiCard = React.memo<{ 
  poi: Poi; 
  onClick: () => void;
  color: 'green' | 'teal' | 'orange' | 'red';
}>(({ poi, onClick, color }) => {
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
      {/* Brand badge + Distance - Combined card */}
      <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg ${colorClasses[color]}`}>
        <BrandBadge 
          name={poi.name} 
          chainName={poi.chainName}
          className="w-7 h-7 text-xs"
        />
        <div className="flex flex-col items-center min-w-[28px]">
          <span className="text-lg font-black leading-none">{distanceDisplay}</span>
          <span className="text-[9px] font-semibold leading-none opacity-80">mi</span>
        </div>
      </div>
    </button>
  );
});
PoiCard.displayName = 'PoiCard';

const NearbyPoisOverlay: React.FC<NearbyPoisOverlayProps> = ({ 
  lat, 
  lng, 
  heading,
  hasActiveTrip = false,
  onNavigateTo,
  onAddDetour,
  onPoisUpdate,
}) => {
  const [pois, setPois] = useState<Poi[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPoi, setSelectedPoi] = useState<Poi | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
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
            radiusMeters: 48280, // 30 miles
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

  const handleNavigateClick = () => {
    if (!selectedPoi) return;

    // If there's an active trip, show confirmation dialog
    if (hasActiveTrip && onAddDetour) {
      setShowConfirmDialog(true);
    } else if (onNavigateTo) {
      // No active trip - navigate directly
      onNavigateTo(selectedPoi);
      setSelectedPoi(null);
    }
  };

  const handleConfirmDetour = () => {
    if (selectedPoi && onAddDetour) {
      onAddDetour(selectedPoi);
      setShowConfirmDialog(false);
      setSelectedPoi(null);
    }
  };

  const handleCancelDetour = () => {
    setShowConfirmDialog(false);
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
      {/* POI Cards Stack - Left side, below HUD with more spacing */}
      <div className="absolute top-44 left-4 z-20 flex flex-col gap-2">
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
      <Sheet open={!!selectedPoi && !showConfirmDialog} onOpenChange={(open) => !open && setSelectedPoi(null)}>
        <SheetContent side="bottom" className="h-auto max-h-[50vh]">
          {selectedPoi && (
            <>
              <SheetHeader>
                <div className="flex items-start gap-3">
                  <BrandBadge 
                    name={selectedPoi.name}
                    chainName={selectedPoi.chainName}
                    className="w-12 h-12 rounded-xl text-xl"
                  />
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
                    onClick={handleNavigateClick}
                  >
                    {hasActiveTrip ? (
                      <>
                        <MapPin className="w-4 h-4 mr-2" />
                        Add as Next Stop
                      </>
                    ) : (
                      <>
                        <Navigation className="w-4 h-4 mr-2" />
                        Navigate Here
                      </>
                    )}
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

      {/* Confirmation Dialog for Adding Detour */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add as next stop?</AlertDialogTitle>
            <AlertDialogDescription>
              This will add <strong>{selectedPoi?.chainName || selectedPoi?.name}</strong> as a temporary stop. 
              Your original destination will be resumed automatically after you leave this location.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDetour}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDetour}>
              Add Stop
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default NearbyPoisOverlay;
