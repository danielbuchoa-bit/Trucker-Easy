import React, { useState, useEffect } from 'react';
import { Loader2, MapPin, Clock, Star, Lightbulb, Truck, Bath, Fuel, Users, ParkingCircle, Coffee, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import StarRating from '@/components/stops/StarRating';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface CompleteFacilityReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  userLocation?: { lat: number; lng: number } | null;
  prefilledName?: string;
  prefilledAddress?: string;
}

type LocationType = 'facility' | 'gas_station';

const TIME_OPTIONS = [
  { value: '0-30', label: '< 30 min' },
  { value: '30-60', label: '30-60 min' },
  { value: '60-120', label: '1-2 hrs' },
  { value: '120+', label: '2+ hrs' },
];

const CompleteFacilityReviewModal: React.FC<CompleteFacilityReviewModalProps> = ({
  isOpen,
  onClose,
  userLocation,
  prefilledName = '',
  prefilledAddress = '',
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [loadingAddress, setLoadingAddress] = useState(false);
  
  // Type selector
  const [locationType, setLocationType] = useState<LocationType>('facility');
  
  // Common fields
  const [facilityName, setFacilityName] = useState(prefilledName);
  const [facilityAddress, setFacilityAddress] = useState(prefilledAddress);
  const [notes, setNotes] = useState('');
  
  // ============ FACILITY RATINGS ============
  const [facilityType, setFacilityType] = useState<'shipper' | 'receiver' | 'both'>('shipper');
  const [friendlyStaff, setFriendlyStaff] = useState(0);
  const [loadingTime, setLoadingTime] = useState(0);
  const [easyAccess, setEasyAccess] = useState(0);
  const [bathroomAvailable, setBathroomAvailable] = useState(0);
  const [driverFacilities, setDriverFacilities] = useState(0);
  const [tookTooLong, setTookTooLong] = useState<'yes' | 'no' | ''>('');
  const [waitTimeMinutes, setWaitTimeMinutes] = useState('');
  
  // ============ GAS STATION RATINGS ============
  const [gsOverallRating, setGsOverallRating] = useState(0);
  const [gsStructureRating, setGsStructureRating] = useState(0);
  const [gsCleanlinessRating, setGsCleanlinessRating] = useState(0);
  const [gsFriendlinessRating, setGsFriendlinessRating] = useState(0);
  const [gsFuelPriceRating, setGsFuelPriceRating] = useState(0);
  const [gsFoodRating, setGsFoodRating] = useState(0);
  const [gsWouldReturn, setGsWouldReturn] = useState<boolean | null>(null);

  // Calculate final rating based on type
  const calculateFinalRating = () => {
    if (locationType === 'facility') {
      const ratings = [friendlyStaff, loadingTime, easyAccess, bathroomAvailable, driverFacilities].filter(r => r > 0);
      if (ratings.length === 0) return 0;
      return ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
    } else {
      // Gas station: use overall rating as primary, average with details if provided
      if (gsOverallRating === 0) return 0;
      const ratings = [gsOverallRating, gsStructureRating, gsCleanlinessRating, gsFriendlinessRating].filter(r => r > 0);
      return ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
    }
  };

  const finalRating = calculateFinalRating();

  // Handle type change - reset relevant ratings
  const handleTypeChange = (newType: LocationType) => {
    setLocationType(newType);
    // Reset all ratings when switching types
    if (newType === 'facility') {
      setGsOverallRating(0);
      setGsStructureRating(0);
      setGsCleanlinessRating(0);
      setGsFriendlinessRating(0);
      setGsFuelPriceRating(0);
      setGsFoodRating(0);
      setGsWouldReturn(null);
    } else {
      setFriendlyStaff(0);
      setLoadingTime(0);
      setEasyAccess(0);
      setBathroomAvailable(0);
      setDriverFacilities(0);
      setTookTooLong('');
      setWaitTimeMinutes('');
    }
  };

  // Use current location for address
  const useCurrentLocation = async () => {
    if (!userLocation) {
      toast({ title: 'Location not available', variant: 'destructive' });
      return;
    }
    
    setLoadingAddress(true);
    try {
      const { data, error } = await supabase.functions.invoke('nb_reverse_geocode', {
        body: { lat: userLocation.lat, lng: userLocation.lng }
      });
      
      if (error) throw error;
      
      // nb_reverse_geocode returns { label, road, city, state, ... } directly
      if (data?.label) {
        setFacilityAddress(data.label);
      } else if (data?.road || data?.city) {
        // Fallback to building address from parts
        const parts = [data.road, data.city, data.stateCode || data.state].filter(Boolean);
        setFacilityAddress(parts.length > 0 ? parts.join(', ') : `${userLocation.lat.toFixed(5)}, ${userLocation.lng.toFixed(5)}`);
      } else {
        setFacilityAddress(`${userLocation.lat.toFixed(5)}, ${userLocation.lng.toFixed(5)}`);
      }
    } catch (err) {
      console.error('Reverse geocode error:', err);
      setFacilityAddress(`${userLocation.lat.toFixed(5)}, ${userLocation.lng.toFixed(5)}`);
    }
    setLoadingAddress(false);
  };

  const handleSubmit = async () => {
    if (!facilityName.trim()) {
      toast({ title: locationType === 'facility' ? 'Facility name is required' : 'Gas station name is required', variant: 'destructive' });
      return;
    }
    
    if (!facilityAddress.trim()) {
      toast({ title: 'Address is required', variant: 'destructive' });
      return;
    }
    
    if (finalRating === 0) {
      toast({ title: 'Please rate at least one category', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({ title: 'Please sign in to submit a rating', variant: 'destructive' });
        setSubmitting(false);
        return;
      }

      // Step 1: Create or find facility in the facilities table
      const facilityTypeForDb = locationType === 'gas_station' ? 'both' : facilityType;
      
      // Check if facility already exists nearby (within ~200m)
      let facilityId: string | null = null;
      
      if (userLocation) {
        const { data: nearbyFacilities } = await supabase
          .from('facilities')
          .select('id, name')
          .ilike('name', `%${facilityName.trim().substring(0, 10)}%`)
          .limit(5);
        
        if (nearbyFacilities && nearbyFacilities.length > 0) {
          // Use existing facility
          facilityId = nearbyFacilities[0].id;
        }
      }

      if (!facilityId) {
        // Create new facility
        const { data: newFacility, error: facilityError } = await supabase
          .from('facilities')
          .insert({
            name: facilityName.trim(),
            address: facilityAddress.trim(),
            lat: userLocation?.lat || 0,
            lng: userLocation?.lng || 0,
            facility_type: facilityTypeForDb,
            created_by: user.id,
          })
          .select('id')
          .single();
        
        if (facilityError) throw facilityError;
        facilityId = newFacility.id;
      }

      // Step 2: Create review in facility_reviews table
      if (locationType === 'facility') {
        const timeSpentMap: Record<string, string> = {
          '0-30': 'less_30',
          '30-60': '30_60',
          '60-120': '1_2h',
          '120+': '2_4h',
        };

        const { error: reviewError } = await supabase.from('facility_reviews').insert({
          facility_id: facilityId,
          user_id: user.id,
          overall_rating: Math.round(finalRating),
          treatment_rating: friendlyStaff || null,
          speed_rating: loadingTime || null,
          staff_help_rating: driverFacilities || null,
          parking_rating: easyAccess || null,
          exit_ease_rating: bathroomAvailable || null,
          visit_type: facilityType === 'shipper' ? 'pickup' : facilityType === 'receiver' ? 'delivery' : 'both',
          time_spent: waitTimeMinutes ? timeSpentMap[waitTimeMinutes] || null : null,
          restroom_available: bathroomAvailable > 3 ? 'yes' : bathroomAvailable > 0 ? 'no' : 'unknown',
          tips: notes.trim() || null,
        });

        if (reviewError) throw reviewError;

        // Also save to facility_ratings for backward compatibility
        const avgWaitMinutesMap: Record<string, number> = {
          '0-30': 15, '30-60': 45, '60-120': 90, '120+': 150,
        };
        await supabase.from('facility_ratings').insert({
          facility_name: facilityName.trim(),
          facility_type: facilityType,
          address: facilityAddress.trim(),
          lat: userLocation?.lat || null,
          lng: userLocation?.lng || null,
          user_id: user.id,
          overall_rating: Math.round(finalRating),
          staff_rating: friendlyStaff || null,
          wait_time_rating: loadingTime || null,
          dock_access_rating: easyAccess || null,
          restroom_rating: bathroomAvailable || null,
          avg_wait_minutes: waitTimeMinutes ? avgWaitMinutesMap[waitTimeMinutes] : null,
          comment: notes.trim() || null,
          tags: [] as string[],
        });
      } else {
        // Gas station review - save to facility_reviews
        const { error: reviewError } = await supabase.from('facility_reviews').insert({
          facility_id: facilityId,
          user_id: user.id,
          overall_rating: Math.round(finalRating),
          treatment_rating: gsFriendlinessRating || null,
          speed_rating: null,
          staff_help_rating: gsFriendlinessRating || null,
          parking_rating: gsStructureRating || null,
          exit_ease_rating: null,
          visit_type: 'both',
          tips: notes.trim() || null,
        });

        if (reviewError) throw reviewError;

        // Also save to poi_feedback for backward compatibility
        await supabase.from('poi_feedback').insert({
          poi_id: `manual_${Date.now()}`,
          poi_name: facilityName.trim(),
          poi_type: 'fuel' as const,
          user_id: user.id,
          friendliness_rating: gsFriendlinessRating || gsOverallRating,
          cleanliness_rating: gsCleanlinessRating || gsOverallRating,
          structure_rating: gsStructureRating || null,
          recommendation_rating: gsOverallRating,
          would_return: gsWouldReturn,
        });
      }
      
      toast({ 
        title: 'Thanks! Your rating was saved.', 
        description: `${facilityName} - ${finalRating.toFixed(1)}/5 stars` 
      });
      
      resetForm();
      onClose();
    } catch (error) {
      console.error('Error submitting review:', error);
      toast({ title: 'Failed to submit review', variant: 'destructive' });
    }
    
    setSubmitting(false);
  };

  const resetForm = () => {
    setLocationType('facility');
    setFacilityName(prefilledName);
    setFacilityAddress(prefilledAddress);
    setNotes('');
    // Facility
    setFacilityType('shipper');
    setFriendlyStaff(0);
    setLoadingTime(0);
    setEasyAccess(0);
    setBathroomAvailable(0);
    setDriverFacilities(0);
    setTookTooLong('');
    setWaitTimeMinutes('');
    // Gas station
    setGsOverallRating(0);
    setGsStructureRating(0);
    setGsCleanlinessRating(0);
    setGsFriendlinessRating(0);
    setGsFuelPriceRating(0);
    setGsFoodRating(0);
    setGsWouldReturn(null);
  };

  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen]);

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[90vh] rounded-t-2xl overflow-y-auto">
        <SheetHeader className="pb-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-facility-action" />
            Rate Location
          </SheetTitle>
        </SheetHeader>

        <div className="py-4 space-y-5">
          {/* TYPE SELECTOR - Facility vs Gas Station */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              What are you rating?
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleTypeChange('facility')}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                  locationType === 'facility'
                    ? "border-facility-action bg-facility-action/10"
                    : "border-border bg-card hover:border-muted-foreground"
                )}
              >
                <Truck className={cn(
                  "w-8 h-8",
                  locationType === 'facility' ? "text-facility-action" : "text-muted-foreground"
                )} />
                <span className={cn(
                  "font-medium text-sm",
                  locationType === 'facility' ? "text-facility-action" : "text-foreground"
                )}>
                  Facility
                </span>
                <span className="text-xs text-muted-foreground text-center">
                  Pickup / Delivery
                </span>
              </button>
              
              <button
                type="button"
                onClick={() => handleTypeChange('gas_station')}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                  locationType === 'gas_station'
                    ? "border-facility-action bg-facility-action/10"
                    : "border-border bg-card hover:border-muted-foreground"
                )}
              >
                <Fuel className={cn(
                  "w-8 h-8",
                  locationType === 'gas_station' ? "text-facility-action" : "text-muted-foreground"
                )} />
                <span className={cn(
                  "font-medium text-sm",
                  locationType === 'gas_station' ? "text-facility-action" : "text-foreground"
                )}>
                  Gas Station
                </span>
                <span className="text-xs text-muted-foreground text-center">
                  Truck Stop / Fuel
                </span>
              </button>
            </div>
          </div>

          {/* SECTION: Identification */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {locationType === 'facility' ? 'Facility Information' : 'Gas Station Information'}
            </h3>
            
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="facilityName" className="flex items-center gap-2">
                {locationType === 'facility' ? <Truck className="w-4 h-4" /> : <Fuel className="w-4 h-4" />}
                {locationType === 'facility' ? 'Facility Name *' : 'Gas Station Name *'}
              </Label>
              <Input
                id="facilityName"
                placeholder={locationType === 'facility' ? "Company name" : "Station name"}
                value={facilityName}
                onChange={(e) => setFacilityName(e.target.value)}
                className="h-12 text-base"
              />
            </div>
            
            {/* Facility Type (only for facility) */}
            {locationType === 'facility' && (
              <div className="space-y-2">
                <Label>Type *</Label>
                <RadioGroup
                  value={facilityType}
                  onValueChange={(v) => setFacilityType(v as typeof facilityType)}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="shipper" id="type-shipper" />
                    <Label htmlFor="type-shipper">Shipper</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="receiver" id="type-receiver" />
                    <Label htmlFor="type-receiver">Receiver</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="both" id="type-both" />
                    <Label htmlFor="type-both">Both</Label>
                  </div>
                </RadioGroup>
              </div>
            )}
            
            {/* Address */}
            <div className="space-y-2">
              <Label htmlFor="facilityAddress" className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Address *
              </Label>
              <div className="flex gap-2">
                <Input
                  id="facilityAddress"
                  placeholder="Street, City, State"
                  value={facilityAddress}
                  onChange={(e) => setFacilityAddress(e.target.value)}
                  className="h-12 text-base flex-1"
                />
                {userLocation && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={useCurrentLocation}
                    disabled={loadingAddress}
                    className="h-12 px-3 whitespace-nowrap"
                  >
                    {loadingAddress ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <MapPin className="w-4 h-4 mr-1" />
                        Use GPS
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* SECTION: FACILITY RATINGS */}
          {locationType === 'facility' && (
            <>
              <div className="space-y-4 pt-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Your Experience
                </h3>
                
                <div className="space-y-4 bg-card/50 rounded-xl p-4 border border-border">
                  <div className="space-y-1">
                    <Label className="text-sm">Friendly staff?</Label>
                    <StarRating
                      rating={friendlyStaff}
                      interactive
                      onChange={setFriendlyStaff}
                      size="lg"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-sm">Loading/Unloading time</Label>
                    <p className="text-xs text-muted-foreground">1 = very slow, 5 = fast</p>
                    <StarRating
                      rating={loadingTime}
                      interactive
                      onChange={setLoadingTime}
                      size="lg"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-sm">Easy access for trucks?</Label>
                    <StarRating
                      rating={easyAccess}
                      interactive
                      onChange={setEasyAccess}
                      size="lg"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-sm flex items-center gap-1">
                      <Bath className="w-4 h-4" />
                      Bathrooms available?
                    </Label>
                    <StarRating
                      rating={bathroomAvailable}
                      interactive
                      onChange={setBathroomAvailable}
                      size="lg"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-sm">Driver facilities / structure?</Label>
                    <p className="text-xs text-muted-foreground">Lounge, vending, parking, etc.</p>
                    <StarRating
                      rating={driverFacilities}
                      interactive
                      onChange={setDriverFacilities}
                      size="lg"
                    />
                  </div>
                </div>
              </div>

              {/* Wait Time Section (Facility only) */}
              <div className="space-y-4 pt-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Wait Time
                </h3>
                
                <div className="space-y-3">
                  <Label>Did it take too long?</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={tookTooLong === 'yes' ? 'default' : 'outline'}
                      onClick={() => setTookTooLong('yes')}
                      className="flex-1 h-12"
                    >
                      Yes
                    </Button>
                    <Button
                      type="button"
                      variant={tookTooLong === 'no' ? 'default' : 'outline'}
                      onClick={() => setTookTooLong('no')}
                      className="flex-1 h-12"
                    >
                      No
                    </Button>
                  </div>
                  
                  {tookTooLong === 'yes' && (
                    <div className="space-y-2">
                      <Label>How long did you wait?</Label>
                      <div className="flex flex-wrap gap-2">
                        {TIME_OPTIONS.map((opt) => (
                          <Button
                            key={opt.value}
                            type="button"
                            variant={waitTimeMinutes === opt.value ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setWaitTimeMinutes(opt.value)}
                          >
                            {opt.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* SECTION: GAS STATION RATINGS */}
          {locationType === 'gas_station' && (
            <div className="space-y-4 pt-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Your Experience
              </h3>
              
              <div className="space-y-4 bg-card/50 rounded-xl p-4 border border-border">
                {/* Overall Rating */}
                <div className="space-y-1">
                  <Label className="text-base font-medium">Overall Rating *</Label>
                  <StarRating
                    rating={gsOverallRating}
                    interactive
                    onChange={setGsOverallRating}
                    size="lg"
                  />
                </div>
                
                {/* Detailed Ratings */}
                <div className="pt-2 border-t border-border space-y-3">
                  <Label className="text-muted-foreground text-xs">Detailed Ratings (optional)</Label>
                  
                  <div className="flex items-center gap-2">
                    <ParkingCircle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1">
                      <Label className="text-sm">Structure (parking, amenities)</Label>
                      <StarRating
                        rating={gsStructureRating}
                        interactive
                        onChange={setGsStructureRating}
                        size="md"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Bath className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1">
                      <Label className="text-sm">Cleanliness (bathrooms, common areas)</Label>
                      <StarRating
                        rating={gsCleanlinessRating}
                        interactive
                        onChange={setGsCleanlinessRating}
                        size="md"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1">
                      <Label className="text-sm">Staff friendliness</Label>
                      <StarRating
                        rating={gsFriendlinessRating}
                        interactive
                        onChange={setGsFriendlinessRating}
                        size="md"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Fuel className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1">
                      <Label className="text-sm">Fuel price</Label>
                      <StarRating
                        rating={gsFuelPriceRating}
                        interactive
                        onChange={setGsFuelPriceRating}
                        size="md"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Coffee className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1">
                      <Label className="text-sm">Food options</Label>
                      <StarRating
                        rating={gsFoodRating}
                        interactive
                        onChange={setGsFoodRating}
                        size="md"
                      />
                    </div>
                  </div>
                </div>

                {/* Would Return */}
                <div className="pt-2 border-t border-border space-y-2">
                  <Label>Would you return?</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={gsWouldReturn === true ? 'default' : 'outline'}
                      size="sm"
                      className="flex-1 gap-1"
                      onClick={() => setGsWouldReturn(true)}
                    >
                      <ThumbsUp className="w-4 h-4" />
                      Yes
                    </Button>
                    <Button
                      type="button"
                      variant={gsWouldReturn === false ? 'destructive' : 'outline'}
                      size="sm"
                      className="flex-1 gap-1"
                      onClick={() => setGsWouldReturn(false)}
                    >
                      <ThumbsDown className="w-4 h-4" />
                      No
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: Final Rating */}
          {finalRating > 0 && (
            <div className="bg-facility-action/10 rounded-xl p-4 border border-facility-action/30">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Final Rating</span>
                <div className="flex items-center gap-2">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={cn(
                          "w-5 h-5",
                          star <= Math.round(finalRating) 
                            ? "text-facility-action fill-facility-action" 
                            : "text-muted-foreground"
                        )}
                      />
                    ))}
                  </div>
                  <span className="text-lg font-bold text-facility-action">
                    {finalRating.toFixed(1)}/5
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: Notes */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4" />
              Notes (optional)
            </Label>
            <Textarea
              placeholder="Any tips for other drivers? (max 500 characters)"
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 500))}
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">
              {notes.length}/500
            </p>
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-3 pt-4 pb-safe-bottom">
            <Button variant="outline" onClick={onClose} className="flex-1 h-12">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!facilityName.trim() || !facilityAddress.trim() || finalRating === 0 || submitting}
              className="flex-1 h-12 bg-facility-action hover:bg-facility-action/90 text-facility-action-foreground"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Submit Rating'
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default CompleteFacilityReviewModal;
