import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Loader2, Star, Navigation2, Hand } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import BottomNav from '@/components/navigation/BottomNav';
import StopMenu from '@/components/stops/StopMenu';
import AIFoodRecommendation from '@/components/stops/AIFoodRecommendation';
import StopRatingForm from '@/components/stops/StopRatingForm';
import StarRating from '@/components/stops/StarRating';
import { useGeolocation } from '@/hooks/useGeolocation';
import { supabase } from '@/integrations/supabase/client';
import type { StopPlace, StopMenuItem, StopRating, DriverFoodProfile } from '@/types/stops';

const StopAdvisorScreen: React.FC = () => {
  const navigate = useNavigate();
  const { latitude, longitude, loading: geoLoading } = useGeolocation({ watchPosition: true });
  
  const [activeTab, setActiveTab] = useState('menu');
  const [currentStop, setCurrentStop] = useState<StopPlace | null>(null);
  const [menuItems, setMenuItems] = useState<StopMenuItem[]>([]);
  const [ratings, setRatings] = useState<StopRating[]>([]);
  const [userProfile, setUserProfile] = useState<DriverFoodProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id || null);
    });
  }, []);

  // Load user food profile
  useEffect(() => {
    if (!userId) return;
    
    const loadProfile = async () => {
      const { data } = await supabase
        .from('driver_food_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (data) {
        setUserProfile(data as unknown as DriverFoodProfile);
      }
    };
    
    loadProfile();
  }, [userId]);

  // Detect nearby POI (mock for now - would use HERE Places API)
  useEffect(() => {
    if (!latitude || !longitude) return;
    
    // Simulate detecting a nearby truck stop
    const mockStop: StopPlace = {
      id: 'mock-stop-1',
      name: 'Pilot Travel Center',
      type: 'travel_center',
      lat: latitude,
      lng: longitude,
      address: '1234 Interstate Highway',
      averageRating: 4.2,
      ratingCount: 156,
    };
    
    setCurrentStop(mockStop);
    setLoading(false);
  }, [latitude, longitude]);

  // Load ratings for current stop
  useEffect(() => {
    if (!currentStop) return;
    
    const loadRatings = async () => {
      const { data } = await supabase
        .from('stop_ratings')
        .select('*')
        .eq('place_id', currentStop.id)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (data) {
        setRatings(data as unknown as StopRating[]);
      }
    };
    
    loadRatings();
  }, [currentStop]);

  // Load menu items for current stop
  useEffect(() => {
    if (!currentStop) return;
    
    const loadMenuItems = async () => {
      const { data } = await supabase
        .from('stop_menu_items')
        .select('*')
        .eq('place_id', currentStop.id);
      
      if (data) {
        setMenuItems(data as unknown as StopMenuItem[]);
      }
    };
    
    loadMenuItems();
  }, [currentStop]);

  const handleAddMenuItem = async (category: string, itemName: string, price?: number) => {
    if (!currentStop || !userId) {
      toast({ title: 'Please sign in to add items', variant: 'destructive' });
      return;
    }
    
    const { error } = await supabase.from('stop_menu_items').insert({
      place_id: currentStop.id,
      category,
      item_name: itemName,
      price,
      added_by: userId,
    });
    
    if (error) {
      toast({ title: 'Failed to add item', variant: 'destructive' });
      return;
    }
    
    // Reload menu items
    const { data } = await supabase
      .from('stop_menu_items')
      .select('*')
      .eq('place_id', currentStop.id);
    
    if (data) {
      setMenuItems(data as unknown as StopMenuItem[]);
    }
    
    toast({ title: 'Item added!' });
  };

  const handleSubmitRating = async (rating: {
    overall_rating: number;
    parking_rating?: number;
    safety_rating?: number;
    bathroom_rating?: number;
    food_rating?: number;
    price_rating?: number;
    tags: string[];
    comment?: string;
  }) => {
    if (!currentStop || !userId) {
      toast({ title: 'Please sign in to rate', variant: 'destructive' });
      return;
    }
    
    setSubmitting(true);
    
    const { error } = await supabase.from('stop_ratings').insert({
      user_id: userId,
      place_id: currentStop.id,
      place_name: currentStop.name,
      place_type: currentStop.type,
      lat: currentStop.lat,
      lng: currentStop.lng,
      ...rating,
    });
    
    setSubmitting(false);
    
    if (error) {
      toast({ title: 'Failed to submit rating', variant: 'destructive' });
      return;
    }
    
    toast({ title: 'Rating submitted! Thank you.' });
    setActiveTab('reviews');
    
    // Reload ratings
    const { data } = await supabase
      .from('stop_ratings')
      .select('*')
      .eq('place_id', currentStop.id)
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (data) {
      setRatings(data as unknown as StopRating[]);
    }
  };

  const handleImHere = () => {
    // Mark as arrived at stop - would trigger detection logic
    toast({ title: 'Location noted', description: 'Detecting nearby stops...' });
  };

  if (geoLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
          <p className="text-muted-foreground">Detecting your location...</p>
        </div>
      </div>
    );
  }

  if (!currentStop) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
          <div className="flex items-center gap-4 p-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold">Stop Advisor</h1>
          </div>
        </header>
        
        <div className="p-4 flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <MapPin className="w-16 h-16 text-muted-foreground" />
          <h2 className="text-xl font-semibold">No Stop Detected</h2>
          <p className="text-muted-foreground text-center">
            Stop at a truck stop, gas station, or rest area to get recommendations.
          </p>
          <Button onClick={handleImHere} className="mt-4">
            <Hand className="w-4 h-4 mr-2" />
            I'm stopping here
          </Button>
        </div>
        
        <BottomNav activeTab="stops" onTabChange={(tab) => navigate(`/${tab}`)} />
      </div>
    );
  }

  const averageRating = ratings.length > 0
    ? ratings.reduce((sum, r) => sum + r.overall_rating, 0) / ratings.length
    : currentStop.averageRating || 0;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="flex items-center gap-4 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">{currentStop.name}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary" className="text-xs">
                {currentStop.type.replace('_', ' ')}
              </Badge>
              <div className="flex items-center gap-1">
                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                <span>{averageRating.toFixed(1)}</span>
                <span>({ratings.length || currentStop.ratingCount || 0})</span>
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm">
            <Navigation2 className="w-4 h-4 mr-1" />
            Navigate
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Location Card */}
        <Card>
          <CardContent className="py-3 flex items-center gap-3">
            <MapPin className="w-5 h-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm">{currentStop.address}</p>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4">
            <TabsTrigger value="menu">Menu</TabsTrigger>
            <TabsTrigger value="ai">AI Tips</TabsTrigger>
            <TabsTrigger value="rate">Rate</TabsTrigger>
            <TabsTrigger value="reviews">Reviews</TabsTrigger>
          </TabsList>

          <TabsContent value="menu" className="mt-4">
            <StopMenu
              placeId={currentStop.id}
              placeType={currentStop.type}
              menuItems={menuItems}
              onAddItem={handleAddMenuItem}
            />
          </TabsContent>

          <TabsContent value="ai" className="mt-4">
            <AIFoodRecommendation
              placeType={currentStop.type}
              menuItems={menuItems}
              userProfile={userProfile}
            />
            {!userProfile && (
              <Card className="mt-4">
                <CardContent className="py-4 text-center">
                  <p className="text-sm text-muted-foreground mb-2">
                    Set up your food preferences for personalized recommendations
                  </p>
                  <Button variant="outline" size="sm" onClick={() => navigate('/food-preferences')}>
                    Set Preferences
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="rate" className="mt-4">
            <StopRatingForm
              placeName={currentStop.name}
              onSubmit={handleSubmitRating}
              isLoading={submitting}
            />
          </TabsContent>

          <TabsContent value="reviews" className="mt-4 space-y-3">
            {ratings.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No reviews yet. Be the first to rate!
                </CardContent>
              </Card>
            ) : (
              ratings.map(rating => (
                <Card key={rating.id}>
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between mb-2">
                      <StarRating rating={rating.overall_rating} size="sm" />
                      <span className="text-xs text-muted-foreground">
                        {new Date(rating.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {rating.tags && rating.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {rating.tags.map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag.replace('_', ' ')}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {rating.comment && (
                      <p className="text-sm text-muted-foreground">{rating.comment}</p>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      <BottomNav activeTab="stops" onTabChange={(tab) => navigate(`/${tab}`)} />
    </div>
  );
};

export default StopAdvisorScreen;
