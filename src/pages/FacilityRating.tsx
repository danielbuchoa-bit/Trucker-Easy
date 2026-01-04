import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Star, Clock, Search, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import BottomNav from '@/components/navigation/BottomNav';
import FacilityRatingForm from '@/components/stops/FacilityRatingForm';
import StarRating from '@/components/stops/StarRating';
import { supabase } from '@/integrations/supabase/client';
import type { FacilityRating } from '@/types/stops';
import { useGeolocation } from '@/hooks/useGeolocation';

const FacilityRatingScreen: React.FC = () => {
  const navigate = useNavigate();
  const { latitude, longitude } = useGeolocation();
  
  const [activeTab, setActiveTab] = useState('browse');
  const [ratings, setRatings] = useState<FacilityRating[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id || null);
    });
  }, []);

  // Load facility ratings
  useEffect(() => {
    const loadRatings = async () => {
      const { data } = await supabase
        .from('facility_ratings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (data) {
        setRatings(data as unknown as FacilityRating[]);
      }
    };
    
    loadRatings();
  }, []);

  const filteredRatings = ratings.filter(r =>
    r.facility_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.address && r.address.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleSubmitRating = async (rating: {
    facility_name: string;
    facility_type: 'shipper' | 'receiver' | 'both';
    address?: string;
    overall_rating: number;
    wait_time_rating?: number;
    dock_access_rating?: number;
    staff_rating?: number;
    restroom_rating?: number;
    tags: string[];
    avg_wait_minutes?: number;
    comment?: string;
  }) => {
    if (!userId) {
      toast({ title: 'Please sign in to rate', variant: 'destructive' });
      return;
    }
    
    setSubmitting(true);
    
    const { error } = await supabase.from('facility_ratings').insert({
      user_id: userId,
      lat: latitude,
      lng: longitude,
      ...rating,
    });
    
    setSubmitting(false);
    
    if (error) {
      console.error('Failed to submit rating:', error);
      toast({ title: 'Failed to submit rating', variant: 'destructive' });
      return;
    }
    
    toast({ title: 'Rating submitted! Thank you.' });
    setActiveTab('browse');
    
    // Reload ratings
    const { data } = await supabase
      .from('facility_ratings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (data) {
      setRatings(data as unknown as FacilityRating[]);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'shipper': return 'bg-blue-500/10 text-blue-700 dark:text-blue-400';
      case 'receiver': return 'bg-green-500/10 text-green-700 dark:text-green-400';
      default: return 'bg-purple-500/10 text-purple-700 dark:text-purple-400';
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="flex items-center gap-4 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Facility Ratings</h1>
            <p className="text-sm text-muted-foreground">Shipper & Receiver Reviews</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="browse">Browse</TabsTrigger>
            <TabsTrigger value="add">
              <Plus className="w-4 h-4 mr-1" />
              Add Rating
            </TabsTrigger>
          </TabsList>

          <TabsContent value="browse" className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search facilities..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Ratings List */}
            {filteredRatings.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  {searchQuery ? 'No facilities found' : 'No ratings yet. Be the first!'}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredRatings.map(rating => (
                  <Card key={rating.id}>
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold">{rating.facility_name}</h3>
                          {rating.address && (
                            <p className="text-sm text-muted-foreground">{rating.address}</p>
                          )}
                        </div>
                        <Badge className={getTypeColor(rating.facility_type)}>
                          {rating.facility_type}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4 mb-2">
                        <StarRating rating={rating.overall_rating} size="sm" />
                        {rating.avg_wait_minutes && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="w-4 h-4" />
                            <span>{rating.avg_wait_minutes} min wait</span>
                          </div>
                        )}
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
                        <p className="text-sm text-muted-foreground mt-2">{rating.comment}</p>
                      )}

                      <div className="text-xs text-muted-foreground mt-2">
                        {new Date(rating.created_at).toLocaleDateString()}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="add">
            <FacilityRatingForm
              onSubmit={handleSubmitRating}
              isLoading={submitting}
            />
          </TabsContent>
        </Tabs>
      </div>

      <BottomNav activeTab="community" onTabChange={(tab) => navigate(`/${tab}`)} />
    </div>
  );
};

export default FacilityRatingScreen;
