import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useGeolocation, calculateDistance } from '@/hooks/useGeolocation';
import { useToast } from '@/hooks/use-toast';
import type { Facility, FacilityAggregate } from '@/types/collaborative';
import FacilityRatingPrompt from '@/components/facility/FacilityRatingPrompt';
import FacilityIdentifyModal from '@/components/facility/FacilityIdentifyModal';
import { useActiveNavigation } from '@/contexts/ActiveNavigationContext';

interface FacilityGeofenceContextType {
  nearbyFacilities: Facility[];
  currentFacility: Facility | null;
  isInsideFacility: boolean;
  facilityAggregates: Record<string, FacilityAggregate>;
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

export const FacilityGeofenceProvider = ({ children }: FacilityGeofenceProviderProps) => {
  // Use active navigation position if navigating, otherwise fallback to geolocation
  const { userPosition: navPosition, isNavigating } = useActiveNavigation();
  const { latitude: geoLat, longitude: geoLng } = useGeolocation({ watchPosition: true });
  
  // Prefer navigation position when navigating (works with simulation too)
  const latitude = isNavigating && navPosition ? navPosition.lat : geoLat;
  const longitude = isNavigating && navPosition ? navPosition.lng : geoLng;
  
  const { toast } = useToast();
  
  const [nearbyFacilities, setNearbyFacilities] = useState<Facility[]>([]);
  const [currentFacility, setCurrentFacility] = useState<Facility | null>(null);
  const [insideFacilityId, setInsideFacilityId] = useState<string | null>(null);
  const [enteredAt, setEnteredAt] = useState<number | null>(null);
  const [hasRatedCurrent, setHasRatedCurrent] = useState(false);
  const [showIdentifyModal, setShowIdentifyModal] = useState(false);
  const [showRatingPrompt, setShowRatingPrompt] = useState(false);
  const [promptType, setPromptType] = useState<'arrival' | 'exit'>('arrival');
  const [facilityAggregates, setFacilityAggregates] = useState<Record<string, FacilityAggregate>>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [facilitiesCache, setFacilitiesCache] = useState<{ data: Facility[]; timestamp: number } | null>(null);

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

  // Monitor geofence for facilities
  useEffect(() => {
    if (!latitude || !longitude || !userId) return;

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
          // Entered a facility
          if (!insideFacilityId) {
            setInsideFacilityId(facility.id);
            setCurrentFacility(facility);
            setEnteredAt(Date.now());
            setHasRatedCurrent(false);
            
            // Show arrival prompt after 2-3 minutes of being stationary
            setTimeout(() => {
              if (!hasRatedCurrent) {
                setPromptType('arrival');
                setShowRatingPrompt(true);
              }
            }, 2 * 60 * 1000); // 2 minutes
          }
          return;
        }
      }

      // Check if we need to identify an unknown location (no facility found but stopped)
      const wasInside = !!insideFacilityId;
      
      // If we were inside a facility and now we're outside
      if (insideFacilityId) {
        const facility = nearby.find(f => f.id === insideFacilityId);
        if (facility) {
          const distance = calculateDistance(latitude, longitude, facility.lat, facility.lng);
          
          if (distance > facility.geofence_radius_m) {
            // Check if we stayed long enough (>10 min) and haven't rated
            const timeSpent = Date.now() - (enteredAt || 0);
            if (timeSpent > 10 * 60 * 1000 && !hasRatedCurrent) {
              setPromptType('exit');
              setShowRatingPrompt(true);
            }
            
            setInsideFacilityId(null);
            setEnteredAt(null);
          }
        }
      }
    };

    checkGeofence();
    const interval = setInterval(checkGeofence, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, [latitude, longitude, userId, insideFacilityId, enteredAt, hasRatedCurrent, fetchNearbyFacilities, fetchAggregates]);

  const handleRatingComplete = () => {
    setShowRatingPrompt(false);
    setHasRatedCurrent(true);
    toast({ title: 'Thank you!', description: 'Your review helps other drivers.' });
  };

  const handleRatingDismiss = () => {
    setShowRatingPrompt(false);
  };

  const handleIdentifyComplete = (facility: Facility) => {
    setShowIdentifyModal(false);
    setCurrentFacility(facility);
    setInsideFacilityId(facility.id);
    setEnteredAt(Date.now());
    // Refresh facilities cache
    setFacilitiesCache(null);
  };

  return (
    <FacilityGeofenceContext.Provider
      value={{
        nearbyFacilities,
        currentFacility,
        isInsideFacility: !!insideFacilityId,
        facilityAggregates,
      }}
    >
      {children}
      
      {showRatingPrompt && currentFacility && (
        <FacilityRatingPrompt
          facility={currentFacility}
          promptType={promptType}
          onComplete={handleRatingComplete}
          onDismiss={handleRatingDismiss}
        />
      )}
      
      {showIdentifyModal && (
        <FacilityIdentifyModal
          lat={latitude || 0}
          lng={longitude || 0}
          onComplete={handleIdentifyComplete}
          onClose={() => setShowIdentifyModal(false)}
        />
      )}
    </FacilityGeofenceContext.Provider>
  );
};
