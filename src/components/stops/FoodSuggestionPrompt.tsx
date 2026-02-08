import React, { useState, useEffect, useCallback } from 'react';
import { X, Utensils, Sparkles, Loader2, ThumbsUp, AlertTriangle, Ban, ChevronDown, ChevronUp, MapPin, Store, Crown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/i18n/LanguageContext';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { useNavigate } from 'react-router-dom';
import type { DriverFoodProfile } from '@/types/stops';
import { 
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

type ActiveTab = 'restaurant' | 'convenience';

const FoodSuggestionPrompt: React.FC<FoodSuggestionPromptProps> = ({ stop, onDismiss }) => {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const { canAccess } = useFeatureAccess();
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [restaurantRec, setRestaurantRec] = useState<ConvenienceRecommendation | null>(null);
  const [convenienceRec, setConvenienceRec] = useState<ConvenienceRecommendation | null>(null);
  const [userProfile, setUserProfile] = useState<DriverFoodProfile | null>(null);
  const [nearbyRestaurants, setNearbyRestaurants] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('restaurant');

  const hasPersonalizedFood = canAccess('personalizedFoodSuggestions');

  const hasRestaurants = nearbyRestaurants.length > 0;
  const activeRecommendation = activeTab === 'restaurant' && restaurantRec ? restaurantRec : convenienceRec;

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
    } catch {
      console.log('[FoodSuggestion] No food profile found');
      return null;
    }
  }, []);

  // Fetch nearby restaurants
  const fetchNearbyRestaurants = useCallback(async (): Promise<string[]> => {
    try {
      console.log('[FoodSuggestion] Searching truck-friendly restaurants for:', stop.name);
      const { data, error: fnError } = await supabase.functions.invoke('nb_browse_pois', {
        body: {
          lat: stop.lat,
          lng: stop.lng,
          radiusMeters: 200,
          filterType: 'food',
          limit: 15,
        },
      });
      if (fnError) {
        console.error('[FoodSuggestion] Restaurant search error:', fnError);
        return [];
      }
      if (data?.pois) {
        const truckFriendlyRestaurants = data.pois.filter((p: any) => {
          const name = (p.name || '').toLowerCase();
          const chainName = (p.chainName || '').toLowerCase();
          const searchText = `${name} ${chainName}`;
          return TRUCK_STOP_ATTACHED_RESTAURANTS.some(brand =>
            searchText.includes(brand.toLowerCase())
          );
        });
        const names = truckFriendlyRestaurants.map((p: any) => p.name).filter(Boolean);
        console.log('[FoodSuggestion] Truck-friendly restaurants found:', names.length, names);
        setNearbyRestaurants(names);
        return names;
      }
      return [];
    } catch (err) {
      console.error('[FoodSuggestion] Error fetching restaurants:', err);
      return [];
    }
  }, [stop.lat, stop.lng, stop.name]);

  // Build profile payload
  const buildProfilePayload = (profile: DriverFoodProfile | null) => {
    if (!profile) return null;
    return {
      diet_type: profile.diet_type,
      allergies: profile.allergies,
      restrictions: profile.restrictions,
      health_goals: profile.health_goals,
      budget_preference: profile.budget_preference,
    };
  };

  // Build station object
  const buildStation = () => ({
    placeId: stop.placeId || stop.id,
    name: stop.name,
    brand: stop.brand,
    address: stop.address,
    lat: stop.lat,
    lng: stop.lng,
  });

  // Fetch a single recommendation
  const fetchSingleRecommendation = async (
    restaurants: string[],
    profile: DriverFoodProfile | null,
    useFallback: boolean
  ): Promise<ConvenienceRecommendation | null> => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke('food_recommendation', {
        body: {
          profile: buildProfilePayload(profile),
          menuItems: [],
          placeType: stop.type,
          stopName: stop.name,
          restaurantNames: useFallback ? [] : restaurants,
          station: buildStation(),
          useFallback,
          language,
        },
      });
      if (fnError || data?.error) return null;
      return data as ConvenienceRecommendation;
    } catch {
      return null;
    }
  };

  // Load everything on mount
  useEffect(() => {
    const load = async () => {
      if (!hasPersonalizedFood) {
        setLoading(false);
        return;
      }

      console.log('[FoodSuggestion] Loading for stop:', stop.name, 'brand:', stop.brand);
      setLoading(true);
      setError(null);

      const profile = await fetchUserProfile();
      const restaurants = await fetchNearbyRestaurants();

      console.log('[FoodSuggestion] Fetching recommendations. Restaurants:', restaurants.length);

      if (restaurants.length > 0) {
        // Fetch BOTH in parallel: restaurant-based + convenience
        const [restRec, convRec] = await Promise.all([
          fetchSingleRecommendation(restaurants, profile, false),
          fetchSingleRecommendation([], profile, true),
        ]);
        setRestaurantRec(restRec);
        setConvenienceRec(convRec);
        setActiveTab('restaurant'); // Default to restaurant tab
        if (!restRec && !convRec) setError(t.food.errorGettingSuggestions);
      } else {
        // No restaurants — only convenience
        const convRec = await fetchSingleRecommendation([], profile, true);
        setConvenienceRec(convRec);
        setActiveTab('convenience');
        if (!convRec) setError(t.food.errorGettingSuggestions);
      }

      setLoading(false);
    };
    load();
  }, [stop.id, hasPersonalizedFood]);

  // Tab labels
  const restaurantLabel = language === 'pt' ? 'Restaurantes' : language === 'es' ? 'Restaurantes' : 'Restaurants';
  const convenienceLabel = language === 'pt' ? 'Conveniência' : language === 'es' ? 'Conveniencia' : 'Convenience';

  // If user doesn't have Gold+, show upgrade prompt
  if (!hasPersonalizedFood) {
    return (
      <div className="fixed bottom-20 left-2 right-2 z-50 animate-in slide-in-from-bottom-4 duration-300">
        <Card className="border-amber-500/30 bg-background/95 backdrop-blur-md shadow-xl">
          <CardHeader className="pb-2 pt-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-full bg-amber-500/20">
                  <Crown className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <CardTitle className="text-sm font-medium">
                    {language === 'pt' ? 'Sugestões Personalizadas' : 
                     language === 'es' ? 'Sugerencias Personalizadas' : 
                     'Personalized Suggestions'}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {language === 'pt' ? 'Recurso Gold' : 
                     language === 'es' ? 'Función Gold' : 
                     'Gold Feature'}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDismiss}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <p className="text-sm text-muted-foreground mb-3">
              {language === 'pt' ? 'Atualize para Gold para receber sugestões de alimentação personalizadas com IA.' : 
               language === 'es' ? 'Actualiza a Gold para recibir sugerencias de comida personalizadas con IA.' : 
               'Upgrade to Gold to get AI-powered personalized food suggestions.'}
            </p>
            <Button 
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600" 
              onClick={() => navigate('/choose-plan')}
            >
              <Crown className="w-4 h-4 mr-2" />
              {language === 'pt' ? 'Atualizar para Gold' : 
               language === 'es' ? 'Actualizar a Gold' : 
               'Upgrade to Gold'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isConvenienceActive = activeTab === 'convenience';
  const titleText = isConvenienceActive ? t.food.convenienceSuggestions : t.food.foodSuggestions;

  return (
    <div className="fixed bottom-20 left-2 right-2 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <Card className="border-primary/30 bg-background/95 backdrop-blur-md shadow-xl">
        <CardHeader className="pb-2 pt-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-full bg-primary/10">
                {isConvenienceActive ? (
                  <Store className="w-4 h-4 text-primary" />
                ) : (
                  <Utensils className="w-4 h-4 text-primary" />
                )}
              </div>
              <div>
                <CardTitle className="text-sm font-medium">{titleText}</CardTitle>
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
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(!expanded)}>
                {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDismiss}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Tabs — only show when restaurants are available */}
          {hasRestaurants && !loading && (
            <div className="flex gap-1 mt-2">
              <Button
                variant={activeTab === 'restaurant' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 text-xs flex-1 gap-1"
                onClick={() => setActiveTab('restaurant')}
              >
                <Utensils className="w-3 h-3" />
                {restaurantLabel}
              </Button>
              <Button
                variant={activeTab === 'convenience' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 text-xs flex-1 gap-1"
                onClick={() => setActiveTab('convenience')}
              >
                <Store className="w-3 h-3" />
                {convenienceLabel}
              </Button>
            </div>
          )}
        </CardHeader>

        <CardContent className={`px-4 pb-3 transition-all duration-200 ${expanded ? '' : 'max-h-32 overflow-hidden'}`}>
          {loading ? (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">{t.food.analyzingOptions}</span>
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 py-2 text-destructive">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          ) : activeRecommendation ? (
            <div className="space-y-3">
              {/* Convenience indicator when on convenience tab */}
              {isConvenienceActive && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
                  <Store className="w-3 h-3" />
                  <span>{t.food.convenienceFromStation}</span>
                </div>
              )}

              {/* Restaurant names when on restaurant tab */}
              {!isConvenienceActive && nearbyRestaurants.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {nearbyRestaurants.slice(0, 5).map((name, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs bg-primary/5">
                      <Utensils className="w-2.5 h-2.5 mr-1" />
                      {name}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Best Choice */}
              <div className="p-2.5 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <ThumbsUp className="w-3.5 h-3.5 text-green-600" />
                  <span className="text-xs font-medium text-green-700 dark:text-green-400">{t.food.bestOption}</span>
                  <Sparkles className="w-3 h-3 text-primary ml-auto" />
                </div>
                <p className="font-semibold text-sm">{activeRecommendation.best_choice.item}</p>
                <p className="text-xs text-muted-foreground">{activeRecommendation.best_choice.reason}</p>
                {activeRecommendation.best_choice.what_to_pick && activeRecommendation.best_choice.what_to_pick.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {activeRecommendation.best_choice.what_to_pick.map((item, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">{item}</Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Expanded content */}
              {expanded && (
                <>
                  {/* Alternative */}
                  <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <Badge variant="secondary" className="bg-blue-500/20 text-blue-700 dark:text-blue-400 text-xs mb-1">
                      {t.food.alternative}
                    </Badge>
                    <p className="font-medium text-sm">{activeRecommendation.alternative.item}</p>
                    <p className="text-xs text-muted-foreground">{activeRecommendation.alternative.reason}</p>
                    {activeRecommendation.alternative.what_to_pick && activeRecommendation.alternative.what_to_pick.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {activeRecommendation.alternative.what_to_pick.map((item, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">{item}</Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Emergency */}
                  <div className="p-2.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                    <div className="flex items-center gap-1 mb-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-yellow-600" />
                      <span className="text-xs font-medium text-yellow-700 dark:text-yellow-400">{t.food.ifNothingElse}</span>
                    </div>
                    <p className="font-medium text-sm">{activeRecommendation.emergency_option.item}</p>
                    <p className="text-xs text-muted-foreground">{activeRecommendation.emergency_option.reason}</p>
                    {activeRecommendation.emergency_option.what_to_pick && activeRecommendation.emergency_option.what_to_pick.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {activeRecommendation.emergency_option.what_to_pick.map((item, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">{item}</Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Avoid */}
                  {activeRecommendation.avoid && activeRecommendation.avoid.length > 0 && (
                    <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                      <div className="flex items-center gap-1 mb-1.5">
                        <Ban className="w-3.5 h-3.5 text-red-600" />
                        <span className="text-xs font-medium text-red-700 dark:text-red-400">{t.food.avoid}</span>
                      </div>
                      <div className="space-y-1">
                        {activeRecommendation.avoid.slice(0, 3).map((item, idx) => (
                          <div key={idx} className="text-xs">
                            <span className="font-medium">{item.item}</span>
                            <span className="text-muted-foreground"> - {item.reason}</span>
                          </div>
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
