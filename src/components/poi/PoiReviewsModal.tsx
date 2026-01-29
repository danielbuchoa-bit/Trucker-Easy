import { useState, useEffect } from 'react';
import { Star, Loader2, MapPin, ThumbsUp, ThumbsDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { PoiRatingSummary } from '@/hooks/useBatchPoiRatings';
import { useNavigate } from 'react-router-dom';

interface PoiReview {
  id: string;
  friendliness_rating: number;
  cleanliness_rating: number;
  structure_rating: number | null;
  recommendation_rating: number;
  would_return: boolean | null;
  created_at: string;
  poi_type: string;
}

// Type for the public view (excludes user_id for privacy)
interface FacilityRatingPublic {
  id: string;
  lat: number | null;
  lng: number | null;
  overall_rating: number;
  wait_time_rating: number | null;
  dock_access_rating: number | null;
  staff_rating: number | null;
  restroom_rating: number | null;
  avg_wait_minutes: number | null;
  created_at: string;
  tags: string[] | null;
  comment: string | null;
  facility_name: string;
  facility_type: string;
  address: string | null;
}

interface FacilityReview {
  id: string;
  overall_rating: number;
  wait_time_rating: number | null;
  dock_access_rating: number | null;
  staff_rating: number | null;
  restroom_rating: number | null;
  comment: string | null;
  created_at: string;
  tags: string[] | null;
  avg_wait_minutes: number | null;
  facility_type: string | null;
}

type Review = (PoiReview | FacilityReview) & { 
  avgRating: number;
  type: 'poi' | 'facility';
  comment?: string | null;
};

interface PoiReviewsModalProps {
  open: boolean;
  onClose: () => void;
  poi: {
    id: string;
    name: string;
    lat: number;
    lng: number;
    address?: string;
    type?: string;
  };
  summary: PoiRatingSummary | null;
}

const StarRating = ({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'lg' }) => {
  const starSize = size === 'lg' ? 'w-5 h-5' : 'w-3.5 h-3.5';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            starSize,
            star <= rating
              ? 'fill-amber-500 text-amber-500'
              : 'text-muted-foreground/30'
          )}
        />
      ))}
    </div>
  );
};

const PoiReviewsModal = ({
  open,
  onClose,
  poi,
  summary,
}: PoiReviewsModalProps) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      fetchReviews();
    }
  }, [open, poi.id, poi.lat, poi.lng]);

  const fetchReviews = async () => {
    setLoading(true);
    const allReviews: Review[] = [];

    try {
      // Fetch from poi_feedback
      const { data: poiFeedback } = await supabase
        .from('poi_feedback')
        .select('*')
        .eq('poi_id', poi.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (poiFeedback && poiFeedback.length > 0) {
        for (const fb of poiFeedback) {
          const avgRating = (
            fb.friendliness_rating + 
            fb.cleanliness_rating + 
            (fb.structure_rating || 3) + 
            fb.recommendation_rating
          ) / 4;
          allReviews.push({
            ...fb,
            avgRating: Math.round(avgRating * 10) / 10,
            type: 'poi',
          });
        }
      }

      // Also fetch from facility_ratings_public view (protects user_id)
      const { data: rawFacilityData } = await supabase
        .from('facility_ratings_public' as any)
        .select('*')
        .gte('lat', poi.lat - 0.002)
        .lte('lat', poi.lat + 0.002)
        .gte('lng', poi.lng - 0.002)
        .lte('lng', poi.lng + 0.002)
        .order('created_at', { ascending: false })
        .limit(20);

      // Cast to proper type
      const facilityRatings = (rawFacilityData || []) as unknown as FacilityRatingPublic[];

      for (const fr of facilityRatings) {
        allReviews.push({
          id: fr.id,
          overall_rating: fr.overall_rating,
          wait_time_rating: fr.wait_time_rating,
          dock_access_rating: fr.dock_access_rating,
          staff_rating: fr.staff_rating,
          restroom_rating: fr.restroom_rating,
          comment: fr.comment,
          created_at: fr.created_at,
          tags: fr.tags,
          avg_wait_minutes: fr.avg_wait_minutes,
          facility_type: fr.facility_type,
          avgRating: fr.overall_rating,
          type: 'facility',
        } as Review);
      }

      // Sort by date and take top 20
      allReviews.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setReviews(allReviews.slice(0, 20));

    } catch (err) {
      console.error('[PoiReviewsModal] Error fetching reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatTag = (tag: string): string => {
    return tag.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const handleRateThisPlace = () => {
    onClose();
    // Navigate to place detail with rate intent
    navigate(`/place/${poi.id}`, {
      state: {
        place: poi,
        openRating: true,
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="text-left">
            <div className="space-y-2">
              <h2 className="text-lg font-bold line-clamp-2">{poi.name}</h2>
              {poi.address && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground font-normal">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span className="line-clamp-1">{poi.address}</span>
                </div>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Summary section */}
        {summary && (
          <div className="px-4 py-3 bg-muted/50 mx-4 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-foreground">{summary.avgRating.toFixed(1)}</div>
                <StarRating rating={Math.round(summary.avgRating)} size="lg" />
              </div>
              <Separator orientation="vertical" className="h-12" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">
                  Based on <span className="font-semibold text-foreground">{summary.totalReviews}</span> driver {summary.totalReviews === 1 ? 'review' : 'reviews'}
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2"
                  onClick={handleRateThisPlace}
                >
                  <Star className="w-3.5 h-3.5 mr-1" />
                  Rate this place
                </Button>
              </div>
            </div>
          </div>
        )}

        {!summary && (
          <div className="px-4 py-3 bg-muted/50 mx-4 rounded-lg text-center">
            <p className="text-sm text-muted-foreground mb-2">No reviews yet</p>
            <Button 
              variant="default" 
              size="sm"
              onClick={handleRateThisPlace}
            >
              <Star className="w-3.5 h-3.5 mr-1" />
              Be the first to rate
            </Button>
          </div>
        )}

        <Separator className="mx-4" />

        {/* Reviews list */}
        <ScrollArea className="flex-1 px-4">
          {loading ? (
            <div className="py-8 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : reviews.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No reviews found for this location.
            </div>
          ) : (
            <div className="py-4 space-y-4">
              {reviews.map((review) => (
                <div key={review.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StarRating rating={Math.round(review.avgRating)} />
                      <span className="text-sm font-medium">{review.avgRating.toFixed(1)}/5</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {review.type === 'poi' ? 'Driver' : 'Facility'}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
                    </span>
                  </div>

                  {/* POI-specific ratings */}
                  {review.type === 'poi' && 'friendliness_rating' in review && (
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant="secondary" className="font-normal">
                        Friendly: {review.friendliness_rating}/5
                      </Badge>
                      <Badge variant="secondary" className="font-normal">
                        Clean: {review.cleanliness_rating}/5
                      </Badge>
                      {review.structure_rating && (
                        <Badge variant="secondary" className="font-normal">
                          Structure: {review.structure_rating}/5
                        </Badge>
                      )}
                      {review.would_return !== null && (
                        <Badge 
                          variant={review.would_return ? 'default' : 'outline'} 
                          className="font-normal"
                        >
                          {review.would_return ? (
                            <><ThumbsUp className="w-3 h-3 mr-1" /> Would return</>
                          ) : (
                            <><ThumbsDown className="w-3 h-3 mr-1" /> Would not return</>
                          )}
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Facility-specific ratings */}
                  {review.type === 'facility' && 'wait_time_rating' in review && (
                    <div className="flex flex-wrap gap-2 text-xs">
                      {review.wait_time_rating && (
                        <Badge variant="outline" className="font-normal">
                          Wait: {review.wait_time_rating}/5
                        </Badge>
                      )}
                      {review.dock_access_rating && (
                        <Badge variant="outline" className="font-normal">
                          Access: {review.dock_access_rating}/5
                        </Badge>
                      )}
                      {review.staff_rating && (
                        <Badge variant="outline" className="font-normal">
                          Staff: {review.staff_rating}/5
                        </Badge>
                      )}
                      {review.restroom_rating && (
                        <Badge variant="outline" className="font-normal">
                          Restroom: {review.restroom_rating}/5
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Tags */}
                  {review.type === 'facility' && 'tags' in review && review.tags && review.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {review.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                          {formatTag(tag)}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Comment */}
                  {review.comment ? (
                    <p className="text-sm text-foreground bg-muted/50 p-2 rounded">
                      "{review.comment}"
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No comment</p>
                  )}

                  <Separator />
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default PoiReviewsModal;
