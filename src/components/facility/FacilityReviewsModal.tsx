import { useState, useEffect } from 'react';
import { Star, Loader2, MapPin, Clock, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

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

interface FacilityRatingSummary {
  avgRating: number;
  totalReviews: number;
  breakdown: { [key: number]: number };
}

interface FacilityReviewsModalProps {
  open: boolean;
  onClose: () => void;
  facilityName: string;
  facilityAddress: string;
  lat?: number;
  lng?: number;
  summary: FacilityRatingSummary | null;
}

// Normalize functions (same as preview)
const normalizeAddress = (address: string): string => {
  return address
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const normalizeName = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

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
              : 'text-muted-foreground'
          )}
        />
      ))}
    </div>
  );
};

const FacilityReviewsModal = ({
  open,
  onClose,
  facilityName,
  facilityAddress,
  lat,
  lng,
  summary,
}: FacilityReviewsModalProps) => {
  const [reviews, setReviews] = useState<FacilityReview[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchReviews();
    }
  }, [open, facilityName, facilityAddress, lat, lng]);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const normalizedName = normalizeName(facilityName);
      const normalizedAddr = normalizeAddress(facilityAddress);

      // First try: search by name
      let { data: facilityRatings } = await supabase
        .from('facility_ratings')
        .select('*')
        .ilike('facility_name', `%${normalizedName.split(' ')[0]}%`)
        .order('created_at', { ascending: false })
        .limit(50);

      // Filter for better matches
      let matchedRatings = facilityRatings?.filter((r) => {
        const rName = normalizeName(r.facility_name || '');
        const rAddr = normalizeAddress(r.address || '');

        const nameMatch = rName.includes(normalizedName.split(' ')[0]) || 
                         normalizedName.includes(rName.split(' ')[0]);
        const addrMatch = rAddr.includes(normalizedAddr.substring(0, 20)) ||
                         normalizedAddr.includes(rAddr.substring(0, 20));

        let locationMatch = false;
        if (lat && lng && r.lat && r.lng) {
          const latDiff = Math.abs(lat - r.lat);
          const lngDiff = Math.abs(lng - r.lng);
          locationMatch = latDiff < 0.002 && lngDiff < 0.002;
        }

        return (nameMatch && addrMatch) || locationMatch;
      });

      // If no matches by name, try by location only
      if ((!matchedRatings || matchedRatings.length === 0) && lat && lng) {
        const { data: nearbyRatings } = await supabase
          .from('facility_ratings')
          .select('*')
          .gte('lat', lat - 0.005)
          .lte('lat', lat + 0.005)
          .gte('lng', lng - 0.005)
          .lte('lng', lng + 0.005)
          .order('created_at', { ascending: false })
          .limit(20);

        if (nearbyRatings) {
          matchedRatings = nearbyRatings;
        }
      }

      // Take only the last 20
      setReviews((matchedRatings || []).slice(0, 20));
    } catch (err) {
      console.error('[FacilityReviewsModal] Error fetching reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatTag = (tag: string): string => {
    return tag.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="text-left">
            <div className="space-y-2">
              <h2 className="text-lg font-bold line-clamp-2">{facilityName}</h2>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground font-normal">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span className="line-clamp-1">{facilityAddress}</span>
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Summary section */}
        {summary && (
          <div className="px-4 py-3 bg-muted/50 mx-4 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-foreground">{summary.avgRating}</div>
                <StarRating rating={Math.round(summary.avgRating)} size="lg" />
              </div>
              <Separator orientation="vertical" className="h-12" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">
                  Based on <span className="font-semibold text-foreground">{summary.totalReviews}</span> driver {summary.totalReviews === 1 ? 'review' : 'reviews'}
                </p>
                {/* Rating breakdown */}
                <div className="mt-2 space-y-1">
                  {[5, 4, 3, 2, 1].map((star) => (
                    <div key={star} className="flex items-center gap-2 text-xs">
                      <span className="w-3 text-muted-foreground">{star}</span>
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full"
                          style={{
                            width: `${summary.totalReviews > 0 ? (summary.breakdown[star] / summary.totalReviews) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <span className="w-6 text-right text-muted-foreground">
                        {summary.breakdown[star] || 0}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
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
              No reviews found for this facility.
            </div>
          ) : (
            <div className="py-4 space-y-4">
              {reviews.map((review) => (
                <div key={review.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StarRating rating={review.overall_rating} />
                      <span className="text-sm font-medium">{review.overall_rating}/5</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
                    </span>
                  </div>

                  {/* Sub-ratings */}
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
                    {review.avg_wait_minutes && (
                      <Badge variant="secondary" className="font-normal">
                        <Clock className="w-3 h-3 mr-1" />
                        {review.avg_wait_minutes} min wait
                      </Badge>
                    )}
                  </div>

                  {/* Tags */}
                  {review.tags && review.tags.length > 0 && (
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
                    <p className="text-xs text-muted-foreground italic">No comment left</p>
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

export default FacilityReviewsModal;
