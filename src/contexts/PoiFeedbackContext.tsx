import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useGeolocation, calculateDistance } from '@/hooks/useGeolocation';
import { useActiveNavigation } from '@/contexts/ActiveNavigationContext';
import { useNotifications } from '@/hooks/useNotifications';
import PoiFeedbackModal from '@/components/poi/PoiFeedbackModal';
import FoodSuggestionPrompt from '@/components/stops/FoodSuggestionPrompt';
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
  isShowingFoodSuggestion: boolean;
  dismissFoodSuggestion: () => void;
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
const FEEDBACK_POI_TYPES = ['fuel', 'truck_stop', 'rest_area'];

// NextBillion POI categories for truck-related POIs
const TRUCK_CATEGORIES = [
  'fuel_station',
  'truck_stop',
  'rest_area',
  'parking',
  'diesel',
  'gas_station',
];

// Common truck stop brand names for text-based detection fallback
const TRUCK_STOP_BRANDS = [
  'pilot', 'flying j', 'loves', 'ta', 'petro', 'town pump',
  'sapp bros', 'kwik trip', 'casey', 'bucees', 'ambest',
  'speedway', 'shell', 'chevron', 'exxon', 'mobil', 'bp',
  'marathon', 'citgo', 'sinclair', 'conoco', 'phillips 66'
];

// Distance thresholds - More generous for detection
const ENTER_RADIUS_M = 150; // Enter when within 150m
const EXIT_RADIUS_M = 250; // Exit when beyond 250m
const MIN_STAY_TIME_MS = 30000; // Minimum 30 seconds stay to trigger feedback

export const PoiFeedbackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { latitude, longitude } = useGeolocation({ enableHighAccuracy: true, watchPosition: true });
  const { isNavigating, progress } = useActiveNavigation();
  const { sendNotification, requestPermission, permission } = useNotifications();
  
  const [currentVisitedPoi, setCurrentVisitedPoi] = useState<VisitedPoi | null>(null);
  const [pendingFeedbackPoi, setPendingFeedbackPoi] = useState<VisitedPoi | null>(null);
  const [isShowingFeedback, setIsShowingFeedback] = useState(false);
  const [isShowingFoodSuggestion, setIsShowingFoodSuggestion] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  
  const nearbyPoisCache = useRef<Map<string, any>>(new Map());
  const lastPoisFetch = useRef<number>(0);
  const recentlyRatedPois = useRef<Set<string>>(new Set());
  const dismissedFoodSuggestions = useRef<Set<string>>(new Set());
  const notificationPermissionRequested = useRef(false);

  // Dismiss food suggestion
  const dismissFoodSuggestion = useCallback(() => {
    if (currentVisitedPoi) {
      dismissedFoodSuggestions.current.add(currentVisitedPoi.id);
    }
    setIsShowingFoodSuggestion(false);
  }, [currentVisitedPoi]);

  // Request notification permission when entering a POI for the first time
  useEffect(() => {
    if (currentVisitedPoi && !notificationPermissionRequested.current && permission === 'default') {
      notificationPermissionRequested.current = true;
      requestPermission();
    }
  }, [currentVisitedPoi, permission, requestPermission]);

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

  // Fetch nearby POIs using NextBillion
  const fetchNearbyPois = useCallback(async (lat: number, lng: number) => {
    const now = Date.now();
    if (now - lastPoisFetch.current < 20000) return; // Cache for 20s
    lastPoisFetch.current = now;

    try {
      // Use NextBillion POI search
      const { data, error } = await supabase.functions.invoke('nb_browse_pois', {
        body: {
          lat,
          lng,
          radiusMeters: 800, // Increased radius
          categories: TRUCK_CATEGORIES,
          limit: 30,
        },
      });

      if (error) {
        console.error('[PoiFeedback] Error fetching POIs:', error);
      }

      let pois = data?.pois || data?.items || [];
      console.log('[PoiFeedback] POI search returned:', pois.length, 'POIs');

      // If no POIs found, try general search
      if (pois.length === 0) {
        console.log('[PoiFeedback] Trying general search fallback...');
        try {
          const { data: fallbackData } = await supabase.functions.invoke('nb_browse_pois', {
            body: {
              lat,
              lng,
              radiusMeters: 800,
              limit: 20,
            },
          });
          if (fallbackData?.pois || fallbackData?.items) {
            pois = fallbackData.pois || fallbackData.items || [];
            console.log('[PoiFeedback] Fallback search returned:', pois.length, 'POIs');
          }
        } catch (fallbackErr) {
          console.error('[PoiFeedback] Fallback search failed:', fallbackErr);
        }
      }

      // Cache all found POIs
      if (pois.length > 0) {
        nearbyPoisCache.current.clear();
        pois.forEach((poi: any) => {
          // Check if name matches known truck stop brands
          const nameLower = (poi.name || poi.title || '').toLowerCase();
          const isTruckStop = TRUCK_STOP_BRANDS.some(brand => nameLower.includes(brand));
          
          nearbyPoisCache.current.set(poi.id, {
            ...poi,
            position: poi.position || { lat: poi.lat, lng: poi.lng },
            title: poi.title || poi.name,
            categories: [{ id: isTruckStop ? 'truck_stop' : 'fuel_station' }],
          });
        });
        console.log('[PoiFeedback] Cached POIs:', nearbyPoisCache.current.size);
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

  // Map POI category to our type
  const mapPoiType = (category: string): 'fuel' | 'truck_stop' | 'rest_area' => {
    if (category.includes('truck_stop') || category.includes('7850')) return 'truck_stop';
    if (category.includes('rest') || category.includes('5510')) return 'rest_area';
    return 'fuel'; // Default to fuel for gas stations
  };

  // Monitor position and detect POI entry/exit
  useEffect(() => {
    if (!latitude || !longitude) {
      console.log('[PoiFeedback] No position available');
      return;
    }

    // Fetch nearby POIs periodically
    fetchNearbyPois(latitude, longitude);

    // Debug: log cache size
    const cacheSize = nearbyPoisCache.current.size;
    if (cacheSize > 0) {
      console.log('[PoiFeedback] Checking', cacheSize, 'cached POIs at:', latitude.toFixed(5), longitude.toFixed(5));
    }

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

    // Log closest POI for debugging
    if (closestPoi) {
      console.log('[PoiFeedback] Closest POI:', closestPoi.title, 'at', Math.round(closestDistance), 'm (threshold:', ENTER_RADIUS_M, 'm)');
    }

    // Handle entry
    if (closestPoi && closestDistance < ENTER_RADIUS_M && !currentVisitedPoi) {
      const poiType = mapPoiType(closestPoi.categories?.[0]?.id || 'fuel');
      const newPoi: VisitedPoi = {
        id: closestPoi.id,
        name: closestPoi.title || 'Local',
        type: poiType,
        lat: closestPoi.position.lat,
        lng: closestPoi.position.lng,
        enteredAt: Date.now(),
      };
      setCurrentVisitedPoi(newPoi);
      console.log('[PoiFeedback] Entered POI:', closestPoi.title);
      
      // Show food suggestion prompt for truck stops (only if not dismissed before)
      if ((poiType === 'truck_stop' || poiType === 'fuel') && !dismissedFoodSuggestions.current.has(closestPoi.id)) {
        setIsShowingFoodSuggestion(true);
        console.log('[PoiFeedback] Showing food suggestion for:', closestPoi.title);
      }
    }

    // Handle exit
    if (currentVisitedPoi) {
      const distanceFromVisited = calculateDistance(
        latitude,
        longitude,
        currentVisitedPoi.lat,
        currentVisitedPoi.lng
      );

      console.log('[PoiFeedback] Distance from', currentVisitedPoi.name, ':', Math.round(distanceFromVisited), 'm (exit threshold:', EXIT_RADIUS_M, 'm)');

      if (distanceFromVisited > EXIT_RADIUS_M) {
        const stayDuration = Date.now() - currentVisitedPoi.enteredAt;
        const poiName = currentVisitedPoi.name;
        const poiToRate = { ...currentVisitedPoi };
        
        console.log('[PoiFeedback] 🚪 LEFT POI:', poiName, '| Stay:', Math.round(stayDuration / 1000), 's | Min required:', MIN_STAY_TIME_MS / 1000, 's');

        // Clear current visited POI first
        setCurrentVisitedPoi(null);
        setIsShowingFoodSuggestion(false);

        // Only show feedback if stayed long enough
        if (stayDuration >= MIN_STAY_TIME_MS) {
          console.log('[PoiFeedback] ✅ Stay time sufficient, checking if can submit feedback...');
          
          // Don't show if critical maneuver
          if (hasCriticalManeuver()) {
            console.log('[PoiFeedback] ⚠️ Critical maneuver - delaying feedback prompt');
            return;
          }

          canSubmitFeedback(poiToRate.id).then((canSubmit) => {
            console.log('[PoiFeedback] Can submit feedback:', canSubmit);
            if (canSubmit) {
              // Send push notification
              sendNotification({
                title: '⭐ Avalie sua visita!',
                body: `Como foi sua experiência em ${poiName}? Sua avaliação ajuda outros motoristas.`,
                tag: `poi-feedback-${poiToRate.id}`,
                requireInteraction: true,
                onClick: () => {
                  setPendingFeedbackPoi(poiToRate);
                  setIsShowingFeedback(true);
                },
              });
              
              // Show the modal directly after a short delay
              console.log('[PoiFeedback] 📝 Showing rating prompt for:', poiName);
              toast.info(`Como foi ${poiName}?`, { 
                description: 'Toque para avaliar',
                duration: 5000,
                action: {
                  label: 'Avaliar',
                  onClick: () => {
                    setPendingFeedbackPoi(poiToRate);
                    setIsShowingFeedback(true);
                  }
                }
              });
              
              setTimeout(() => {
                setPendingFeedbackPoi(poiToRate);
                setIsShowingFeedback(true);
              }, 1500);
            } else {
              console.log('[PoiFeedback] ❌ User already rated this POI recently');
            }
          });
        } else {
          console.log('[PoiFeedback] ⏱️ Stay too short:', Math.round(stayDuration / 1000), 's < required', MIN_STAY_TIME_MS / 1000, 's');
        }
      }
    }
  }, [latitude, longitude, currentVisitedPoi, fetchNearbyPois, canSubmitFeedback, hasCriticalManeuver, sendNotification]);

  // Handle feedback submission
  const handleSubmitFeedback = async (ratings: {
    friendliness_rating: number;
    cleanliness_rating: number;
    structure_rating: number;
    recommendation_rating: number;
    would_return: boolean;
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
        structure_rating: ratings.structure_rating,
        recommendation_rating: ratings.recommendation_rating,
        would_return: ratings.would_return,
      });

      if (error) {
        console.error('[PoiFeedback] Error submitting feedback:', error);
        toast.error('Erro ao enviar avaliação');
      } else {
        recentlyRatedPois.current.add(pendingFeedbackPoi.id);
        toast.success('Avaliação enviada! Obrigado pelo feedback.');
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
    <PoiFeedbackContext.Provider value={{ 
      currentVisitedPoi, 
      isShowingFeedback, 
      isShowingFoodSuggestion,
      dismissFoodSuggestion 
    }}>
      {children}
      
      {/* Food suggestion prompt on entry */}
      {isShowingFoodSuggestion && currentVisitedPoi && (
        <FoodSuggestionPrompt
          stop={{
            id: currentVisitedPoi.id,
            name: currentVisitedPoi.name,
            type: currentVisitedPoi.type,
            lat: currentVisitedPoi.lat,
            lng: currentVisitedPoi.lng,
          }}
          onDismiss={dismissFoodSuggestion}
        />
      )}
      
      {/* Feedback modal on exit */}
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
