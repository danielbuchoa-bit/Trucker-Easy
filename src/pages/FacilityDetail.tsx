import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, Star, Clock, Car, Bath, MapPin, Lightbulb, Loader2, PenLine } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import EnhancedFacilityReviewForm from '@/components/facility/EnhancedFacilityReviewForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import BottomNav from '@/components/navigation/BottomNav';
import StarRating from '@/components/stops/StarRating';
import { supabase } from '@/integrations/supabase/client';
import type { Facility, FacilityAggregate, FacilityReview } from '@/types/collaborative';
import { TIME_SPENT_OPTIONS } from '@/types/collaborative';
import { formatDistanceToNow } from 'date-fns';

const FacilityDetailScreen: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [facility, setFacility] = useState<Facility | null>(null);
  const [aggregate, setAggregate] = useState<FacilityAggregate | null>(null);
  const [reviews, setReviews] = useState<FacilityReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRatingSheet, setShowRatingSheet] = useState(false);

  const handleReviewComplete = () => {
    setShowRatingSheet(false);
    // Refresh data after submitting review
    if (id) {
      Promise.all([
        supabase.from('facility_aggregates').select('*').eq('facility_id', id).single(),
        supabase.from('facility_reviews').select('*').eq('facility_id', id).order('created_at', { ascending: false }).limit(20),
      ]).then(([aggregateRes, reviewsRes]) => {
        if (aggregateRes.data) setAggregate(aggregateRes.data as unknown as FacilityAggregate);
        if (reviewsRes.data) setReviews(reviewsRes.data as unknown as FacilityReview[]);
      });
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      
      try {
        const [facilityRes, aggregateRes, reviewsRes] = await Promise.all([
          supabase.from('facilities').select('*').eq('id', id).single(),
          supabase.from('facility_aggregates').select('*').eq('facility_id', id).single(),
          supabase.from('facility_reviews').select('*').eq('facility_id', id).order('created_at', { ascending: false }).limit(20),
        ]);

        if (facilityRes.data) setFacility(facilityRes.data as unknown as Facility);
        if (aggregateRes.data) setAggregate(aggregateRes.data as unknown as FacilityAggregate);
        if (reviewsRes.data) setReviews(reviewsRes.data as unknown as FacilityReview[]);
      } catch (error) {
        console.error('Error fetching facility:', error);
      }
      setLoading(false);
    };

    fetchData();
  }, [id]);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'shipper': return 'bg-blue-500/10 text-blue-700 dark:text-blue-400';
      case 'receiver': return 'bg-green-500/10 text-green-700 dark:text-green-400';
      default: return 'bg-purple-500/10 text-purple-700 dark:text-purple-400';
    }
  };

  const getTimeSpentLabel = (value: string | undefined) => {
    if (!value) return null;
    const option = TIME_SPENT_OPTIONS.find(o => o.value === value);
    return option?.label || value;
  };

  // Calculate time distribution
  const timeDistribution = reviews.reduce((acc, review) => {
    if (review.time_spent) {
      acc[review.time_spent] = (acc[review.time_spent] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const totalTimeReviews = Object.values(timeDistribution).reduce((a, b) => a + b, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!facility) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
          <div className="flex items-center gap-4 p-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold">Facility Not Found</h1>
          </div>
        </header>
        <BottomNav activeTab="community" onTabChange={(tab) => navigate(`/${tab}`)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="flex items-center gap-4 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">{facility.name}</h1>
            <div className="flex items-center gap-2">
              <Badge className={getTypeColor(facility.facility_type)}>
                {facility.facility_type}
              </Badge>
              {aggregate && (
                <div className="flex items-center gap-1 text-sm">
                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                  <span>{Number(aggregate.avg_overall).toFixed(1)}</span>
                  <span className="text-muted-foreground">({aggregate.review_count})</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="p-4 space-y-4">
        {/* Address Card */}
        {facility.address && (
          <Card>
            <CardContent className="py-3 flex items-center gap-3">
              <MapPin className="w-5 h-5 text-primary" />
              <p className="text-sm">{facility.address}</p>
            </CardContent>
          </Card>
        )}

        {/* Ratings Overview */}
        {aggregate && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Ratings Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold">{Number(aggregate.avg_overall).toFixed(1)}</div>
                  <StarRating rating={Math.round(Number(aggregate.avg_overall))} size="sm" />
                  <div className="text-xs text-muted-foreground mt-1">{aggregate.review_count} reviews</div>
                </div>
                
                <div className="flex-1 space-y-2 text-sm">
                  {aggregate.avg_treatment && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Treatment</span>
                      <div className="flex items-center gap-2">
                        <Progress value={Number(aggregate.avg_treatment) * 20} className="w-16 h-2" />
                        <span>{Number(aggregate.avg_treatment).toFixed(1)}</span>
                      </div>
                    </div>
                  )}
                  {aggregate.avg_speed && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Speed</span>
                      <div className="flex items-center gap-2">
                        <Progress value={Number(aggregate.avg_speed) * 20} className="w-16 h-2" />
                        <span>{Number(aggregate.avg_speed).toFixed(1)}</span>
                      </div>
                    </div>
                  )}
                  {aggregate.avg_parking && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Parking</span>
                      <div className="flex items-center gap-2">
                        <Progress value={Number(aggregate.avg_parking) * 20} className="w-16 h-2" />
                        <span>{Number(aggregate.avg_parking).toFixed(1)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Time Distribution */}
        {totalTimeReviews > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Typical Wait Times
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {TIME_SPENT_OPTIONS.map((option) => {
                  const count = timeDistribution[option.value] || 0;
                  const percent = totalTimeReviews > 0 ? (count / totalTimeReviews) * 100 : 0;
                  
                  return (
                    <div key={option.value} className="flex items-center gap-2 text-sm">
                      <span className="w-16 text-muted-foreground">{option.label}</span>
                      <Progress value={percent} className="flex-1 h-2" />
                      <span className="w-8 text-right text-muted-foreground">{count}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Rate Button */}
        <Button 
          onClick={() => setShowRatingSheet(true)}
          className="w-full"
          size="lg"
        >
          <PenLine className="w-4 h-4 mr-2" />
          Avaliar Esta Empresa
        </Button>

        {/* Recent Reviews */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent Reviews</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {reviews.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No reviews yet. Be the first to rate!
              </p>
            ) : (
              reviews.map((review) => (
                <div key={review.id} className="border-b border-border pb-4 last:border-0">
                  <div className="flex items-center justify-between mb-2">
                    <StarRating rating={review.overall_rating} size="sm" />
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mb-2">
                    <Badge variant="outline" className="text-xs capitalize">
                      {review.visit_type}
                    </Badge>
                    {review.time_spent && (
                      <Badge variant="outline" className="text-xs">
                        <Clock className="w-3 h-3 mr-1" />
                        {getTimeSpentLabel(review.time_spent)}
                      </Badge>
                    )}
                    {review.parking_available && (
                      <Badge variant="outline" className="text-xs">
                        <Car className="w-3 h-3 mr-1" />
                        Parking: {review.parking_available}
                      </Badge>
                    )}
                    {review.restroom_available === 'yes' && (
                      <Badge variant="outline" className="text-xs">
                        <Bath className="w-3 h-3 mr-1" />
                        Restroom
                      </Badge>
                    )}
                  </div>
                  
                  {review.tips && (
                    <div className="flex items-start gap-2 text-sm bg-secondary/50 rounded-lg p-2 mt-2">
                      <Lightbulb className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                      <p className="text-muted-foreground">{review.tips}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Rating Sheet */}
      <Sheet open={showRatingSheet} onOpenChange={setShowRatingSheet}>
        <SheetContent side="bottom" className="h-[90vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              Avaliar {facility.name}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <EnhancedFacilityReviewForm
              facility={facility}
              onComplete={handleReviewComplete}
              onCancel={() => setShowRatingSheet(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

      <BottomNav activeTab="community" onTabChange={(tab) => navigate(`/${tab}`)} />
    </div>
  );
};

export default FacilityDetailScreen;
