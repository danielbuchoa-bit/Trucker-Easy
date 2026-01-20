import React, { useEffect, useState, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Navigation, MapPin, Star } from 'lucide-react';
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
import { detectBrand, getInitial, getColorForInitial, type TruckBrand, MAJOR_TRUCK_STOP_BRANDS } from '@/lib/truckBrands';
import { getBrandLogo, GenericTruckStopLogo } from '@/lib/truckStopLogos';
import { usePoiRatings } from '@/hooks/usePoiRatings';
import PoiRatingBadge from '@/components/poi/PoiRatingBadge';
import PoiRatingDetails from '@/components/poi/PoiRatingDetails';

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

// HERE category IDs - Truck Stops AND Gas Stations for driver convenience
const TRUCK_CATEGORIES = [
  '700-7850-0000',   // Truck Stop / Service Area
  '700-7600-0000',   // Fueling Station / Gas Station
];

// Color to hex mapping for generic logos
const COLOR_TO_HEX: Record<string, string> = {
  'bg-emerald-600': '#059669',
  'bg-cyan-600': '#0891b2',
  'bg-violet-600': '#7c3aed',
  'bg-pink-600': '#db2777',
  'bg-amber-600': '#d97706',
  'bg-teal-600': '#0d9488',
  'bg-indigo-600': '#4f46e5',
  'bg-rose-600': '#e11d48',
};

/**
 * Brand Logo Component - shows SVG logo for known brands, initial for others
 * Uses memoization to prevent re-renders
 */
const BrandLogo = React.memo<{ 
  name: string; 
  chainName: string | null;
  size?: number;
  className?: string;
}>(({ name, chainName, size = 32, className = '' }) => {
  const displayInfo = useMemo(() => {
    const brand = detectBrand(name, chainName);
    
    if (brand) {
      const LogoComponent = getBrandLogo(brand.key);
      return {
        LogoComponent,
        brand,
        initial: brand.initial,
        bgColor: brand.color,
      };
    }
    
    // Fallback: use first letter with generated color
    const initial = getInitial(chainName || name);
    const colors = getColorForInitial(initial);
    
    return {
      LogoComponent: null,
      brand: null,
      initial,
      bgColor: colors.bg,
    };
  }, [name, chainName]);

  // If we have a logo component, render it
  if (displayInfo.LogoComponent) {
    const LogoComponent = displayInfo.LogoComponent;
    return (
      <div className={`rounded-lg overflow-hidden shrink-0 ${className}`}>
        <LogoComponent size={size} />
      </div>
    );
  }
  
  // Fallback to generic logo with initial
  const bgHex = COLOR_TO_HEX[displayInfo.bgColor] || '#666';
  return (
    <div className={`rounded-lg overflow-hidden shrink-0 ${className}`}>
      <GenericTruckStopLogo 
        size={size} 
        initial={displayInfo.initial} 
        bgColor={bgHex}
      />
    </div>
  );
});
BrandLogo.displayName = 'BrandLogo';

/**
 * POI Card with brand logo, distance indicator, and rating
 * Trucker Path style with colored distance badge
 */
const PoiCard = React.memo<{ 
  poi: Poi; 
  onClick: () => void;
  color: 'green' | 'teal' | 'orange' | 'red';
  rating?: { avg_overall: number; review_count: number };
}>(({ poi, onClick, color, rating }) => {
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
      className="flex items-center gap-1 text-left group"
    >
      {/* Brand logo + Distance - Combined card */}
      <div className={`flex items-center gap-1.5 px-1.5 py-1 rounded-lg ${colorClasses[color]}`}>
        <BrandLogo 
          name={poi.name} 
          chainName={poi.chainName}
          size={28}
        />
        <div className="flex flex-col items-center min-w-[28px]">
          <span className="text-lg font-black leading-none">{distanceDisplay}</span>
          <span className="text-[9px] font-semibold leading-none opacity-80">mi</span>
        </div>
      </div>
      {/* Rating badge if available */}
      {rating && rating.review_count > 0 && (
        <PoiRatingBadge 
          rating={rating.avg_overall} 
          reviewCount={rating.review_count}
          size="sm"
        />
      )}
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
  
  // POI ratings hook
  const { ratings, fetchRatingsForPois } = usePoiRatings();

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
          
          // Filter to only show major truck stop brands (Love's, Pilot, TA, Petro, Flying J, etc.)
          const majorBrandPois = data.pois.filter((poi: Poi) => {
            const brand = detectBrand(poi.name, poi.chainName);
            return brand && MAJOR_TRUCK_STOP_BRANDS.includes(brand.key);
          });
          
          const allPois = majorBrandPois.slice(0, 10);
          setPois(allPois.slice(0, 5));
          
          // Fetch ratings for these POIs
          const poiIds = allPois.map((p: Poi) => p.id);
          fetchRatingsForPois(poiIds);
          
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
  }, [lat, lng, heading, fetchRatingsForPois]);

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
      {/* POI Cards Stack - Left side, positioned below NavigationHUD with safe spacing */}
      <div className="absolute top-56 left-4 z-20 flex flex-col gap-2">
        {loading && pois.length === 0 && (
          <div className="bg-card/90 backdrop-blur-sm rounded-lg px-3 py-2 text-center">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        )}
        
        {/* Show max 3 POIs to avoid overflow */}
        {pois.slice(0, 3).map((poi) => {
          const poiRating = ratings.get(poi.id);
          return (
            <PoiCard
              key={poi.id}
              poi={poi}
              onClick={() => setSelectedPoi(poi)}
              color={getPoiColor(poi.distanceMiles)}
              rating={poiRating ? { avg_overall: poiRating.avg_overall, review_count: poiRating.review_count } : undefined}
            />
          );
        })}
      </div>

      {/* POI Detail Sheet */}
      <Sheet open={!!selectedPoi && !showConfirmDialog} onOpenChange={(open) => !open && setSelectedPoi(null)}>
        <SheetContent side="bottom" className="h-auto max-h-[70vh] overflow-y-auto">
          {selectedPoi && (
            <>
              <SheetHeader>
                <div className="flex items-start gap-3">
                  <BrandLogo 
                    name={selectedPoi.name}
                    chainName={selectedPoi.chainName}
                    size={48}
                  />
                  <div className="flex-1 min-w-0">
                    <SheetTitle className="text-left truncate">
                      {selectedPoi.chainName || selectedPoi.name}
                    </SheetTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm font-semibold text-primary">
                        {selectedPoi.distanceMiles.toFixed(1)} mi
                      </span>
                      {ratings.get(selectedPoi.id) && (
                        <PoiRatingBadge 
                          rating={ratings.get(selectedPoi.id)!.avg_overall}
                          reviewCount={ratings.get(selectedPoi.id)!.review_count}
                          size="md"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </SheetHeader>

              <div className="mt-4 space-y-4">
                {/* Rating Details Section */}
                {ratings.get(selectedPoi.id) && (
                  <PoiRatingDetails rating={ratings.get(selectedPoi.id)!} />
                )}

                <div className="text-sm text-muted-foreground">
                  {selectedPoi.address}
                </div>

                {selectedPoi.openingHours && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Horário: </span>
                    {selectedPoi.openingHours}
                  </div>
                )}

                {selectedPoi.contacts && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Telefone: </span>
                    <a href={`tel:${selectedPoi.contacts}`} className="text-primary">
                      {selectedPoi.contacts}
                    </a>
                  </div>
                )}

                {!ratings.get(selectedPoi.id) && (
                  <div className="p-3 bg-muted/50 rounded-lg text-center">
                    <Star className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">
                      Nenhuma avaliação ainda. Seja o primeiro a avaliar!
                    </p>
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
                        Adicionar Parada
                      </>
                    ) : (
                      <>
                        <Navigation className="w-4 h-4 mr-2" />
                        Navegar
                      </>
                    )}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setSelectedPoi(null)}
                  >
                    Fechar
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
