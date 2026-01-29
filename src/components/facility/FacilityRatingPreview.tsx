import { useState, useEffect } from 'react';
import { Star, MessageSquare, Loader2, ChevronRight, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import FacilityReviewsModal from './FacilityReviewsModal';

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

interface FacilityRatingSummary {
  avgRating: number;
  totalReviews: number;
  breakdown: { [key: number]: number };
}

interface FacilityRatingPreviewProps {
  facilityName: string;
  facilityAddress: string;
  lat?: number;
  lng?: number;
  className?: string;
}

// Normalize address for matching
const normalizeAddress = (address: string): string => {
  return address
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

// Normalize name for matching
const normalizeName = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const FacilityRatingPreview = ({
  facilityName,
  facilityAddress,
  lat,
  lng,
  className,
}: FacilityRatingPreviewProps) => {
  const [summary, setSummary] = useState<FacilityRatingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showReviewsModal, setShowReviewsModal] = useState(false);
  const [matchedFacilityId, setMatchedFacilityId] = useState<string | null>(null);

  useEffect(() => {
    const fetchRatings = async () => {
      setLoading(true);
      setError(null);
      setSummary(null);

      try {
        // Strategy 1: Match by name similarity
        const normalizedName = normalizeName(facilityName);
        const normalizedAddr = normalizeAddress(facilityAddress);

        console.log('[FacilityRatingPreview] Searching for:', {
          name: facilityName,
          normalizedName,
          address: facilityAddress,
          normalizedAddr,
          lat,
          lng,
        });

        // First try: search by name (using public view to protect user_id)
        const { data: rawData, error: queryError } = await supabase
          .from('facility_ratings_public' as any)
          .select('*')
          .ilike('facility_name', `%${normalizedName.split(' ')[0]}%`);

        if (queryError) {
          console.error('[FacilityRatingPreview] Query error:', queryError);
          throw queryError;
        }

        // Cast to proper type
        const facilityRatings = (rawData || []) as unknown as FacilityRatingPublic[];

        // Filter for better matches
        let matchedRatings = facilityRatings.filter((r) => {
          const rName = normalizeName(r.facility_name || '');
          const rAddr = normalizeAddress(r.address || '');

          // Check name similarity (at least first word matches)
          const nameMatch = rName.includes(normalizedName.split(' ')[0]) || 
                           normalizedName.includes(rName.split(' ')[0]);

          // Check address similarity
          const addrMatch = rAddr.includes(normalizedAddr.substring(0, 20)) ||
                           normalizedAddr.includes(rAddr.substring(0, 20));

          // Check lat/lng proximity (within ~200m)
          let locationMatch = false;
          if (lat && lng && r.lat && r.lng) {
            const latDiff = Math.abs(lat - r.lat);
            const lngDiff = Math.abs(lng - r.lng);
            locationMatch = latDiff < 0.002 && lngDiff < 0.002;
          }

          return (nameMatch && addrMatch) || locationMatch;
        });

        // If no matches by name, try by location only (using public view)
        if (matchedRatings.length === 0 && lat && lng) {
          const { data: nearbyRaw } = await supabase
            .from('facility_ratings_public' as any)
            .select('*')
            .gte('lat', lat - 0.005)
            .lte('lat', lat + 0.005)
            .gte('lng', lng - 0.005)
            .lte('lng', lng + 0.005);

          const nearbyRatings = (nearbyRaw || []) as unknown as FacilityRatingPublic[];
          if (nearbyRatings.length > 0) {
            matchedRatings = nearbyRatings;
          }
        }

        if (matchedRatings.length === 0) {
          console.log('[FacilityRatingPreview] No ratings found for facility');
          setLoading(false);
          return;
        }

        console.log('[FacilityRatingPreview] Found', matchedRatings.length, 'ratings');

        // Store the first matched facility ID for the modal
        if (matchedRatings[0]?.id) {
          setMatchedFacilityId(matchedRatings[0].id);
        }

        // Calculate summary
        const totalReviews = matchedRatings.length;
        const avgRating = matchedRatings.reduce((sum, r) => sum + (r.overall_rating || 0), 0) / totalReviews;

        // Calculate breakdown
        const breakdown: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        matchedRatings.forEach((r) => {
          const rating = r.overall_rating || 0;
          if (rating >= 1 && rating <= 5) {
            breakdown[rating]++;
          }
        });

        setSummary({
          avgRating: Math.round(avgRating * 10) / 10,
          totalReviews,
          breakdown,
        });
      } catch (err) {
        console.error('[FacilityRatingPreview] Error:', err);
        setError('Reviews unavailable');
      } finally {
        setLoading(false);
      }
    };

    if (facilityName && facilityAddress) {
      fetchRatings();
    } else {
      setLoading(false);
    }
  }, [facilityName, facilityAddress, lat, lng]);

  // Loading state
  if (loading) {
    return (
      <div className={cn('p-3 bg-card rounded-lg flex items-center gap-2', className)}>
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Checking reviews...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn('p-3 bg-card rounded-lg flex items-center gap-2 text-muted-foreground', className)}>
        <AlertCircle className="w-4 h-4" />
        <span className="text-sm">{error}</span>
      </div>
    );
  }

  // No reviews state
  if (!summary) {
    return (
      <div className={cn('p-3 bg-card rounded-lg', className)}>
        <p className="text-sm text-muted-foreground">
          No reviews yet. Be the first to rate this facility!
        </p>
      </div>
    );
  }

  // Has reviews - show preview
  return (
    <>
      <Button
        variant="ghost"
        className={cn(
          'w-full p-3 h-auto bg-card rounded-lg justify-between hover:bg-accent',
          className
        )}
        onClick={() => setShowReviewsModal(true)}
      >
        <div className="flex items-center gap-3">
          {/* Stars */}
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={cn(
                  'w-4 h-4',
                  star <= Math.round(summary.avgRating)
                    ? 'fill-amber-500 text-amber-500'
                    : 'text-muted-foreground'
                )}
              />
            ))}
          </div>

          {/* Rating number */}
          <span className="font-semibold text-foreground">{summary.avgRating}</span>

          {/* Review count */}
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <MessageSquare className="w-3.5 h-3.5" />
            {summary.totalReviews} {summary.totalReviews === 1 ? 'review' : 'reviews'}
          </span>
        </div>

        <div className="flex items-center gap-1 text-primary">
          <span className="text-sm font-medium">View reviews</span>
          <ChevronRight className="w-4 h-4" />
        </div>
      </Button>

      {/* Reviews Modal */}
      <FacilityReviewsModal
        open={showReviewsModal}
        onClose={() => setShowReviewsModal(false)}
        facilityName={facilityName}
        facilityAddress={facilityAddress}
        lat={lat}
        lng={lng}
        summary={summary}
      />
    </>
  );
};

export default FacilityRatingPreview;
