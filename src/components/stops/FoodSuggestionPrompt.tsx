import React, { useState, useEffect, useCallback } from 'react';
import { X, Utensils, Sparkles, Loader2, ThumbsUp, AlertTriangle, Ban, ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import type { FoodRecommendation, DriverFoodProfile } from '@/types/stops';

interface VisitedStop {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
}

interface FoodSuggestionPromptProps {
  stop: VisitedStop;
  onDismiss: () => void;
}

const FoodSuggestionPrompt: React.FC<FoodSuggestionPromptProps> = ({ stop, onDismiss }) => {
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [recommendation, setRecommendation] = useState<FoodRecommendation | null>(null);
  const [userProfile, setUserProfile] = useState<DriverFoodProfile | null>(null);
  const [nearbyRestaurants, setNearbyRestaurants] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Fetch user food profile
  const fetchUserProfile = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('driver_food_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (data) {
        setUserProfile(data as DriverFoodProfile);
      }
    } catch (err) {
      console.log('[FoodSuggestion] No food profile found');
    }
  }, []);

  // Fetch nearby restaurants at this stop
  const fetchNearbyRestaurants = useCallback(async () => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke('here_browse_pois', {
        body: {
          lat: stop.lat,
          lng: stop.lng,
          radiusMeters: 300,
          categories: ['100-1000-0000', '100-1100-0000'], // Restaurants, Fast Food
          limit: 10,
        },
      });

      if (fnError) throw fnError;

      if (data?.pois) {
        const names = data.pois.map((p: any) => p.name).filter(Boolean);
        setNearbyRestaurants(names);
        return names;
      }
      return [];
    } catch (err) {
      console.error('[FoodSuggestion] Error fetching restaurants:', err);
      return [];
    }
  }, [stop.lat, stop.lng]);

  // Get AI food recommendations
  const fetchRecommendation = useCallback(async (restaurants: string[]) => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke('food_recommendation', {
        body: {
          profile: userProfile ? {
            diet_type: userProfile.diet_type,
            allergies: userProfile.allergies,
            restrictions: userProfile.restrictions,
            health_goals: userProfile.health_goals,
            budget_preference: userProfile.budget_preference,
          } : null,
          menuItems: [],
          placeType: stop.type,
          stopName: stop.name,
          restaurantNames: restaurants,
        },
      });

      if (fnError) throw fnError;

      if (data.error) {
        throw new Error(data.error);
      }

      setRecommendation(data);
    } catch (err) {
      console.error('[FoodSuggestion] Error getting recommendations:', err);
      setError(err instanceof Error ? err.message : 'Erro ao obter sugestões');
    }
  }, [stop.name, stop.type, userProfile]);

  // Load everything on mount
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchUserProfile();
      const restaurants = await fetchNearbyRestaurants();
      await fetchRecommendation(restaurants);
      setLoading(false);
    };
    load();
  }, [fetchUserProfile, fetchNearbyRestaurants, fetchRecommendation]);

  return (
    <div className="fixed bottom-20 left-2 right-2 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <Card className="border-primary/30 bg-background/95 backdrop-blur-md shadow-xl">
        <CardHeader className="pb-2 pt-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-full bg-primary/10">
                <Utensils className="w-4 h-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-sm font-medium">Sugestões Alimentares</CardTitle>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3" />
                  <span className="truncate max-w-[180px]">{stop.name}</span>
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
              <span className="text-sm text-muted-foreground">Analisando opções...</span>
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 py-2 text-destructive">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          ) : recommendation ? (
            <div className="space-y-3">
              {/* Best Choice - Always visible */}
              <div className="p-2.5 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <ThumbsUp className="w-3.5 h-3.5 text-green-600" />
                  <span className="text-xs font-medium text-green-700 dark:text-green-400">Melhor Opção</span>
                  <Sparkles className="w-3 h-3 text-primary ml-auto" />
                </div>
                <p className="font-semibold text-sm">{recommendation.best_choice.item}</p>
                <p className="text-xs text-muted-foreground">{recommendation.best_choice.reason}</p>
              </div>

              {/* Alternative - visible when expanded */}
              {expanded && (
                <>
                  <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <Badge variant="secondary" className="bg-blue-500/20 text-blue-700 dark:text-blue-400 text-xs mb-1">
                      Alternativa
                    </Badge>
                    <p className="font-medium text-sm">{recommendation.alternative.item}</p>
                    <p className="text-xs text-muted-foreground">{recommendation.alternative.reason}</p>
                  </div>

                  {/* Emergency Option */}
                  <div className="p-2.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                    <div className="flex items-center gap-1 mb-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-yellow-600" />
                      <span className="text-xs font-medium text-yellow-700 dark:text-yellow-400">Se não tiver nada</span>
                    </div>
                    <p className="font-medium text-sm">{recommendation.emergency_option.item}</p>
                    <p className="text-xs text-muted-foreground">{recommendation.emergency_option.reason}</p>
                  </div>

                  {/* Avoid List */}
                  {recommendation.avoid && recommendation.avoid.length > 0 && (
                    <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                      <div className="flex items-center gap-1 mb-1.5">
                        <Ban className="w-3.5 h-3.5 text-red-600" />
                        <span className="text-xs font-medium text-red-700 dark:text-red-400">Evitar</span>
                      </div>
                      <div className="space-y-1">
                        {recommendation.avoid.slice(0, 2).map((item, idx) => (
                          <div key={idx} className="text-xs">
                            <span className="font-medium">{item.item}</span>
                            <span className="text-muted-foreground"> - {item.reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Nearby restaurants */}
                  {nearbyRestaurants.length > 0 && (
                    <div className="pt-2 border-t border-border">
                      <p className="text-xs text-muted-foreground mb-1.5">Restaurantes próximos:</p>
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
                  Toque em ↑ para ver mais opções
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-2">
              Nenhuma sugestão disponível no momento.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FoodSuggestionPrompt;
