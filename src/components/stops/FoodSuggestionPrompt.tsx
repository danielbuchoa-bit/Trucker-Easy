import React, { useState, useEffect, useCallback } from 'react';
import { X, Utensils, Sparkles, Loader2, ThumbsUp, AlertTriangle, Ban, ChevronDown, ChevronUp, MapPin, Store, Truck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/i18n/LanguageContext';
import type { DriverFoodProfile } from '@/types/stops';
import { 
  TRUCK_STOP_BRANDS, 
  TRUCK_STOP_ATTACHED_RESTAURANTS,
  getTruckFriendlyFallbackMessage 
} from '@/lib/truckFriendlyFilter';

interface VisitedStop {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  brand?: string;
  address?: string;
  placeId?: string;
}

interface ConvenienceRecommendation {
  source: string;
  station: { name: string; brand?: string };
  best_choice: {
    item: string;
    reason: string;
    what_to_pick?: string[];
  };
  alternative: {
    item: string;
    reason: string;
    what_to_pick?: string[];
  };
  emergency_option: {
    item: string;
    reason: string;
    what_to_pick?: string[];
  };
  avoid: Array<{ item: string; reason: string }>;
  is_convenience_fallback?: boolean;
}

interface FoodSuggestionPromptProps {
  stop: VisitedStop;
  onDismiss: () => void;
}

const FoodSuggestionPrompt: React.FC<FoodSuggestionPromptProps> = ({ stop, onDismiss }) => {
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [recommendation, setRecommendation] = useState<ConvenienceRecommendation | null>(null);
  const [userProfile, setUserProfile] = useState<DriverFoodProfile | null>(null);
  const [nearbyRestaurants, setNearbyRestaurants] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isConvenienceFallback, setIsConvenienceFallback] = useState(false);

  // Fetch user food profile
  const fetchUserProfile = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data } = await supabase
        .from('driver_food_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (data) {
        setUserProfile(data as DriverFoodProfile);
        return data as DriverFoodProfile;
      }
      return null;
    } catch (err) {
      console.log('[FoodSuggestion] No food profile found');
      return null;
    }
  }, []);

  // Fetch nearby restaurants at this stop - STRICT TRUCK-FRIENDLY FILTER
  const fetchNearbyRestaurants = useCallback(async (): Promise<string[]> => {
    try {
      console.log('[FoodSuggestion] Searching truck-friendly restaurants for:', stop.name);
      
      // Check if we're at a verified truck stop
      const stopNameLower = stop.name.toLowerCase();
      const isAtTruckStop = TRUCK_STOP_BRANDS.some(brand => 
        stopNameLower.includes(brand.replace("'", '').toLowerCase())
      );
      
      if (!isAtTruckStop) {
        console.log('[FoodSuggestion] Not at a verified truck stop - using fallback only');
        return [];
      }
      
      const { data, error: fnError } = await supabase.functions.invoke('here_browse_pois', {
        body: {
          lat: stop.lat,
          lng: stop.lng,
          radiusMeters: 150, // STRICT: Only search within truck stop complex
          categories: ['100-1000-0000', '100-1000-0006'], // Restaurant, Fast Food only
          limit: 10,
        },
      });

      if (fnError) {
        console.error('[FoodSuggestion] Restaurant search error:', fnError);
        return [];
      }

      if (data?.pois) {
        // STRICT FILTER: Only allow known truck stop attached restaurants
        const truckFriendlyRestaurants = data.pois.filter((p: any) => {
          const name = (p.name || '').toLowerCase();
          const chainName = (p.chainName || '').toLowerCase();
          const searchText = `${name} ${chainName}`;
          
          // Only allow known truck stop restaurant chains
          const isAttached = TRUCK_STOP_ATTACHED_RESTAURANTS.some(brand =>
            searchText.includes(brand.toLowerCase())
          );
          
          if (isAttached) {
            console.log(`[FoodSuggestion] ✅ Truck-friendly: ${p.name}`);
            return true;
          }
          
          console.log(`[FoodSuggestion] ❌ Excluded (not truck-friendly): ${p.name}`);
          return false;
        });
        
        const names = truckFriendlyRestaurants.map((p: any) => p.name).filter(Boolean);
        console.log('[FoodSuggestion] Truck-friendly restaurants found:', names.length);
        setNearbyRestaurants(names);
        return names;
      }
      return [];
    } catch (err) {
      console.error('[FoodSuggestion] Error fetching restaurants:', err);
      return [];
    }
  }, [stop.lat, stop.lng, stop.name]);

  // Get AI food recommendations with fallback
  const fetchRecommendation = useCallback(async (restaurants: string[], profile: DriverFoodProfile | null) => {
    try {
      // STATION OBJECT - DO NOT MODIFY
      const station = {
        placeId: stop.placeId || stop.id,
        name: stop.name,
        brand: stop.brand,
        address: stop.address,
        lat: stop.lat,
        lng: stop.lng,
      };

      // Determine if fallback is needed
      const needsFallback = restaurants.length === 0;
      
      console.log('[FoodSuggestion] Calling recommendation API', {
        stationDetected: true,
        stationName: station.name,
        restaurantSearchAttempted: true,
        restaurantsFound: restaurants.length,
        fallbackTriggered: needsFallback,
        fallbackReason: needsFallback ? 'no_restaurants_found' : null,
      });

      const { data, error: fnError } = await supabase.functions.invoke('food_recommendation', {
        body: {
          profile: profile ? {
            diet_type: profile.diet_type,
            allergies: profile.allergies,
            restrictions: profile.restrictions,
            health_goals: profile.health_goals,
            budget_preference: profile.budget_preference,
          } : null,
          menuItems: [],
          placeType: stop.type,
          stopName: stop.name,
          restaurantNames: restaurants,
          station: station,
          useFallback: needsFallback,
          language: language, // Pass current app language
        },
      });

      if (fnError) {
        console.error('[FoodSuggestion] API error, forcing fallback');
        // Force fallback on error
        return await forceFallback(station, profile);
      }

      if (data.error) {
        console.error('[FoodSuggestion] Data error:', data.error);
        return await forceFallback(station, profile);
      }

      setIsConvenienceFallback(data.is_convenience_fallback || data.source?.includes('FALLBACK'));
      setRecommendation(data);
    } catch (err) {
      console.error('[FoodSuggestion] Error getting recommendations:', err);
      // Force fallback on any error
      const station = {
        placeId: stop.placeId || stop.id,
        name: stop.name,
        brand: stop.brand,
        address: stop.address,
        lat: stop.lat,
        lng: stop.lng,
      };
      await forceFallback(station, profile);
    }
  }, [stop]);

  // Force convenience fallback
  const forceFallback = async (station: any, profile: DriverFoodProfile | null) => {
    try {
      console.log('[FoodSuggestion] Forcing convenience fallback for:', station.name);
      
      const { data, error: fnError } = await supabase.functions.invoke('food_recommendation', {
        body: {
          profile: profile ? {
            diet_type: profile.diet_type,
            allergies: profile.allergies,
            restrictions: profile.restrictions,
            health_goals: profile.health_goals,
            budget_preference: profile.budget_preference,
          } : null,
          menuItems: [],
          placeType: stop.type,
          stopName: station.name,
          restaurantNames: [],
          station: station,
          useFallback: true,
          language: language, // Pass current app language
        },
      });

      if (fnError || data.error) {
        setError(t.food.errorGettingSuggestions);
        return;
      }

      setIsConvenienceFallback(true);
      setRecommendation(data);
    } catch (err) {
      setError(t.food.errorGettingSuggestions);
    }
  };

  // Load everything on mount
  useEffect(() => {
    const load = async () => {
      console.log('[FoodSuggestion] Loading for stop:', stop.name, 'brand:', stop.brand);
      setLoading(true);
      setError(null);
      
      const profile = await fetchUserProfile();
      const restaurants = await fetchNearbyRestaurants();
      
      console.log('[FoodSuggestion] Fetching recommendation with', restaurants.length, 'restaurants');
      await fetchRecommendation(restaurants, profile);
      
      setLoading(false);
    };
    load();
  }, [stop.id]);

  return (
    <div className="fixed bottom-20 left-2 right-2 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <Card className="border-primary/30 bg-background/95 backdrop-blur-md shadow-xl">
        <CardHeader className="pb-2 pt-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-full bg-primary/10">
                {isConvenienceFallback ? (
                  <Store className="w-4 h-4 text-primary" />
                ) : (
                  <Utensils className="w-4 h-4 text-primary" />
                )}
              </div>
              <div>
                <CardTitle className="text-sm font-medium">
                  {isConvenienceFallback ? t.food.convenienceSuggestions : t.food.foodSuggestions}
                </CardTitle>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3" />
                  <span className="truncate max-w-[180px]">{stop.name}</span>
                  {stop.brand && (
                    <Badge variant="outline" className="text-xs ml-1 py-0 h-4">
                      {stop.brand}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onDismiss}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className={`px-4 pb-3 transition-all duration-200 ${expanded ? '' : 'max-h-32 overflow-hidden'}`}>
          {loading ? (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">
                {isConvenienceFallback ? t.food.searchingConvenience : t.food.analyzingOptions}
              </span>
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 py-2 text-destructive">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          ) : recommendation ? (
            <div className="space-y-3">
              {/* Convenience fallback indicator */}
              {isConvenienceFallback && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
                  <Store className="w-3 h-3" />
                  <span>{t.food.convenienceFromStation}</span>
                </div>
              )}

              {/* Best Choice - Always visible */}
              <div className="p-2.5 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <ThumbsUp className="w-3.5 h-3.5 text-green-600" />
                  <span className="text-xs font-medium text-green-700 dark:text-green-400">{t.food.bestOption}</span>
                  <Sparkles className="w-3 h-3 text-primary ml-auto" />
                </div>
                <p className="font-semibold text-sm">{recommendation.best_choice.item}</p>
                <p className="text-xs text-muted-foreground">{recommendation.best_choice.reason}</p>
                {recommendation.best_choice.what_to_pick && recommendation.best_choice.what_to_pick.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {recommendation.best_choice.what_to_pick.map((item, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {item}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Alternative - visible when expanded */}
              {expanded && (
                <>
                  <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <Badge variant="secondary" className="bg-blue-500/20 text-blue-700 dark:text-blue-400 text-xs mb-1">
                      {t.food.alternative}
                    </Badge>
                    <p className="font-medium text-sm">{recommendation.alternative.item}</p>
                    <p className="text-xs text-muted-foreground">{recommendation.alternative.reason}</p>
                    {recommendation.alternative.what_to_pick && recommendation.alternative.what_to_pick.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {recommendation.alternative.what_to_pick.map((item, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {item}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Emergency Option */}
                  <div className="p-2.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                    <div className="flex items-center gap-1 mb-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-yellow-600" />
                      <span className="text-xs font-medium text-yellow-700 dark:text-yellow-400">{t.food.ifNothingElse}</span>
                    </div>
                    <p className="font-medium text-sm">{recommendation.emergency_option.item}</p>
                    <p className="text-xs text-muted-foreground">{recommendation.emergency_option.reason}</p>
                    {recommendation.emergency_option.what_to_pick && recommendation.emergency_option.what_to_pick.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {recommendation.emergency_option.what_to_pick.map((item, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {item}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Avoid List */}
                  {recommendation.avoid && recommendation.avoid.length > 0 && (
                    <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                      <div className="flex items-center gap-1 mb-1.5">
                        <Ban className="w-3.5 h-3.5 text-red-600" />
                        <span className="text-xs font-medium text-red-700 dark:text-red-400">{t.food.avoid}</span>
                      </div>
                      <div className="space-y-1">
                        {recommendation.avoid.slice(0, 3).map((item, idx) => (
                          <div key={idx} className="text-xs">
                            <span className="font-medium">{item.item}</span>
                            <span className="text-muted-foreground"> - {item.reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Nearby restaurants - only if not fallback */}
                  {!isConvenienceFallback && nearbyRestaurants.length > 0 && (
                    <div className="pt-2 border-t border-border">
                      <p className="text-xs text-muted-foreground mb-1.5">{t.food.nearbyRestaurants}</p>
                      <div className="flex flex-wrap gap-1">
                        {nearbyRestaurants.slice(0, 5).map((name, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {!expanded && (
                <p className="text-xs text-muted-foreground text-center">
                  {t.food.tapToSeeMore}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-2">
              {t.food.noSuggestions}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FoodSuggestionPrompt;
