import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Navigation, MapPin, Star, Phone, Car, ParkingCircle, AlertTriangle, X, Fuel } from 'lucide-react';
import { cn } from '@/lib/utils';
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
import { useAuth } from '@/contexts/AuthContext';

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
  phone: string | null;
}

// Export Poi type for use in arrival detection
export type { Poi };

// Parking status type
type ParkingStatus = 'many' | 'some' | 'full' | null;

interface ParkingReport {
  status: ParkingStatus;
  created_at: string;
  count: number;
}

interface NearbyPoisOverlayProps {
  lat: number | null;
  lng: number | null;
  heading: number | null;
  hasActiveTrip?: boolean;
  stopNowActive?: boolean;
  onStopNowDismiss?: () => void;
  onNavigateTo?: (poi: Poi) => void;
  onAddDetour?: (poi: Poi) => void;
  onPoisUpdate?: (pois: Poi[]) => void;
}

// POI filter types for nb_browse_pois
const POI_FILTER_TYPE = 'truckStops';

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
 * Parking Status Badge - shows current parking availability
 */
const ParkingStatusBadge = React.memo<{ status: ParkingStatus; count?: number }>(({ status, count }) => {
  if (!status) return null;
  
  const config = {
    many: { label: 'MANY', color: 'bg-success text-success-foreground', icon: ParkingCircle },
    some: { label: 'SOME', color: 'bg-warning text-warning-foreground', icon: ParkingCircle },
    full: { label: 'FULL', color: 'bg-destructive text-destructive-foreground', icon: Car },
  };
  
  const { label, color, icon: Icon } = config[status];
  
  return (
    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${color}`}>
      <Icon className="w-3 h-3" />
      <span>{label}</span>
      {count && count > 1 && <span className="opacity-70">({count})</span>}
    </div>
  );
});
ParkingStatusBadge.displayName = 'ParkingStatusBadge';

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
  stopNowActive = false,
  onStopNowDismiss,
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
  
  // Auth for parking reports
  const { user } = useAuth();
  
  // Parking availability state
  const [parkingStatus, setParkingStatus] = useState<Map<string, ParkingReport>>(new Map());
  const [submittingParking, setSubmittingParking] = useState(false);

  // Diesel price state
  const [dieselPrice, setDieselPrice] = useState<{ cents: number; source: string } | null>(null);
  const [dieselLoading, setDieselLoading] = useState(false);

  // Fetch diesel price when a POI is selected
  const fetchDieselPrice = useCallback(async (poi: Poi) => {
    setDieselPrice(null);
    setDieselLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fuel_price_lookup', {
        body: { lat: poi.lat, lng: poi.lng, place_id: poi.id, place_name: poi.chainName || poi.name },
      });
      if (!error && data?.diesel_price_cents) {
        setDieselPrice({ cents: data.diesel_price_cents, source: data.source });
      }
    } catch (err) {
      console.error('[FUEL] Price lookup error:', err);
    } finally {
      setDieselLoading(false);
    }
  }, []);

  // Auto-select closest POI when Stop Now is triggered
  // Fetch diesel price when POI is selected
  useEffect(() => {
    if (selectedPoi) {
      fetchDieselPrice(selectedPoi);
    } else {
      setDieselPrice(null);
    }
  }, [selectedPoi, fetchDieselPrice]);

  useEffect(() => {
    if (stopNowActive && pois.length > 0 && !selectedPoi) {
      setSelectedPoi(pois[0]); // pois are sorted by distance
    }
  }, [stopNowActive, pois, selectedPoi]);

  // Fetch parking status for POIs
  const fetchParkingStatus = async (poiIds: string[]) => {
    if (poiIds.length === 0) return;
    
    const { data, error } = await supabase
      .from('parking_reports')
      .select('poi_id, status, created_at')
      .in('poi_id', poiIds)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      // Group by poi_id and get most recent + count
      const statusMap = new Map<string, ParkingReport>();
      const counts = new Map<string, number>();
      
      data.forEach((report) => {
        counts.set(report.poi_id, (counts.get(report.poi_id) || 0) + 1);
        if (!statusMap.has(report.poi_id)) {
          statusMap.set(report.poi_id, {
            status: report.status as ParkingStatus,
            created_at: report.created_at,
            count: 1,
          });
        }
      });
      
      // Update counts
      statusMap.forEach((report, poiId) => {
        report.count = counts.get(poiId) || 1;
      });
      
      setParkingStatus(statusMap);
    }
  };

  // Submit parking report
  const submitParkingReport = async (status: 'many' | 'some' | 'full') => {
    if (!selectedPoi || !user) return;
    
    setSubmittingParking(true);
    try {
      const { error } = await supabase.from('parking_reports').insert({
        poi_id: selectedPoi.id,
        poi_name: selectedPoi.chainName || selectedPoi.name,
        user_id: user.id,
        status,
      });
      
      if (!error) {
        // Update local state immediately
        setParkingStatus(prev => {
          const newMap = new Map(prev);
          const existing = newMap.get(selectedPoi.id);
          newMap.set(selectedPoi.id, {
            status,
            created_at: new Date().toISOString(),
            count: (existing?.count || 0) + 1,
          });
          return newMap;
        });
      }
    } finally {
      setSubmittingParking(false);
    }
  };

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
      // Mark an attempt immediately so network failures don't cause rapid retry loops
      lastFetchRef.current = { lat, lng, time: now };
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('nb_browse_pois', {
          body: { 
            lat, 
            lng,
            radiusMeters: 48280, // 30 miles
            filterType: 'truckStops',
            limit: 10,
          },
        });

        if (!error && data?.pois) {
          lastFetchRef.current = { lat, lng, time: now };
          
          // Filter to only show major truck stop brands (Love's, Pilot, TA, Petro, Flying J, etc.)
          const majorBrandPois = data.pois.filter((poi: any) => {
            const brand = detectBrand(poi.name || poi.title, poi.chainName);
            return brand && MAJOR_TRUCK_STOP_BRANDS.includes(brand.key);
          });
          
          // Transform POIs to ensure distanceMiles is calculated
          const transformedPois: Poi[] = majorBrandPois.slice(0, 10).map((poi: any) => ({
            id: poi.id,
            name: poi.name || poi.title || 'Unknown',
            lat: poi.lat || poi.position?.lat,
            lng: poi.lng || poi.position?.lng,
            distance: poi.distance || 0,
            // Calculate distanceMiles from distance (meters) - handle undefined/NaN
            distanceMiles: Number.isFinite(poi.distance) ? poi.distance / 1609.34 : 0,
            category: poi.category || poi.poiType || 'truck_stop',
            address: typeof poi.address === 'string' ? poi.address : poi.address?.label || '',
            chainName: poi.chainName || null,
            openingHours: poi.openingHours || null,
            contacts: poi.contacts || null,
            phone: poi.contacts || poi.phone || null,
          }));
          
          setPois(transformedPois.slice(0, 5));
          
          // Fetch ratings and parking status for these POIs
          const poiIds = transformedPois.map((p: Poi) => p.id);
          fetchRatingsForPois(poiIds);
          fetchParkingStatus(poiIds);
          
          // Notify parent for arrival detection
          if (onPoisUpdate) {
            onPoisUpdate(transformedPois);
          }
        }
      } catch (err) {
        console.error('POI fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPois();
  }, [lat, lng, heading, onPoisUpdate]); // Removed fetchRatingsForPois - it's now stable

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

  if (pois.length === 0 && !loading && !stopNowActive) {
    return null;
  }

  return (
    <>
      {/* Stop Now Banner */}
      {stopNowActive && (
        <div className="absolute top-44 left-4 right-4 z-30 bg-destructive/95 backdrop-blur-md text-destructive-foreground rounded-xl px-4 py-3 shadow-2xl animate-in slide-in-from-top-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <div>
              <p className="text-sm font-bold">Parar agora</p>
              <p className="text-xs opacity-90">Escolha uma parada próxima</p>
            </div>
          </div>
          <button
            onClick={onStopNowDismiss}
            className="p-1 hover:bg-destructive-foreground/10 rounded"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* POI Cards Stack - Left side, positioned below NavigationHUD with safe spacing */}
      <div className={cn(
        "absolute left-4 z-20 flex flex-col gap-2",
        stopNowActive ? "top-64" : "top-56"
      )}>
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
                      {parkingStatus.get(selectedPoi.id) && (
                        <ParkingStatusBadge 
                          status={parkingStatus.get(selectedPoi.id)!.status}
                          count={parkingStatus.get(selectedPoi.id)!.count}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </SheetHeader>

              <div className="mt-4 space-y-4">
                {/* Parking Availability Section */}
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Parking Availability</span>
                    {parkingStatus.get(selectedPoi.id) && (
                      <span className="text-xs text-muted-foreground">
                        Updated {new Date(parkingStatus.get(selectedPoi.id)!.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={parkingStatus.get(selectedPoi.id)?.status === 'many' ? 'default' : 'outline'}
                      className="flex-1 bg-success/10 hover:bg-success/20 text-success border-success/30"
                      onClick={() => submitParkingReport('many')}
                      disabled={submittingParking || !user}
                    >
                      MANY
                    </Button>
                    <Button
                      size="sm"
                      variant={parkingStatus.get(selectedPoi.id)?.status === 'some' ? 'default' : 'outline'}
                      className="flex-1 bg-warning/10 hover:bg-warning/20 text-warning border-warning/30"
                      onClick={() => submitParkingReport('some')}
                      disabled={submittingParking || !user}
                    >
                      SOME
                    </Button>
                    <Button
                      size="sm"
                      variant={parkingStatus.get(selectedPoi.id)?.status === 'full' ? 'default' : 'outline'}
                      className="flex-1 bg-destructive/10 hover:bg-destructive/20 text-destructive border-destructive/30"
                      onClick={() => submitParkingReport('full')}
                      disabled={submittingParking || !user}
                    >
                      FULL
                    </Button>
                  </div>
                  {!user && (
                    <p className="text-xs text-muted-foreground mt-2">Login to report parking availability</p>
                  )}
                </div>

                {/* Diesel Price Section */}
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                      <Fuel className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-medium">Diesel</span>
                      {dieselLoading ? (
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          <span className="text-xs text-muted-foreground">Buscando preço...</span>
                        </div>
                      ) : dieselPrice ? (
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-lg font-bold text-emerald-400">
                            ${(dieselPrice.cents / 100).toFixed(2)}
                          </span>
                          <span className="text-xs text-muted-foreground">/gal</span>
                          {dieselPrice.source === 'estimate' && (
                            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">est.</span>
                          )}
                          {dieselPrice.source === 'gasbuddy' && (
                            <span className="text-[10px] text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">GasBuddy</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Preço indisponível</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Rating Details Section */}
                {ratings.get(selectedPoi.id) && (
                  <PoiRatingDetails rating={ratings.get(selectedPoi.id)!} />
                )}

                {/* Phone - Click to Call */}
                {selectedPoi.phone && (
                  <a 
                    href={`tel:${selectedPoi.phone.replace(/\D/g, '')}`}
                    className="flex items-center gap-3 p-3 bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <Phone className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Call {selectedPoi.chainName || selectedPoi.name}</p>
                      <p className="text-xs text-muted-foreground">{selectedPoi.phone}</p>
                    </div>
                  </a>
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

                {!ratings.get(selectedPoi.id) && (
                  <div className="p-3 bg-muted/50 rounded-lg text-center">
                    <Star className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">
                       No reviews yet. Be the first to rate!
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
