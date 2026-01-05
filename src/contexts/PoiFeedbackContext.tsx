import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useGeolocation, calculateDistance } from '@/hooks/useGeolocation';
import { useActiveNavigation } from '@/contexts/ActiveNavigationContext';
import PoiFeedbackModal from '@/components/poi/PoiFeedbackModal';
import { toast } from 'sonner';

interface VisitedPoi {
  id: string;
  name: string;
  type: 'fuel' | 'truck_stop' | 'rest_area';
  lat: number;
  lng: number;
  enteredAt: number;
}

interface PoiFeedbackContextType {
  currentVisitedPoi: VisitedPoi | null;
  isShowingFeedback: boolean;
}

const PoiFeedbackContext = createContext<PoiFeedbackContextType | undefined>(undefined);

export const usePoiFeedback = () => {
  const context = useContext(PoiFeedbackContext);
  if (!context) {
    throw new Error('usePoiFeedback must be used within a PoiFeedbackProvider');
  }
  return context;
};

// POI types that trigger feedback
const FEEDBACK_POI_TYPES = ['fuel-station', 'petrol-station', 'truck-stop', 'rest-area', 'fueling-station'];

// Distance thresholds
const ENTER_RADIUS_M = 100; // Enter when within 100m
const EXIT_RADIUS_M = 150; // Exit when beyond 150m
const MIN_STAY_TIME_MS = 60000; // Minimum 1 minute stay to trigger feedback

export const PoiFeedbackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { latitude, longitude } = useGeolocation({ enableHighAccuracy: true, watchPosition: true });
  const { isNavigating, progress } = useActiveNavigation();
  
  const [currentVisitedPoi, setCurrentVisitedPoi] = useState<VisitedPoi | null>(null);
  const [pendingFeedbackPoi, setPendingFeedbackPoi] = useState<VisitedPoi | null>(null);
  const [isShowingFeedback, setIsShowingFeedback] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  
  const nearbyPoisCache = useRef<Map<string, any>>(new Map());
  const lastPoisFetch = useRef<number>(0);
  const recentlyRatedPois = useRef<Set<string>>(new Set());

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

  // Fetch nearby fuel POIs
  const fetchNearbyPois = useCallback(async (lat: number, lng: number) => {
    const now = Date.now();
    if (now - lastPoisFetch.current < 30000) return; // Cache for 30s
    lastPoisFetch.current = now;

    try {
      const { data, error } = await supabase.functions.invoke('here_browse_pois', {
        body: {
          lat,
          lng,
          radius: 500,
          categories: 'fuel-station,petrol-station',
          limit: 20,
        },
      });

      if (error) {
        console.error('[PoiFeedback] Error fetching POIs:', error);
        return;
      }

      if (data?.items) {
        nearbyPoisCache.current.clear();
        data.items.forEach((poi: any) => {
          nearbyPoisCache.current.set(poi.id, poi);
        });
      }
    } catch (err) {
      console.error('[PoiFeedback] Failed to fetch POIs:', err);
    }
  }, []);

  // Check if user can submit feedback (24h cooldown)
  const canSubmitFeedback = useCallback(async (poiId: string): Promise<boolean> => {
    if (!userId) return false;
    if (recentlyRatedPois.current.has(poiId)) return false;

    try {
      const { data, error } = await supabase.rpc('can_submit_poi_feedback', {
        p_user_id: userId,
        p_poi_id: poiId,
      });

      if (error) {
        console.error('[PoiFeedback] Error checking feedback eligibility:', error);
        return false;
      }

      return data === true;
    } catch {
      return false;
    }
  }, [userId]);

  // Check for critical maneuver during navigation
  const hasCriticalManeuver = useCallback(() => {
    if (!isNavigating || !progress) return false;
    // Consider maneuvers within 200m as critical
    return progress.distanceToNextManeuver !== undefined && progress.distanceToNextManeuver < 200;
  }, [isNavigating, progress]);

  // Map HERE category to our type
  const mapPoiType = (category: string): 'fuel' | 'truck_stop' | 'rest_area' => {
    if (category.includes('truck')) return 'truck_stop';
    if (category.includes('rest')) return 'rest_area';
    return 'fuel';
  };

  // Monitor position and detect POI entry/exit
  useEffect(() => {
    if (!latitude || !longitude) return;

    // Fetch nearby POIs periodically
    fetchNearbyPois(latitude, longitude);

    // Check if we're inside any POI
    let closestPoi: any = null;
    let closestDistance = Infinity;

    nearbyPoisCache.current.forEach((poi) => {
      if (!poi.position) return;
      const distance = calculateDistance(
        latitude,
        longitude,
        poi.position.lat,
        poi.position.lng
      );

      if (distance < closestDistance) {
        closestDistance = distance;
        closestPoi = poi;
      }
    });

    // Handle entry
    if (closestPoi && closestDistance < ENTER_RADIUS_M && !currentVisitedPoi) {
      const poiType = mapPoiType(closestPoi.categories?.[0]?.id || 'fuel');
      setCurrentVisitedPoi({
        id: closestPoi.id,
        name: closestPoi.title || 'Local',
        type: poiType,
        lat: closestPoi.position.lat,
        lng: closestPoi.position.lng,
        enteredAt: Date.now(),
      });
      console.log('[PoiFeedback] Entered POI:', closestPoi.title);
    }

    // Handle exit
    if (currentVisitedPoi) {
      const distanceFromVisited = calculateDistance(
        latitude,
        longitude,
        currentVisitedPoi.lat,
        currentVisitedPoi.lng
      );

      if (distanceFromVisited > EXIT_RADIUS_M) {
        const stayDuration = Date.now() - currentVisitedPoi.enteredAt;
        
        console.log('[PoiFeedback] Left POI:', currentVisitedPoi.name, 'Stay:', Math.round(stayDuration / 1000), 's');

        // Only show feedback if stayed long enough
        if (stayDuration >= MIN_STAY_TIME_MS) {
          // Don't show if critical maneuver
          if (!hasCriticalManeuver()) {
            canSubmitFeedback(currentVisitedPoi.id).then((canSubmit) => {
              if (canSubmit) {
                setPendingFeedbackPoi(currentVisitedPoi);
                setIsShowingFeedback(true);
              }
            });
          }
        }

        setCurrentVisitedPoi(null);
      }
    }
  }, [latitude, longitude, currentVisitedPoi, fetchNearbyPois, canSubmitFeedback, hasCriticalManeuver]);

  // Handle feedback submission
  const handleSubmitFeedback = async (ratings: {
    friendliness_rating: number;
    cleanliness_rating: number;
    recommendation_rating: number;
  }) => {
    if (!pendingFeedbackPoi || !userId) return;

    try {
      const { error } = await supabase.from('poi_feedback').insert({
        user_id: userId,
        poi_id: pendingFeedbackPoi.id,
        poi_name: pendingFeedbackPoi.name,
        poi_type: pendingFeedbackPoi.type,
        friendliness_rating: ratings.friendliness_rating,
        cleanliness_rating: ratings.cleanliness_rating,
        recommendation_rating: ratings.recommendation_rating,
      });

      if (error) {
        console.error('[PoiFeedback] Error submitting feedback:', error);
        toast.error('Erro ao enviar avaliação');
      } else {
        recentlyRatedPois.current.add(pendingFeedbackPoi.id);
        toast.success('Avaliação enviada!');
      }
    } catch (err) {
      console.error('[PoiFeedback] Submit failed:', err);
      toast.error('Erro ao enviar avaliação');
    }

    setIsShowingFeedback(false);
    setPendingFeedbackPoi(null);
  };

  // Handle skip
  const handleSkip = () => {
    setIsShowingFeedback(false);
    setPendingFeedbackPoi(null);
  };

  return (
    <PoiFeedbackContext.Provider value={{ currentVisitedPoi, isShowingFeedback }}>
      {children}
      
      {isShowingFeedback && pendingFeedbackPoi && (
        <PoiFeedbackModal
          poiName={pendingFeedbackPoi.name}
          poiType={pendingFeedbackPoi.type}
          onSubmit={handleSubmitFeedback}
          onSkip={handleSkip}
        />
      )}
    </PoiFeedbackContext.Provider>
  );
};
