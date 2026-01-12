import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useGeolocation, calculateDistance } from '@/hooks/useGeolocation';
import { useToast } from '@/hooks/use-toast';
import type { Facility, FacilityAggregate } from '@/types/collaborative';
import FacilityRatingPrompt from '@/components/facility/FacilityRatingPrompt';
import FacilityIdentifyModal from '@/components/facility/FacilityIdentifyModal';
import DestinationArrivalPrompt from '@/components/facility/DestinationArrivalPrompt';
import FacilityExitPrompt from '@/components/facility/FacilityExitPrompt';
import FoodSuggestionPrompt from '@/components/stops/FoodSuggestionPrompt';
import { useActiveNavigation } from '@/contexts/ActiveNavigationContext';

// Constants for detection
const DESTINATION_ARRIVAL_RADIUS_M = 150; // 150m from destination to trigger arrival
const DESTINATION_ARRIVAL_DWELL_MS = 10000; // 10 seconds stopped at destination
const FACILITY_GEOFENCE_RADIUS_M = 100; // Default radius for auto-created facilities
const MIN_STAY_FOR_EXIT_PROMPT_MS = 5 * 60 * 1000; // 5 minutes minimum stay to show exit prompt
const EXIT_DETECTION_DISTANCE_M = 250; // 250m away = exited

// Keywords to identify destination type
const FUEL_STOP_KEYWORDS = [
  'pilot', 'flying j', 'loves', 'ta ', 'petro', 'town pump', 'kwik trip',
  'casey', 'bucees', 'speedway', 'shell', 'chevron', 'exxon', 'mobil', 'bp',
  'marathon', 'citgo', 'sinclair', 'conoco', 'phillips', 'gas', 'fuel', 'truck stop',
  'travel center', 'travel plaza', 'rest area', 'service area', 'posto', 'gasolina'
];

// Destination type based on navigation context
type DestinationType = 'facility' | 'fuel_stop' | 'unknown';

interface VisitState {
  facilityId: string;
  facility: Facility;
  enteredAt: number;
  wasEasyToFind: boolean | null;
  hasRated: boolean;
  destinationType: DestinationType;
}

// Stop state for fuel stops (different from facility visits)
interface FuelStopVisit {
  id: string;
  name: string;
  lat: number;
  lng: number;
  enteredAt: number;
}

interface FacilityGeofenceContextType {
  nearbyFacilities: Facility[];
  currentFacility: Facility | null;
  isInsideFacility: boolean;
  facilityAggregates: Record<string, FacilityAggregate>;
  currentFuelStop: FuelStopVisit | null;
}

const FacilityGeofenceContext = createContext<FacilityGeofenceContextType | null>(null);

export const useFacilityGeofence = () => {
  const context = useContext(FacilityGeofenceContext);
  if (!context) {
    throw new Error('useFacilityGeofence must be used within a FacilityGeofenceProvider');
  }
  return context;
};

interface FacilityGeofenceProviderProps {
  children: ReactNode;
}

// Helper to detect destination type from name
const detectDestinationType = (name: string, address?: string): DestinationType => {
  const searchText = `${name} ${address || ''}`.toLowerCase();
  const isFuelStop = FUEL_STOP_KEYWORDS.some(keyword => searchText.includes(keyword));
  return isFuelStop ? 'fuel_stop' : 'facility';
};

export const FacilityGeofenceProvider = ({ children }: FacilityGeofenceProviderProps) => {
  // Use active navigation position if navigating, otherwise fallback to geolocation
  const { 
    userPosition: navPosition, 
    isNavigating, 
    destination, 
    endNavigation,
    progress 
  } = useActiveNavigation();
  const { latitude: geoLat, longitude: geoLng } = useGeolocation({ watchPosition: true });
  const { toast } = useToast();
  
  // Prefer navigation position when navigating (works with simulation too)
  const latitude = isNavigating && navPosition ? navPosition.lat : geoLat;
  const longitude = isNavigating && navPosition ? navPosition.lng : geoLng;
  
  // Facility state
  const [nearbyFacilities, setNearbyFacilities] = useState<Facility[]>([]);
  const [currentFacility, setCurrentFacility] = useState<Facility | null>(null);
  const [facilityAggregates, setFacilityAggregates] = useState<Record<string, FacilityAggregate>>({});
  const [facilitiesCache, setFacilitiesCache] = useState<{ data: Facility[]; timestamp: number } | null>(null);
  
  // Visit tracking
  const [currentVisit, setCurrentVisit] = useState<VisitState | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  
  // Fuel stop visit tracking (separate from facilities)
  const [currentFuelStop, setCurrentFuelStop] = useState<FuelStopVisit | null>(null);
  const [showFoodSuggestion, setShowFoodSuggestion] = useState(false);
  const dismissedFoodSuggestions = useRef<Set<string>>(new Set());
  
  // UI state
  const [showArrivalPrompt, setShowArrivalPrompt] = useState(false);
  const [showExitPrompt, setShowExitPrompt] = useState(false);
  const [showIdentifyModal, setShowIdentifyModal] = useState(false);
  const [showRatingPrompt, setShowRatingPrompt] = useState(false);
  const [promptType, setPromptType] = useState<'arrival' | 'exit'>('arrival');
  
  // Refs for tracking
  const destinationArrivalStartRef = useRef<number | null>(null);
  const lastDestinationCheckRef = useRef<{ lat: number; lng: number } | null>(null);
  const hasShownArrivalPromptRef = useRef(false);
  const detectedDestinationType = useRef<DestinationType>('unknown');
  
  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUserId(session?.user?.id || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch facilities with caching
  const fetchNearbyFacilities = useCallback(async () => {
    const now = Date.now();
    if (facilitiesCache && now - facilitiesCache.timestamp < 5 * 60 * 1000) {
      return facilitiesCache.data;
    }

    try {
      const { data, error } = await supabase
        .from('facilities')
        .select('*');

      if (error) throw error;

      const facilities = (data || []) as unknown as Facility[];
      setFacilitiesCache({ data: facilities, timestamp: now });
      return facilities;
    } catch (error) {
      console.error('Error fetching facilities:', error);
      return [];
    }
  }, [facilitiesCache]);

  // Fetch aggregates for nearby facilities
  const fetchAggregates = useCallback(async (facilityIds: string[]) => {
    if (facilityIds.length === 0) return;

    try {
      const { data, error } = await supabase
        .from('facility_aggregates')
        .select('*')
        .in('facility_id', facilityIds);

      if (error) throw error;

      const aggregatesMap: Record<string, FacilityAggregate> = {};
      (data || []).forEach((agg: unknown) => {
        const aggregate = agg as FacilityAggregate;
        aggregatesMap[aggregate.facility_id] = aggregate;
      });
      setFacilityAggregates(aggregatesMap);
    } catch (error) {
      console.error('Error fetching aggregates:', error);
    }
  }, []);

  // Create facility for navigation destination if it doesn't exist
  const createFacilityForDestination = useCallback(async (): Promise<Facility | null> => {
    if (!destination || !userId) return null;

    try {
      // Check if facility already exists near destination
      const facilities = await fetchNearbyFacilities();
      const existingFacility = facilities.find(f => {
        const distance = calculateDistance(destination.lat, destination.lng, f.lat, f.lng);
        return distance < FACILITY_GEOFENCE_RADIUS_M;
      });

      if (existingFacility) {
        return existingFacility;
      }

      // Create new facility
      const { data, error } = await supabase
        .from('facilities')
        .insert({
          name: destination.title,
          address: destination.address,
          lat: destination.lat,
          lng: destination.lng,
          facility_type: 'receiver', // Default to receiver
          geofence_radius_m: FACILITY_GEOFENCE_RADIUS_M,
          created_by: userId,
          verified: false,
        })
        .select()
        .single();

      if (error) throw error;

      // Invalidate cache
      setFacilitiesCache(null);
      
      console.log('[GEOFENCE] Created facility for destination:', destination.title);
      return data as unknown as Facility;
    } catch (error) {
      console.error('Error creating facility:', error);
      return null;
    }
  }, [destination, userId, fetchNearbyFacilities]);

  // Monitor destination arrival when navigating
  useEffect(() => {
    if (!isNavigating || !destination || !latitude || !longitude || !userId) {
      destinationArrivalStartRef.current = null;
      return;
    }

    // Don't re-trigger if we already showed prompt for this destination
    if (hasShownArrivalPromptRef.current && 
        lastDestinationCheckRef.current?.lat === destination.lat &&
        lastDestinationCheckRef.current?.lng === destination.lng) {
      return;
    }

    const distanceToDestination = calculateDistance(latitude, longitude, destination.lat, destination.lng);
    const now = Date.now();

    // Check if we're close to destination
    if (distanceToDestination <= DESTINATION_ARRIVAL_RADIUS_M) {
      // Start or continue dwell timer
      if (destinationArrivalStartRef.current === null) {
        destinationArrivalStartRef.current = now;
        console.log('[GEOFENCE] Entered destination zone:', destination.title);
      } else {
        const dwellTime = now - destinationArrivalStartRef.current;
        
        // Check if we've been here long enough
        if (dwellTime >= DESTINATION_ARRIVAL_DWELL_MS && !showArrivalPrompt && !currentVisit) {
          console.log('[GEOFENCE] Destination arrival confirmed:', destination.title);
          lastDestinationCheckRef.current = { lat: destination.lat, lng: destination.lng };
          hasShownArrivalPromptRef.current = true;
          setShowArrivalPrompt(true);
        }
      }
    } else {
      // Reset if we leave the zone
      destinationArrivalStartRef.current = null;
    }
  }, [isNavigating, destination, latitude, longitude, userId, showArrivalPrompt, currentVisit]);

  // Reset arrival prompt flag when destination changes
  useEffect(() => {
    if (destination) {
      if (lastDestinationCheckRef.current?.lat !== destination.lat ||
          lastDestinationCheckRef.current?.lng !== destination.lng) {
        hasShownArrivalPromptRef.current = false;
      }
    }
  }, [destination]);

  // Handle arrival confirmation
  const handleArrivalConfirm = useCallback(async (wasEasyToFind: boolean | null) => {
    setShowArrivalPrompt(false);
    
    if (!destination || !userId) return;

    // Detect destination type
    const destType = detectDestinationType(destination.title, destination.address);
    detectedDestinationType.current = destType;
    console.log('[GEOFENCE] Destination type detected:', destType, 'for:', destination.title);

    // End navigation
    endNavigation();

    if (destType === 'fuel_stop') {
      // For fuel stops, start tracking and show food suggestion
      const fuelStop: FuelStopVisit = {
        id: `fuel-${destination.lat}-${destination.lng}`,
        name: destination.title,
        lat: destination.lat,
        lng: destination.lng,
        enteredAt: Date.now(),
      };
      setCurrentFuelStop(fuelStop);
      
      // Show food suggestion if not dismissed before
      if (!dismissedFoodSuggestions.current.has(fuelStop.id)) {
        setShowFoodSuggestion(true);
      }
      
      toast({
        title: 'Chegou ao posto!',
        description: 'Boas sugestões de alimentação para você.',
      });
    } else {
      // For facilities (shippers/receivers), create facility and track
      const facility = await createFacilityForDestination();
      
      if (facility) {
        setCurrentVisit({
          facilityId: facility.id,
          facility,
          enteredAt: Date.now(),
          wasEasyToFind,
          hasRated: false,
          destinationType: destType,
        });
        setCurrentFacility(facility);
        
        toast({
          title: 'Chegada registrada!',
          description: 'Ao sair, você poderá avaliar esta empresa.',
        });
      }
    }
  }, [destination, userId, endNavigation, createFacilityForDestination, toast]);

  // Handle arrival dismiss
  const handleArrivalDismiss = useCallback(() => {
    setShowArrivalPrompt(false);
  }, []);

  // Monitor exit from facility
  useEffect(() => {
    if (!currentVisit || !latitude || !longitude) return;

    const distanceFromFacility = calculateDistance(
      latitude, 
      longitude, 
      currentVisit.facility.lat, 
      currentVisit.facility.lng
    );

    // Check if we've exited the facility zone
    if (distanceFromFacility > EXIT_DETECTION_DISTANCE_M) {
      const timeSpent = Date.now() - currentVisit.enteredAt;
      
      console.log('[GEOFENCE] Exited facility:', currentVisit.facility.name, 'Time spent:', Math.round(timeSpent / 60000), 'min');
      
      // Only show exit prompt if stayed long enough and hasn't rated
      if (timeSpent >= MIN_STAY_FOR_EXIT_PROMPT_MS && !currentVisit.hasRated) {
        setShowExitPrompt(true);
      } else {
        // Just clear the visit
        setCurrentVisit(null);
        setCurrentFacility(null);
      }
    }
  }, [latitude, longitude, currentVisit]);

  // Monitor exit from fuel stop - separate tracking
  useEffect(() => {
    if (!currentFuelStop || !latitude || !longitude) return;

    const distanceFromStop = calculateDistance(
      latitude,
      longitude,
      currentFuelStop.lat,
      currentFuelStop.lng
    );

    // Check if we've exited the fuel stop zone
    if (distanceFromStop > EXIT_DETECTION_DISTANCE_M) {
      const timeSpent = Date.now() - currentFuelStop.enteredAt;
      
      console.log('[GEOFENCE] Exited fuel stop:', currentFuelStop.name, 'Time spent:', Math.round(timeSpent / 60000), 'min');
      
      // Hide food suggestion if still showing
      setShowFoodSuggestion(false);
      
      // Clear fuel stop visit (POI feedback is handled by PoiFeedbackContext)
      setCurrentFuelStop(null);
      
      // Optional: Show a toast thanking for the visit
      if (timeSpent >= MIN_STAY_FOR_EXIT_PROMPT_MS) {
        toast({
          title: 'Boa viagem!',
          description: 'Esperamos que tenha encontrado boas opções.',
        });
      }
    }
  }, [latitude, longitude, currentFuelStop, toast]);

  // Handle food suggestion dismiss
  const handleDismissFoodSuggestion = useCallback(() => {
    if (currentFuelStop) {
      dismissedFoodSuggestions.current.add(currentFuelStop.id);
    }
    setShowFoodSuggestion(false);
  }, [currentFuelStop]);

  // Handle exit prompt complete
  const handleExitComplete = useCallback(() => {
    setShowExitPrompt(false);
    setCurrentVisit(null);
    setCurrentFacility(null);
    toast({ title: 'Obrigado!', description: 'Sua avaliação ajuda outros motoristas.' });
  }, [toast]);

  // Handle exit prompt dismiss
  const handleExitDismiss = useCallback(() => {
    setShowExitPrompt(false);
    setCurrentVisit(null);
    setCurrentFacility(null);
  }, []);

  // Monitor geofence for manually approaching facilities (not from navigation)
  useEffect(() => {
    if (!latitude || !longitude || !userId || isNavigating || currentVisit) return;

    const checkGeofence = async () => {
      const facilities = await fetchNearbyFacilities();
      
      // Filter facilities within reasonable distance (10km)
      const nearby = facilities.filter(facility => {
        const distance = calculateDistance(latitude, longitude, facility.lat, facility.lng);
        return distance < 10000;
      });
      
      setNearbyFacilities(nearby);
      fetchAggregates(nearby.map(f => f.id));

      // Check if inside any facility
      for (const facility of nearby) {
        const distance = calculateDistance(latitude, longitude, facility.lat, facility.lng);
        
        if (distance <= facility.geofence_radius_m) {
          // Entered a facility manually (not from navigation)
          if (!currentVisit) {
            setCurrentVisit({
              facilityId: facility.id,
              facility,
              enteredAt: Date.now(),
              wasEasyToFind: null,
              hasRated: false,
              destinationType: 'facility',
            });
            setCurrentFacility(facility);
            
            // Show rating prompt after 2 minutes
            setTimeout(() => {
              setPromptType('arrival');
              setShowRatingPrompt(true);
            }, 2 * 60 * 1000);
          }
          return;
        }
      }
    };

    checkGeofence();
    const interval = setInterval(checkGeofence, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, [latitude, longitude, userId, isNavigating, currentVisit, fetchNearbyFacilities, fetchAggregates]);

  // Handle rating prompt complete
  const handleRatingComplete = () => {
    setShowRatingPrompt(false);
    if (currentVisit) {
      setCurrentVisit({ ...currentVisit, hasRated: true });
    }
    toast({ title: 'Obrigado!', description: 'Sua avaliação ajuda outros motoristas.' });
  };

  // Handle rating prompt dismiss
  const handleRatingDismiss = () => {
    setShowRatingPrompt(false);
  };

  // Handle identify modal complete
  const handleIdentifyComplete = (facility: Facility) => {
    setShowIdentifyModal(false);
    setCurrentFacility(facility);
    setCurrentVisit({
      facilityId: facility.id,
      facility,
      enteredAt: Date.now(),
      wasEasyToFind: null,
      hasRated: false,
      destinationType: 'facility',
    });
    setFacilitiesCache(null);
  };

  return (
    <FacilityGeofenceContext.Provider
      value={{
        nearbyFacilities,
        currentFacility,
        isInsideFacility: !!currentVisit,
        facilityAggregates,
        currentFuelStop,
      }}
    >
      {children}
      
      {/* Destination Arrival Prompt */}
      {showArrivalPrompt && destination && (
        <DestinationArrivalPrompt
          destinationName={destination.title}
          destinationAddress={destination.address}
          onConfirmArrival={handleArrivalConfirm}
          onDismiss={handleArrivalDismiss}
        />
      )}
      
      {/* Food Suggestion Prompt for Fuel Stops */}
      {showFoodSuggestion && currentFuelStop && (
        <FoodSuggestionPrompt
          stop={{
            id: currentFuelStop.id,
            name: currentFuelStop.name,
            type: 'truck_stop',
            lat: currentFuelStop.lat,
            lng: currentFuelStop.lng,
          }}
          onDismiss={handleDismissFoodSuggestion}
        />
      )}
      
      {/* Facility Exit Prompt */}
      {showExitPrompt && currentVisit && (
        <FacilityExitPrompt
          facility={currentVisit.facility}
          timeSpentMs={Date.now() - currentVisit.enteredAt}
          wasEasyToFind={currentVisit.wasEasyToFind}
          onComplete={handleExitComplete}
          onDismiss={handleExitDismiss}
        />
      )}
      
      {/* Legacy Rating Prompt (for manual geofence entry) */}
      {showRatingPrompt && currentFacility && (
        <FacilityRatingPrompt
          facility={currentFacility}
          promptType={promptType}
          onComplete={handleRatingComplete}
          onDismiss={handleRatingDismiss}
        />
      )}
      
      {/* Identify Unknown Location Modal */}
      {showIdentifyModal && latitude && longitude && (
        <FacilityIdentifyModal
          lat={latitude}
          lng={longitude}
          onComplete={handleIdentifyComplete}
          onClose={() => setShowIdentifyModal(false)}
        />
      )}
    </FacilityGeofenceContext.Provider>
  );
};
