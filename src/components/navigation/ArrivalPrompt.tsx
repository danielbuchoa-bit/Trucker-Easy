import React, { useState, useEffect, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  MapPin, 
  Utensils, 
  X, 
  Clock, 
  AlertTriangle, 
  ThumbsUp, 
  ThumbsDown,
  ChefHat,
  Search,
  HelpCircle,
  Store,
  Heart
} from 'lucide-react';
import FavoriteMealButton from '@/components/stops/FavoriteMealButton';
import { supabase } from '@/integrations/supabase/client';
import type { DetectedPoi } from '@/hooks/useArrivalDetection';
import { useNearbyRestaurants, type NearbyRestaurantsResult } from '@/hooks/useNearbyRestaurants';

interface FoodRecommendation {
  best_choice: { item: string; reason: string };
  alternative: { item: string; reason: string };
  emergency_option: { item: string; reason: string };
  avoid: Array<{ item: string; reason: string }>;
}

interface ArrivalPromptProps {
  poi: DetectedPoi;
  onDismiss: () => void;
  onSnooze: () => void;
  onComplete: () => void;
}

export default function ArrivalPrompt({ 
  poi, 
  onDismiss, 
  onSnooze, 
  onComplete 
}: ArrivalPromptProps) {
  const [loading, setLoading] = useState(true);
  const [recommendation, setRecommendation] = useState<FoodRecommendation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isFallbackMode, setIsFallbackMode] = useState(false);
  const [nearbyRestaurantsData, setNearbyRestaurantsData] = useState<NearbyRestaurantsResult | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  
  const { fetchNearbyRestaurants, loading: restaurantsLoading } = useNearbyRestaurants();
  const hasFetchedRef = useRef(false);

  // Fetch user's food profile
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setProfileLoaded(true);
          return;
        }

        const { data } = await supabase
          .from('driver_food_profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (data) {
          setUserProfile(data);
        }
      } catch (e) {
        console.error('Error fetching food profile:', e);
      } finally {
        setProfileLoaded(true);
      }
    };
    fetchProfile();
  }, []);

  // Auto-fetch restaurants and recommendations when arriving
  useEffect(() => {
    if (hasFetchedRef.current) return;
    if (!profileLoaded) return;
    if (!poi.lat || !poi.lng) return;
    
    hasFetchedRef.current = true;
    
    const fetchAll = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // 1. First fetch nearby restaurants
        const restaurantsResult = await fetchNearbyRestaurants(poi.lat, poi.lng, poi.name);
        setNearbyRestaurantsData(restaurantsResult);
        
        // 2. Then get AI recommendations
        let menuItems: { item_name: string; category: string }[] = [];
        let restaurantNames: string[] = [];
        
        if (restaurantsResult?.restaurants && restaurantsResult.restaurants.length > 0) {
          restaurantNames = restaurantsResult.restaurants.map(r => r.name);
        } else if (restaurantsResult?.source === 'fallback' && restaurantsResult.fallback) {
          const offerings = restaurantsResult.fallback.offerings;
          offerings.breakfast.forEach(item => menuItems.push({ item_name: item, category: 'breakfast' }));
          offerings.lunch_dinner.forEach(item => menuItems.push({ item_name: item, category: 'lunch_dinner' }));
          offerings.snacks.forEach(item => menuItems.push({ item_name: item, category: 'snacks' }));
          offerings.drinks.forEach(item => menuItems.push({ item_name: item, category: 'drinks' }));
        }

        const { data, error: fnError } = await supabase.functions.invoke('food_recommendation', {
          body: {
            profile: userProfile,
            menuItems,
            placeType: poi.category === 'truck_stop' ? 'truck stop' : 'gas station',
            stopName: poi.name,
            restaurantNames,
          },
        });

        if (fnError) throw fnError;
        if (data.error) throw new Error(data.error);

        setRecommendation(data);
        setIsFallbackMode(restaurantsResult?.source === 'fallback');
      } catch (err) {
        console.error('Food recommendation error:', err);
        setError('Could not load recommendations.');
        // Set fallback recommendations
        setRecommendation({
          best_choice: { 
            item: 'Grilled chicken wrap or salad', 
            reason: 'High protein, lower carbs, filling' 
          },
          alternative: { 
            item: 'Turkey sandwich on wheat', 
            reason: 'Lean protein, complex carbs' 
          },
          emergency_option: { 
            item: 'Beef jerky + nuts + water', 
            reason: 'Protein without fried food' 
          },
          avoid: [
            { item: 'Large fried combos', reason: 'High fat and calories' },
            { item: 'Sugary drinks and pastries', reason: 'Sugar crash on the road' },
          ],
        });
        setIsFallbackMode(true);
      } finally {
        setLoading(false);
      }
    };
    
    fetchAll();
  }, [poi, profileLoaded, userProfile, fetchNearbyRestaurants]);

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'truck_stop': return 'Truck Stop';
      case 'fuel': return 'Fuel Station';
      case 'rest_area': return 'Rest Area';
      default: return 'Stop';
    }
  };

  const retryRecommendations = async () => {
    hasFetchedRef.current = false;
    setLoading(true);
    setError(null);
    
    try {
      const restaurantsResult = await fetchNearbyRestaurants(poi.lat, poi.lng, poi.name);
      setNearbyRestaurantsData(restaurantsResult);
      
      let menuItems: { item_name: string; category: string }[] = [];
      let restaurantNames: string[] = [];
      
      if (restaurantsResult?.restaurants && restaurantsResult.restaurants.length > 0) {
        restaurantNames = restaurantsResult.restaurants.map(r => r.name);
      } else if (restaurantsResult?.source === 'fallback' && restaurantsResult.fallback) {
        const offerings = restaurantsResult.fallback.offerings;
        offerings.breakfast.forEach(item => menuItems.push({ item_name: item, category: 'breakfast' }));
        offerings.lunch_dinner.forEach(item => menuItems.push({ item_name: item, category: 'lunch_dinner' }));
        offerings.snacks.forEach(item => menuItems.push({ item_name: item, category: 'snacks' }));
        offerings.drinks.forEach(item => menuItems.push({ item_name: item, category: 'drinks' }));
      }

      const { data, error: fnError } = await supabase.functions.invoke('food_recommendation', {
        body: {
          profile: userProfile,
          menuItems,
          placeType: poi.category === 'truck_stop' ? 'truck stop' : 'gas station',
          stopName: poi.name,
          restaurantNames,
        },
      });

      if (fnError) throw fnError;
      if (data.error) throw new Error(data.error);

      setRecommendation(data);
      setIsFallbackMode(restaurantsResult?.source === 'fallback');
    } catch (err) {
      console.error('Retry error:', err);
      setError('Could not load recommendations.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={true} onOpenChange={() => onDismiss()}>
      <SheetContent side="bottom" className="h-auto max-h-[85vh] rounded-t-2xl">
        <SheetHeader className="pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-lg">
              <Utensils className="h-5 w-5 text-primary" />
              Food Suggestions
            </SheetTitle>
            <Button variant="ghost" size="icon" onClick={onDismiss}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </SheetHeader>

        {/* POI Info */}
        <div className="space-y-4">
          <Card className="p-4 bg-muted/50">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-base">{poi.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {poi.address || `${Math.round(poi.distance)} meters away`}
                </p>
              </div>
              <Badge variant="secondary">{getCategoryLabel(poi.category)}</Badge>
            </div>
          </Card>

          {/* Recommendations - shown automatically */}
          <div className="space-y-4 max-h-[50vh] overflow-y-auto">
            {/* Nearby restaurants section */}
            {nearbyRestaurantsData?.restaurants && nearbyRestaurantsData.restaurants.length > 0 && (
              <Card className="p-3 bg-primary/5 border-primary/30">
                <div className="flex items-center gap-2 mb-2">
                  <Store className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">Restaurants at {poi.name}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {nearbyRestaurantsData.restaurants.slice(0, 6).map((r) => (
                    <Badge key={r.id} variant="secondary" className="text-xs">
                      {r.name}
                    </Badge>
                  ))}
                </div>
              </Card>
            )}

            {loading || restaurantsLoading ? (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2 py-4">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-muted-foreground">
                    Finding food options based on your preferences...
                  </span>
                </div>
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : recommendation ? (
              <>
                {/* Fallback notice */}
                {isFallbackMode && nearbyRestaurantsData?.source === 'fallback' && (
                  <div className="flex items-start gap-2 p-2 bg-amber-500/10 rounded-lg text-sm">
                    <HelpCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-amber-700 dark:text-amber-300 block">
                        Could not find specific restaurants here.
                      </span>
                      <span className="text-amber-600 dark:text-amber-400 text-xs">
                        Suggestions based on typical offerings:
                      </span>
                    </div>
                  </div>
                )}

                {/* Best choice */}
                <Card className="p-4 border-green-500/50 bg-green-500/5">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-green-500/20 rounded-full">
                      <ThumbsUp className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">Best Choice</span>
                          <Badge className="bg-green-500/20 text-green-700 text-xs">Recommended</Badge>
                        </div>
                        <FavoriteMealButton
                          mealName={recommendation.best_choice.item}
                          truckStopName={poi.name}
                          truckStopId={poi.id}
                          restaurantName={nearbyRestaurantsData?.restaurants?.[0]?.name || poi.name}
                          lat={poi.lat}
                          lng={poi.lng}
                        />
                      </div>
                      <p className="font-medium">{recommendation.best_choice.item}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {recommendation.best_choice.reason}
                      </p>
                    </div>
                  </div>
                </Card>

                {/* Alternative */}
                <Card className="p-4 border-blue-500/50 bg-blue-500/5">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-full">
                      <ChefHat className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">Alternative</span>
                        <FavoriteMealButton
                          mealName={recommendation.alternative.item}
                          truckStopName={poi.name}
                          truckStopId={poi.id}
                          restaurantName={nearbyRestaurantsData?.restaurants?.[0]?.name || poi.name}
                          lat={poi.lat}
                          lng={poi.lng}
                        />
                      </div>
                      <p className="font-medium mt-1">{recommendation.alternative.item}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {recommendation.alternative.reason}
                      </p>
                    </div>
                  </div>
                </Card>

                {/* Emergency option */}
                <Card className="p-4 border-orange-500/50 bg-orange-500/5">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-orange-500/20 rounded-full">
                      <AlertTriangle className="h-5 w-5 text-orange-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-semibold">Emergency Option</span>
                          <p className="text-sm text-muted-foreground">If nothing else works</p>
                        </div>
                        <FavoriteMealButton
                          mealName={recommendation.emergency_option.item}
                          truckStopName={poi.name}
                          truckStopId={poi.id}
                          restaurantName={nearbyRestaurantsData?.restaurants?.[0]?.name || poi.name}
                          lat={poi.lat}
                          lng={poi.lng}
                        />
                      </div>
                      <p className="font-medium mt-1">{recommendation.emergency_option.item}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {recommendation.emergency_option.reason}
                      </p>
                    </div>
                  </div>
                </Card>

                {/* Avoid section */}
                {recommendation.avoid && recommendation.avoid.length > 0 && (
                  <Card className="p-4 border-red-500/30 bg-red-500/5">
                    <div className="flex items-center gap-2 mb-2">
                      <ThumbsDown className="h-4 w-4 text-red-500" />
                      <span className="font-semibold text-red-600">Avoid</span>
                    </div>
                    <div className="space-y-2">
                      {recommendation.avoid.map((item, idx) => (
                        <div key={idx} className="text-sm">
                          <span className="font-medium">{item.item}</span>
                          <span className="text-muted-foreground"> — {item.reason}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* User profile notice */}
                {!userProfile && (
                  <div className="text-center text-sm text-muted-foreground p-2">
                    <Search className="h-4 w-4 inline mr-1" />
                    Set up your food preferences for personalized suggestions
                  </div>
                )}
              </>
            ) : error ? (
              <div className="text-center py-4">
                <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{error}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={retryRecommendations}
                  className="mt-2"
                >
                  Try Again
                </Button>
              </div>
            ) : null}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button 
                variant="default" 
                onClick={onComplete}
                className="flex-1"
              >
                Got It
              </Button>
              <Button 
                variant="outline" 
                onClick={onSnooze}
                className="flex-1 text-muted-foreground"
              >
                <Clock className="h-4 w-4 mr-1" />
                Snooze
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
