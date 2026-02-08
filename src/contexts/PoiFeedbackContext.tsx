import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useGeolocation, calculateDistance } from '@/hooks/useGeolocation';
import { useActiveNavigation } from '@/contexts/ActiveNavigationContext';
import { useNotifications } from '@/hooks/useNotifications';
import PoiFeedbackModal from '@/components/poi/PoiFeedbackModal';
import FoodSuggestionPrompt from '@/components/stops/FoodSuggestionPrompt';
import { toast } from 'sonner';
import {
  scoreTruckStopPoi,
  detectBrandFromName,
  useDwellDetection,
  useTriggerCooldown,
  SEARCH_RADIUS_METERS,
  EXIT_RADIUS_M,
  type ScoredPoi,
} from '@/hooks/useTruckStopDetection';

interface VisitedPoi {
  id: string;
  name: string;
  type: 'fuel' | 'truck_stop' | 'rest_area';
  lat: number;
  lng: number;
  enteredAt: number;
  brand?: string;
  address?: string;
  placeId?: string;
}

interface PoiFeedbackContextType {
  currentVisitedPoi: VisitedPoi | null;
  isShowingFeedback: boolean;
  isShowingFoodSuggestion: boolean;
  dismissFoodSuggestion: () => void;
  triggerManualFoodSuggestion: () => void;
}

const PoiFeedbackContext = createContext<PoiFeedbackContextType | undefined>(undefined);

export const usePoiFeedback = () => {
  const context = useContext(PoiFeedbackContext);
  if (!context) {
    throw new Error('usePoiFeedback must be used within a PoiFeedbackProvider');
  }
  return context;
};

// NextBillion POI categories for truck-related POIs
const TRUCK_CATEGORIES = [
  'fuel_station', 'truck_stop', 'rest_area', 'parking', 'diesel', 'gas_station',
];

const MIN_STAY_TIME_MS = 30000;

// Map POI category to our type
const mapPoiType = (category: string): 'fuel' | 'truck_stop' | 'rest_area' => {
  if (category.includes('truck_stop') || category.includes('7850')) return 'truck_stop';
  if (category.includes('rest') || category.includes('5510')) return 'rest_area';
  return 'fuel';
};

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

  const { checkDwell, resetDwell } = useDwellDetection();
  const { canTrigger, markTriggered } = useTriggerCooldown();
  const dwellTriggeredRef = useRef(false);

  // Dismiss food suggestion
  const dismissFoodSuggestion = useCallback(() => {
    if (currentVisitedPoi) {
      dismissedFoodSuggestions.current.add(currentVisitedPoi.id);
    }
    setIsShowingFoodSuggestion(false);
  }, [currentVisitedPoi]);

  // Manual "I'm at a truck stop" trigger
  const triggerManualFoodSuggestion = useCallback(() => {
    if (!latitude || !longitude) {
      toast.error('Localização não disponível');
      return;
    }

    // Find best candidate from cache
    let bestScored: ScoredPoi | null = null;
    nearbyPoisCache.current.forEach((poi) => {
      if (!poi.position) return;
      const scored = scoreTruckStopPoi(latitude, longitude, poi);
      if (!bestScored || scored.score > bestScored.score) {
        bestScored = scored;
      }
    });

    const poi = bestScored?.poi;
    const name = poi?.title || poi?.name || 'Truck Stop';
    const poiType = poi ? mapPoiType(poi.categories?.[0]?.id || 'fuel') : 'truck_stop';

    const manualPoi: VisitedPoi = {
      id: poi?.id || `manual_${Date.now()}`,
      name,
      type: poiType,
      lat: poi?.position?.lat || latitude,
      lng: poi?.position?.lng || longitude,
      enteredAt: Date.now(),
      brand: poi ? detectBrandFromName(name) : undefined,
      address: poi?.address || undefined,
      placeId: poi?.placeId || poi?.id,
    };

    console.log('[PoiFeedback] 🖐️ Manual trigger:', manualPoi.name, '| Confidence:', bestScored?.confidence || 'unknown');
    setCurrentVisitedPoi(manualPoi);
    setIsShowingFoodSuggestion(true);
    markTriggered();
  }, [latitude, longitude, markTriggered]);

  // Request notification permission on first POI visit
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

  // Fetch nearby POIs
  const fetchNearbyPois = useCallback(async (lat: number, lng: number) => {
    const now = Date.now();
    if (now - lastPoisFetch.current < 20000) return;
    lastPoisFetch.current = now;

    try {
      const { data, error } = await supabase.functions.invoke('nb_browse_pois', {
        body: { lat, lng, radiusMeters: SEARCH_RADIUS_METERS, categories: TRUCK_CATEGORIES, limit: 30 },
      });

      if (error) console.error('[PoiFeedback] Error fetching POIs:', error);

      let pois = data?.pois || data?.items || [];
      console.log('[PoiFeedback] POI search returned:', pois.length, 'POIs');

      // Fallback: general search
      if (pois.length === 0) {
        console.log('[PoiFeedback] Trying general search fallback...');
        try {
          const { data: fb } = await supabase.functions.invoke('nb_browse_pois', {
            body: { lat, lng, radiusMeters: SEARCH_RADIUS_METERS, limit: 20 },
          });
          pois = fb?.pois || fb?.items || [];
          console.log('[PoiFeedback] Fallback returned:', pois.length, 'POIs');
        } catch (e) {
          console.error('[PoiFeedback] Fallback failed:', e);
        }
      }

      if (pois.length > 0) {
        nearbyPoisCache.current.clear();
        pois.forEach((poi: any) => {
          const brand = detectBrandFromName(poi.name || poi.title || '');
          nearbyPoisCache.current.set(poi.id, {
            ...poi,
            position: poi.position || { lat: poi.lat, lng: poi.lng },
            title: poi.title || poi.name,
            brand: brand || poi.chainName || poi.brand || null,
            address: poi.address?.label || poi.address?.street || poi.address || null,
            categories: poi.categories || [{ id: brand ? 'truck_stop' : 'fuel_station' }],
          });
        });
        console.log('[PoiFeedback] Cached POIs:', nearbyPoisCache.current.size);
      }
    } catch (err) {
      console.error('[PoiFeedback] Failed to fetch POIs:', err);
    }
  }, []);

  // Check feedback eligibility
  const canSubmitFeedback = useCallback(async (poiId: string): Promise<boolean> => {
    if (!userId) return false;
    if (recentlyRatedPois.current.has(poiId)) return false;
    try {
      const { data } = await supabase.rpc('can_submit_poi_feedback', { p_user_id: userId, p_poi_id: poiId });
      return data === true;
    } catch { return false; }
  }, [userId]);

  // Check for critical maneuver
  const hasCriticalManeuver = useCallback(() => {
    if (!isNavigating || !progress) return false;
    return progress.distanceToNextManeuver !== undefined && progress.distanceToNextManeuver < 200;
  }, [isNavigating, progress]);

  // ========================================
  // MAIN DETECTION LOOP
  // ========================================
  useEffect(() => {
    if (!latitude || !longitude) return;

    fetchNearbyPois(latitude, longitude);

    const cacheSize = nearbyPoisCache.current.size;
    if (cacheSize === 0) return;

    // Score all cached POIs
    const scored: ScoredPoi[] = [];
    nearbyPoisCache.current.forEach((poi) => {
      if (!poi.position) return;
      const s = scoreTruckStopPoi(latitude, longitude, poi);
      if (s.score > 0) scored.push(s);
    });
    scored.sort((a, b) => b.score - a.score);

    const top = scored[0] || null;

    // Log best candidate
    if (top) {
      console.log(
        `[PoiFeedback] Best: ${top.poi.title} | score=${top.score} conf=${top.confidence} dist=${Math.round(top.distanceMeters)}m radius=${top.effectiveRadius}m`
      );
    }

    // ---- ENTRY DETECTION (POI-based) ----
    if (top && top.distanceMeters <= top.effectiveRadius && !currentVisitedPoi) {
      const poiType = mapPoiType(top.poi.categories?.[0]?.id || 'fuel');
      const newPoi: VisitedPoi = {
        id: top.poi.id,
        name: top.poi.title || 'Local',
        type: poiType,
        lat: top.poi.position.lat,
        lng: top.poi.position.lng,
        enteredAt: Date.now(),
        brand: top.poi.brand || null,
        address: top.poi.address || null,
        placeId: top.poi.placeId || top.poi.id,
      };
      setCurrentVisitedPoi(newPoi);
      dwellTriggeredRef.current = false;
      resetDwell();
      console.log(`[PoiFeedback] ✅ Entered POI: ${newPoi.name} | Brand: ${newPoi.brand} | dist=${Math.round(top.distanceMeters)}m`);

      // Show food suggestion
      if ((poiType === 'truck_stop' || poiType === 'fuel') &&
          !dismissedFoodSuggestions.current.has(top.poi.id) &&
          canTrigger()) {
        setIsShowingFoodSuggestion(true);
        markTriggered();
        console.log(`[PoiFeedback] 🍔 Food suggestion for: ${newPoi.name}`);
      }
    }

    // ---- RE-TRIGGER if inside POI but food not showing ----
    if (currentVisitedPoi && !isShowingFoodSuggestion && top && top.distanceMeters <= top.effectiveRadius) {
      const poiType = currentVisitedPoi.type;
      if ((poiType === 'truck_stop' || poiType === 'fuel') &&
          !dismissedFoodSuggestions.current.has(currentVisitedPoi.id) &&
          canTrigger()) {
        console.log(`[PoiFeedback] 🍔 Re-triggering food for: ${currentVisitedPoi.name}`);
        setIsShowingFoodSuggestion(true);
        markTriggered();
      }
    }

    // ---- DWELL FALLBACK: stopped for 2.5min near a truck stop (high/medium confidence only) ----
    if (!currentVisitedPoi && !dwellTriggeredRef.current && canTrigger()) {
      const isDwelling = checkDwell(latitude, longitude);
      if (isDwelling && top && (top.confidence === 'high' || top.confidence === 'medium')) {
        console.log(`[PoiFeedback] 🛑 Dwell detected near: ${top.poi.title} (dist=${Math.round(top.distanceMeters)}m, score=${top.score})`);
        const poiType = mapPoiType(top.poi.categories?.[0]?.id || 'fuel');
        const dwellPoi: VisitedPoi = {
          id: top.poi.id,
          name: top.poi.title || 'Truck Stop',
          type: poiType,
          lat: top.poi.position?.lat || latitude,
          lng: top.poi.position?.lng || longitude,
          enteredAt: Date.now(),
          brand: top.poi.brand || null,
          address: top.poi.address || null,
          placeId: top.poi.placeId || top.poi.id,
        };
        setCurrentVisitedPoi(dwellPoi);
        dwellTriggeredRef.current = true;

        if (!dismissedFoodSuggestions.current.has(dwellPoi.id)) {
          setIsShowingFoodSuggestion(true);
          markTriggered();
          console.log(`[PoiFeedback] 🍔 Dwell food suggestion for: ${dwellPoi.name}`);
        }
      }
    }

    // ---- EXIT DETECTION ----
    if (currentVisitedPoi) {
      const distFromPoi = calculateDistance(latitude, longitude, currentVisitedPoi.lat, currentVisitedPoi.lng);

      if (distFromPoi > EXIT_RADIUS_M) {
        const stayDuration = Date.now() - currentVisitedPoi.enteredAt;
        const poiName = currentVisitedPoi.name;
        const poiToRate = { ...currentVisitedPoi };

        console.log(`[PoiFeedback] 🚪 LEFT: ${poiName} | Stay: ${Math.round(stayDuration / 1000)}s`);

        setCurrentVisitedPoi(null);
        setIsShowingFoodSuggestion(false);
        dwellTriggeredRef.current = false;
        resetDwell();

        if (stayDuration >= MIN_STAY_TIME_MS && !hasCriticalManeuver()) {
          canSubmitFeedback(poiToRate.id).then((canSubmit) => {
            if (canSubmit) {
              sendNotification({
                title: '⭐ Rate your visit!',
                body: `How was your experience at ${poiName}?`,
                tag: `poi-feedback-${poiToRate.id}`,
                requireInteraction: true,
                onClick: () => {
                  setPendingFeedbackPoi(poiToRate);
                  setIsShowingFeedback(true);
                },
              });
               toast.info(`How was ${poiName}?`, {
                description: 'Tap to rate',
                duration: 5000,
                action: {
                  label: 'Rate',
                  onClick: () => {
                    setPendingFeedbackPoi(poiToRate);
                    setIsShowingFeedback(true);
                  },
                },
              });
              setTimeout(() => {
                setPendingFeedbackPoi(poiToRate);
                setIsShowingFeedback(true);
              }, 1500);
            }
          });
        }
      }
    }
  }, [latitude, longitude, currentVisitedPoi, isShowingFoodSuggestion, fetchNearbyPois, canSubmitFeedback, hasCriticalManeuver, sendNotification, checkDwell, resetDwell, canTrigger, markTriggered]);

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
        toast.error('Error submitting review');
      } else {
        recentlyRatedPois.current.add(pendingFeedbackPoi.id);
        toast.success('Review submitted! Thanks for your feedback.');
      }
    } catch (err) {
      console.error('[PoiFeedback] Submit failed:', err);
      toast.error('Error submitting review');
    }
    setIsShowingFeedback(false);
    setPendingFeedbackPoi(null);
  };

  const handleSkip = () => {
    setIsShowingFeedback(false);
    setPendingFeedbackPoi(null);
  };

  return (
    <PoiFeedbackContext.Provider value={{
      currentVisitedPoi,
      isShowingFeedback,
      isShowingFoodSuggestion,
      dismissFoodSuggestion,
      triggerManualFoodSuggestion,
    }}>
      {children}

      {isShowingFoodSuggestion && currentVisitedPoi && (
        <FoodSuggestionPrompt
          stop={{
            id: currentVisitedPoi.id,
            name: currentVisitedPoi.name,
            type: currentVisitedPoi.type,
            lat: currentVisitedPoi.lat,
            lng: currentVisitedPoi.lng,
            brand: currentVisitedPoi.brand,
            address: currentVisitedPoi.address,
            placeId: currentVisitedPoi.placeId,
          }}
          onDismiss={dismissFoodSuggestion}
        />
      )}

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
