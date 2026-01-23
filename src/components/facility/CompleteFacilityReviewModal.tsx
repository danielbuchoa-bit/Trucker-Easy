import React, { useState, useEffect } from 'react';
import { Loader2, MapPin, Clock, Star, Lightbulb, Truck, Bath } from 'lucide-react';
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
  
  // Identification fields
  const [facilityName, setFacilityName] = useState(prefilledName);
  const [facilityAddress, setFacilityAddress] = useState(prefilledAddress);
  const [facilityType, setFacilityType] = useState<'shipper' | 'receiver' | 'both'>('shipper');
  
  // Star ratings (1-5)
  const [friendlyStaff, setFriendlyStaff] = useState(0);
  const [loadingTime, setLoadingTime] = useState(0);
  const [easyAccess, setEasyAccess] = useState(0);
  const [bathroomAvailable, setBathroomAvailable] = useState(0);
  const [driverFacilities, setDriverFacilities] = useState(0);
  
  // Time question
  const [tookTooLong, setTookTooLong] = useState<'yes' | 'no' | ''>('');
  const [waitTimeMinutes, setWaitTimeMinutes] = useState('');
  
  // Notes
  const [notes, setNotes] = useState('');

  // Calculate final rating (average of non-zero ratings)
  const calculateFinalRating = () => {
    const ratings = [friendlyStaff, loadingTime, easyAccess, bathroomAvailable, driverFacilities].filter(r => r > 0);
    if (ratings.length === 0) return 0;
    return ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
  };

  const finalRating = calculateFinalRating();

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
      
      if (data?.address) {
        setFacilityAddress(data.address.label || `${userLocation.lat.toFixed(5)}, ${userLocation.lng.toFixed(5)}`);
      }
    } catch (err) {
      console.error('Reverse geocode error:', err);
      setFacilityAddress(`${userLocation.lat.toFixed(5)}, ${userLocation.lng.toFixed(5)}`);
    }
    setLoadingAddress(false);
  };

  const handleSubmit = async () => {
    if (!facilityName.trim()) {
      toast({ title: 'Facility name is required', variant: 'destructive' });
      return;
    }
    
    if (!facilityAddress.trim()) {
      toast({ title: 'Facility address is required', variant: 'destructive' });
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

      // Map wait time range to minutes
      const avgWaitMinutesMap: Record<string, number> = {
        '0-30': 15,
        '30-60': 45,
        '60-120': 90,
        '120+': 150,
      };

      // Build review data matching facility_ratings table schema
      const reviewData = {
        facility_name: facilityName.trim(),
        facility_type: facilityType,
        address: facilityAddress.trim(),
        lat: userLocation?.lat || null,
        lng: userLocation?.lng || null,
        user_id: user.id,
        overall_rating: Math.round(finalRating * 10) / 10,
        staff_rating: friendlyStaff || null,
        wait_time_rating: loadingTime || null,
        dock_access_rating: easyAccess || null,
        restroom_rating: bathroomAvailable || null,
        avg_wait_minutes: waitTimeMinutes ? avgWaitMinutesMap[waitTimeMinutes] : null,
        comment: notes.trim() || null,
        tags: [] as string[],
      };

      const { error } = await supabase.from('facility_ratings').insert(reviewData);

      if (error) throw error;
      
      toast({ 
        title: 'Thanks! Your rating was saved.', 
        description: `${facilityName} - ${finalRating.toFixed(1)}/5 stars` 
      });
      
      // Reset form and close
      resetForm();
      onClose();
    } catch (error) {
      console.error('Error submitting review:', error);
      toast({ title: 'Failed to submit review', variant: 'destructive' });
    }
    
    setSubmitting(false);
  };

  const resetForm = () => {
    setFacilityName(prefilledName);
    setFacilityAddress(prefilledAddress);
    setFacilityType('shipper');
    setFriendlyStaff(0);
    setLoadingTime(0);
    setEasyAccess(0);
    setBathroomAvailable(0);
    setDriverFacilities(0);
    setTookTooLong('');
    setWaitTimeMinutes('');
    setNotes('');
  };

  // Reset when modal opens
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
            Rate Facility
          </SheetTitle>
        </SheetHeader>

        <div className="py-4 space-y-5">
          {/* SECTION 1: Identification */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Facility Information
            </h3>
            
            {/* Facility Name */}
            <div className="space-y-2">
              <Label htmlFor="facilityName" className="flex items-center gap-2">
                <Truck className="w-4 h-4" />
                Facility Name *
              </Label>
              <Input
                id="facilityName"
                placeholder="Company name"
                value={facilityName}
                onChange={(e) => setFacilityName(e.target.value)}
                className="h-12 text-base"
              />
            </div>
            
            {/* Facility Type */}
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

          {/* SECTION 2: Star Ratings */}
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

          {/* SECTION 3: Time */}
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

          {/* SECTION 4: Final Rating */}
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

          {/* SECTION 5: Notes */}
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
