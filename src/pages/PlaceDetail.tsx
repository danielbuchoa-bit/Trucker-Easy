import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, Star, MapPin, Clock, Phone, Navigation, 
  ParkingSquare, Fuel, Droplets, Coffee, Scale, Wifi,
  ThumbsUp, Flag, Building2, Loader2, Sparkles, ThumbsDown
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { enUS } from 'date-fns/locale';

interface PlaceData {
  id: string;
  name: string;
  type: string;
  address: string;
  phone?: string;
  distance?: string;
  rating?: number;
  reviewCount?: number;
  parking?: 'available' | 'limited' | 'full';
  parkingSpots?: { total: number; available: number };
  isOpen?: boolean;
  hours?: string;
  lat: number;
  lng: number;
}

interface LocationState {
  place?: PlaceData;
}

interface Review {
  id: string;
  user_id: string;
  poi_id: string;
  poi_name: string;
  cleanliness_rating: number;
  friendliness_rating: number;
  recommendation_rating: number;
  structure_rating: number | null;
  would_return: boolean | null;
  created_at: string;
}

interface AggregateRating {
  avg_overall: number | null;
  avg_cleanliness: number | null;
  avg_friendliness: number | null;
  avg_recommendation: number | null;
  review_count: number | null;
  would_return_pct: number | null;
}

const PlaceDetailScreen = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const locationState = location.state as LocationState | null;
  
  const [activeTab, setActiveTab] = useState('info');
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [rating, setRating] = useState(0);
  const [cleanlinessRating, setCleanlinessRating] = useState(0);
  const [friendlinessRating, setFriendlinessRating] = useState(0);
  const [wouldReturn, setWouldReturn] = useState<boolean | null>(null);
  const [place, setPlace] = useState<PlaceData | null>(locationState?.place || null);
  const [loading, setLoading] = useState(!locationState?.place);
  const [realAddress, setRealAddress] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [aggregateRating, setAggregateRating] = useState<AggregateRating | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Fetch reviews from database
  const fetchReviews = useCallback(async (poiId: string) => {
    setReviewsLoading(true);
    try {
      // Fetch individual reviews
      const { data: reviewsData, error: reviewsError } = await supabase
        .from('poi_feedback')
        .select('*')
        .eq('poi_id', poiId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (reviewsError) {
        console.error('Error fetching reviews:', reviewsError);
      } else {
        setReviews(reviewsData || []);
      }

      // Fetch aggregate rating
      const { data: aggregateData, error: aggregateError } = await supabase
        .from('poi_ratings_aggregate')
        .select('*')
        .eq('poi_id', poiId)
        .maybeSingle();

      if (aggregateError) {
        console.error('Error fetching aggregate:', aggregateError);
      } else if (aggregateData) {
        setAggregateRating(aggregateData);
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setReviewsLoading(false);
    }
  }, []);

  // Fetch place details if not passed via state
  useEffect(() => {
    const fetchPlaceDetails = async () => {
      if (place) {
        // If we have place data, fetch the real address
        if (place.lat && place.lng && !place.address) {
          try {
            const { data } = await supabase.functions.invoke('nb_reverse_geocode', {
              body: { lat: place.lat, lng: place.lng }
            });
            if (data?.label) {
              setRealAddress(data.label);
            }
          } catch (error) {
            console.error('Error fetching address:', error);
          }
        }
        
        // Fetch reviews for this place
        if (place.id) {
          fetchReviews(place.id);
        }
        
        setLoading(false);
        return;
      }

      // Try to get place from localStorage (saved when navigating)
      const savedPlace = localStorage.getItem(`place_${id}`);
      if (savedPlace) {
        try {
          const parsedPlace = JSON.parse(savedPlace);
          setPlace(parsedPlace);
          
          // Fetch real address if coordinates available
          if (parsedPlace.lat && parsedPlace.lng) {
            const { data } = await supabase.functions.invoke('nb_reverse_geocode', {
              body: { lat: parsedPlace.lat, lng: parsedPlace.lng }
            });
            if (data?.label) {
              setRealAddress(data.label);
            }
          }
          
          // Fetch reviews
          if (parsedPlace.id) {
            fetchReviews(parsedPlace.id);
          }
          
          setLoading(false);
          return;
        } catch (e) {
          console.error('Error parsing saved place:', e);
        }
      }

      // Fallback: show error state
      setLoading(false);
    };

    fetchPlaceDetails();
  }, [id, place, fetchReviews]);

  // Default amenities for truck stops
  const amenities = [
    { id: 'fuel', icon: Fuel, label: 'Diesel' },
    { id: 'parking', icon: ParkingSquare, label: 'Truck Parking' },
    { id: 'shower', icon: Droplets, label: 'Showers' },
    { id: 'food', icon: Coffee, label: 'Restaurant' },
    { id: 'scales', icon: Scale, label: 'CAT Scales' },
    { id: 'wifi', icon: Wifi, label: 'Free WiFi' },
  ];

  // Calculate average rating from a review
  const getReviewAverage = (review: Review): number => {
    const ratings = [review.cleanliness_rating, review.friendliness_rating, review.recommendation_rating];
    if (review.structure_rating) ratings.push(review.structure_rating);
    return ratings.reduce((a, b) => a + b, 0) / ratings.length;
  };

  const tabs = [
    { id: 'info', label: t.place.info },
    { id: 'reviews', label: `${t.place.reviews} (${aggregateRating?.review_count || reviews.length || 0})` },
    { id: 'reports', label: t.place.reports },
  ];

  const getParkingColor = (status: string) => {
    switch (status) {
      case 'available': return 'text-parking-available';
      case 'limited': return 'text-parking-limited';
      case 'full': return 'text-parking-full';
      default: return 'text-status-unknown';
    }
  };

  // Map frontend poi types to valid database values
  const mapPoiTypeToDbValue = (type: string | undefined): 'fuel' | 'truck_stop' | 'rest_area' => {
    if (!type) return 'truck_stop';
    const typeLower = type.toLowerCase();
    
    // Map various frontend type names to valid database enum values
    if (typeLower.includes('fuel') || typeLower.includes('gas') || typeLower.includes('diesel')) {
      return 'fuel';
    }
    if (typeLower.includes('rest') || typeLower === 'rest_area' || typeLower === 'restarea') {
      return 'rest_area';
    }
    // Default to truck_stop for truck stops, travel centers, and unknown types
    return 'truck_stop';
  };

  const handleSubmitReview = async () => {
    if (rating === 0 || cleanlinessRating === 0 || friendlinessRating === 0) {
      toast.error('Por favor, preencha todas as avaliações');
      return;
    }
    
    if (!place) return;

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Você precisa estar logado para avaliar');
        navigate('/auth');
        return;
      }

      const dbPoiType = mapPoiTypeToDbValue(place.type);
      
      const { error } = await supabase.from('poi_feedback').insert({
        user_id: user.id,
        poi_id: place.id,
        poi_name: place.name,
        poi_type: dbPoiType,
        cleanliness_rating: cleanlinessRating,
        friendliness_rating: friendlinessRating,
        recommendation_rating: rating,
        would_return: wouldReturn,
      });

      if (error) throw error;

      toast.success(t.reviews.thankYou);
      setShowReviewForm(false);
      setRating(0);
      setCleanlinessRating(0);
      setFriendlinessRating(0);
      setWouldReturn(null);
      
      // Refresh reviews
      fetchReviews(place.id);
    } catch (error) {
      console.error('Error submitting review:', error);
      toast.error('Error submitting review');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNavigate = () => {
    if (place) {
      navigate('/navigation', {
        state: {
          destination: {
            lat: place.lat,
            lng: place.lng,
            name: place.name,
            address: realAddress || place.address,
            type: place.type,
          },
          autoStart: true,
        },
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
          <p className="text-muted-foreground">Loading place details...</p>
        </div>
      </div>
    );
  }

  if (!place) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Place Not Found</h2>
          <p className="text-muted-foreground mb-4">Could not load details for this place.</p>
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const displayAddress = realAddress || place.address || 'Address not available';
  const parkingSpots = place.parkingSpots || { total: 150, available: Math.floor(Math.random() * 100) + 20 };
  const parkingStatus = place.parking || 'available';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header Image */}
      <div className="relative h-36 sm:h-48 bg-gradient-to-b from-primary/30 to-background shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 safe-top w-10 h-10 bg-background/80 backdrop-blur-sm rounded-full flex items-center justify-center z-10"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        
        <button
          onClick={handleNavigate}
          className="absolute top-4 right-4 safe-top w-10 h-10 bg-primary rounded-full flex items-center justify-center z-10"
        >
          <Navigation className="w-5 h-5 text-primary-foreground" />
        </button>
      </div>

      {/* Scrollable Content */}
      <ScrollArea className="flex-1 -mt-8">
        <div className="pb-6">
          {/* Place Info Card */}
          <div className="px-4 relative z-10">
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h1 className="text-lg sm:text-xl font-bold text-foreground truncate">{place.name}</h1>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {place.rating && (
                      <>
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-primary fill-primary" />
                          <span className="font-medium text-foreground">{place.rating}</span>
                        </div>
                        <span className="text-muted-foreground">•</span>
                      </>
                    )}
                    <span className="text-sm text-muted-foreground">{place.reviewCount || 0} reviews</span>
                  </div>
                </div>
                
                <div className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium shrink-0 ${place.isOpen !== false ? 'bg-status-open/20 text-status-open' : 'bg-status-closed/20 text-status-closed'}`}>
                  {place.isOpen !== false ? 'Open' : 'Closed'}
                </div>
              </div>

              <div className="flex items-start gap-2 mt-3 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                <span className="break-words">{displayAddress}</span>
              </div>
              
              <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4 shrink-0" />
                <span>{place.hours || '24 Hours'}</span>
              </div>
              
              {place.phone && (
                <a href={`tel:${place.phone}`} className="flex items-center gap-2 mt-2 text-sm text-primary underline">
                  <Phone className="w-4 h-4 shrink-0" />
                  <span>{place.phone}</span>
                </a>
              )}

              {/* Parking Status */}
              <div className="mt-4 p-3 bg-secondary/50 rounded-lg">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <ParkingSquare className={`w-5 h-5 ${getParkingColor(parkingStatus)}`} />
                    <span className="font-medium text-foreground">Parking</span>
                  </div>
                  <span className={`font-bold ${getParkingColor(parkingStatus)}`}>
                    {parkingSpots.available} / {parkingSpots.total} spots
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Updated 5 min ago
                </p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 px-4 mt-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2 sm:py-3 text-xs sm:text-sm font-medium rounded-lg transition-all ${
                  activeTab === tab.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="px-4 mt-4">
            {activeTab === 'info' && (
              <div className="space-y-4">
                {/* Amenities */}
                <div className="bg-card rounded-xl border border-border p-4">
                  <h3 className="font-semibold text-foreground mb-3">Amenities</h3>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
                    {amenities.map((amenity) => {
                      const Icon = amenity.icon;
                      return (
                        <div key={amenity.id} className="flex flex-col items-center gap-1 sm:gap-2 p-2 sm:p-3 bg-secondary/50 rounded-lg">
                          <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                          <span className="text-[10px] sm:text-xs text-muted-foreground text-center leading-tight">{amenity.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Quick Report */}
                <div className="bg-card rounded-xl border border-border p-4">
                  <h3 className="font-semibold text-foreground mb-3">{t.report.quickReport}</h3>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => toast.success(t.report.thanks)}
                      className="flex-1 py-2 sm:py-3 text-xs sm:text-sm bg-parking-available/20 text-parking-available rounded-lg font-medium"
                    >
                      {t.place.available}
                    </button>
                    <button 
                      onClick={() => toast.success(t.report.thanks)}
                      className="flex-1 py-2 sm:py-3 text-xs sm:text-sm bg-parking-limited/20 text-parking-limited rounded-lg font-medium"
                    >
                      {t.place.limited}
                    </button>
                    <button 
                      onClick={() => toast.success(t.report.thanks)}
                      className="flex-1 py-2 sm:py-3 text-xs sm:text-sm bg-parking-full/20 text-parking-full rounded-lg font-medium"
                    >
                      {t.place.full}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="space-y-4">
                {/* Aggregate Rating Summary */}
                {aggregateRating && aggregateRating.review_count && aggregateRating.review_count > 0 && (
                  <div className="bg-card rounded-xl border border-border p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex items-center gap-1">
                        <Star className="w-6 h-6 text-primary fill-primary" />
                        <span className="text-2xl font-bold">{aggregateRating.avg_overall?.toFixed(1)}</span>
                      </div>
                      <span className="text-muted-foreground">
                        ({aggregateRating.review_count} reviews)
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cleanliness:</span>
                        <span className="font-medium">{aggregateRating.avg_cleanliness?.toFixed(1) || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Service:</span>
                        <span className="font-medium">{aggregateRating.avg_friendliness?.toFixed(1) || '-'}</span>
                      </div>
                      {aggregateRating.would_return_pct !== null && (
                        <div className="flex justify-between col-span-2">
                          <span className="text-muted-foreground">Would return:</span>
                          <span className="font-medium text-green-500">{aggregateRating.would_return_pct?.toFixed(0)}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Write Review Button */}
                {!showReviewForm ? (
                  <button
                    onClick={() => setShowReviewForm(true)}
                    className="w-full py-3 sm:py-4 bg-primary text-primary-foreground rounded-xl font-semibold text-sm sm:text-base"
                  >
                    {t.reviews.writeReview}
                  </button>
                ) : (
                  <div className="bg-card rounded-xl border border-border p-4 space-y-4">
                    <h3 className="font-semibold text-foreground">{t.reviews.writeReview}</h3>
                    
                    {/* Recommendation Rating */}
                    <div>
                      <label className="text-sm text-muted-foreground mb-2 block">Overall recommendation</label>
                      <div className="flex gap-1 sm:gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() => setRating(star)}
                            className="p-1"
                          >
                            <Star 
                              className={`w-6 h-6 sm:w-8 sm:h-8 ${star <= rating ? 'text-primary fill-primary' : 'text-muted-foreground'}`} 
                            />
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Cleanliness Rating */}
                    <div>
                      <label className="text-sm text-muted-foreground mb-2 block">Cleanliness</label>
                      <div className="flex gap-1 sm:gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() => setCleanlinessRating(star)}
                            className="p-1"
                          >
                            <Star 
                              className={`w-5 h-5 sm:w-6 sm:h-6 ${star <= cleanlinessRating ? 'text-primary fill-primary' : 'text-muted-foreground'}`} 
                            />
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Friendliness Rating */}
                    <div>
                      <label className="text-sm text-muted-foreground mb-2 block">Service</label>
                      <div className="flex gap-1 sm:gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() => setFriendlinessRating(star)}
                            className="p-1"
                          >
                            <Star 
                              className={`w-5 h-5 sm:w-6 sm:h-6 ${star <= friendlinessRating ? 'text-primary fill-primary' : 'text-muted-foreground'}`} 
                            />
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Would Return */}
                    <div>
                      <label className="text-sm text-muted-foreground mb-2 block">Would you return?</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setWouldReturn(true)}
                          className={`flex-1 py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-2 ${
                            wouldReturn === true 
                              ? 'bg-green-500/20 text-green-500 border border-green-500' 
                              : 'bg-secondary text-muted-foreground'
                          }`}
                        >
                          <ThumbsUp className="w-4 h-4" />
                          Yes
                        </button>
                        <button
                          onClick={() => setWouldReturn(false)}
                          className={`flex-1 py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-2 ${
                            wouldReturn === false 
                              ? 'bg-red-500/20 text-red-500 border border-red-500' 
                              : 'bg-secondary text-muted-foreground'
                          }`}
                        >
                          <ThumbsDown className="w-4 h-4" />
                          No
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => setShowReviewForm(false)}
                        className="flex-1 py-2 sm:py-3 bg-secondary text-foreground rounded-lg font-medium text-sm"
                        disabled={submitting}
                      >
                        {t.common.cancel}
                      </button>
                      <button
                        onClick={handleSubmitReview}
                        disabled={submitting}
                        className="flex-1 py-2 sm:py-3 bg-primary text-primary-foreground rounded-lg font-medium text-sm disabled:opacity-50"
                      >
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t.reviews.submit}
                      </button>
                    </div>
                  </div>
                )}

                {/* Reviews Loading */}
                {reviewsLoading && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <span className="ml-2 text-muted-foreground text-sm">Loading reviews...</span>
                  </div>
                )}

                {/* No Reviews */}
                {!reviewsLoading && reviews.length === 0 && (
                  <div className="bg-card rounded-xl border border-border p-6 text-center">
                    <Sparkles className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground text-sm">No reviews yet.</p>
                    <p className="text-muted-foreground text-xs mt-1">Be the first to review!</p>
                  </div>
                )}

                {/* Reviews List */}
                {!reviewsLoading && reviews.map((review) => {
                  const avgRating = getReviewAverage(review);
                  const userInitial = review.user_id.substring(0, 2).toUpperCase();
                  
                  return (
                    <div key={review.id} className="bg-card rounded-xl border border-border p-3 sm:p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                            {userInitial}
                          </div>
                          <span className="font-medium text-foreground text-sm">Driver</span>
                        </div>
                        <span className="text-xs sm:text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(review.created_at), { addSuffix: true, locale: enUS })}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-0.5 mb-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-3 h-3 sm:w-4 sm:h-4 ${star <= Math.round(avgRating) ? 'text-primary fill-primary' : 'text-muted-foreground'}`}
                          />
                        ))}
                        <span className="text-xs text-muted-foreground ml-1">({avgRating.toFixed(1)})</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground mb-2">
                        <span>Cleanliness: {review.cleanliness_rating}/5</span>
                        <span>Service: {review.friendliness_rating}/5</span>
                      </div>
                      
                      {review.would_return !== null && (
                        <div className="flex items-center gap-1 text-xs">
                          {review.would_return ? (
                            <span className="text-green-500 flex items-center gap-1">
                              <ThumbsUp className="w-3 h-3" /> Would return
                            </span>
                          ) : (
                            <span className="text-red-500 flex items-center gap-1">
                              <ThumbsDown className="w-3 h-3" /> Would not return
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab === 'reports' && (
              <div className="space-y-4">
                {/* Company Rating Section */}
                <div className="bg-card rounded-xl border border-border p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Building2 className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-foreground">{t.reviews.companyRating}</h3>
                  </div>
                  
                  <p className="text-xs sm:text-sm text-muted-foreground mb-4">
                    {t.reviews.rateShipper}
                  </p>
                  
                  <button
                    onClick={() => navigate(`/company-review/${id}`)}
                    className="w-full py-2 sm:py-3 bg-primary text-primary-foreground rounded-lg font-medium text-sm"
                  >
                    {t.reviews.rateCompany}
                  </button>
                </div>

                {/* Recent Reports */}
                <div className="bg-card rounded-xl border border-border p-4">
                  <h3 className="font-semibold text-foreground mb-3">{t.place.recentReports}</h3>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b border-border">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-parking-available" />
                        <span className="text-xs sm:text-sm text-foreground">Parking Available</span>
                      </div>
                      <span className="text-xs text-muted-foreground">5 min ago</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-border">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-parking-limited" />
                        <span className="text-xs sm:text-sm text-foreground">Parking Limited</span>
                      </div>
                      <span className="text-xs text-muted-foreground">25 min ago</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-parking-available" />
                        <span className="text-xs sm:text-sm text-foreground">Parking Available</span>
                      </div>
                      <span className="text-xs text-muted-foreground">1 hour ago</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

export default PlaceDetailScreen;
