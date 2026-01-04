import React, { useState } from 'react';
import { Loader2, Car, Clock, Bath, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import StarRating from '@/components/stops/StarRating';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { Facility } from '@/types/collaborative';
import { TIME_SPENT_OPTIONS } from '@/types/collaborative';
import { cn } from '@/lib/utils';

interface EnhancedFacilityReviewFormProps {
  facility: Facility;
  onComplete: () => void;
  onCancel: () => void;
}

const EnhancedFacilityReviewForm: React.FC<EnhancedFacilityReviewFormProps> = ({
  facility,
  onComplete,
  onCancel,
}) => {
  const [submitting, setSubmitting] = useState(false);
  
  // Ratings
  const [overallRating, setOverallRating] = useState(0);
  const [treatmentRating, setTreatmentRating] = useState(0);
  const [speedRating, setSpeedRating] = useState(0);
  const [staffHelpRating, setStaffHelpRating] = useState(0);
  const [parkingRating, setParkingRating] = useState(0);
  const [exitEaseRating, setExitEaseRating] = useState(0);
  
  // Structured fields
  const [visitType, setVisitType] = useState<'pickup' | 'delivery' | 'both'>('pickup');
  const [timeSpent, setTimeSpent] = useState('');
  const [parkingAvailable, setParkingAvailable] = useState<'yes' | 'limited' | 'no' | ''>('');
  const [overnightAllowed, setOvernightAllowed] = useState<'allowed' | 'not_allowed' | 'unknown'>('unknown');
  const [restroomAvailable, setRestroomAvailable] = useState<'yes' | 'no' | 'unknown'>('unknown');
  const [tips, setTips] = useState('');

  const handleSubmit = async () => {
    if (overallRating === 0) {
      toast({ title: 'Please select an overall rating', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: 'Please sign in', variant: 'destructive' });
        setSubmitting(false);
        return;
      }

      // Check if user can review (1 review per 7 days)
      const { data: canReview, error: checkError } = await supabase.rpc('can_review_facility', {
        p_user_id: user.id,
        p_facility_id: facility.id,
      });

      if (checkError) throw checkError;
      
      if (!canReview) {
        toast({ 
          title: 'Review limit reached', 
          description: 'You can only review this facility once per week.',
          variant: 'destructive' 
        });
        setSubmitting(false);
        return;
      }

      const { error } = await supabase.from('facility_reviews').insert({
        facility_id: facility.id,
        user_id: user.id,
        overall_rating: overallRating,
        treatment_rating: treatmentRating || null,
        speed_rating: speedRating || null,
        staff_help_rating: staffHelpRating || null,
        parking_rating: parkingRating || null,
        exit_ease_rating: exitEaseRating || null,
        visit_type: visitType,
        time_spent: timeSpent || null,
        parking_available: parkingAvailable || null,
        overnight_allowed: overnightAllowed,
        restroom_available: restroomAvailable,
        tips: tips.trim() || null,
      });

      if (error) throw error;
      
      toast({ title: 'Review submitted!', description: 'Thank you for helping other drivers.' });
      onComplete();
    } catch (error) {
      console.error('Error submitting review:', error);
      toast({ title: 'Failed to submit review', variant: 'destructive' });
    }
    
    setSubmitting(false);
  };

  return (
    <div className="space-y-5">
      {/* Overall Rating */}
      <div className="space-y-2">
        <Label className="text-base font-medium">Overall Rating *</Label>
        <StarRating
          rating={overallRating}
          interactive
          onChange={setOverallRating}
          size="lg"
        />
      </div>

      {/* Visit Type */}
      <div className="space-y-2">
        <Label>Visit Type *</Label>
        <RadioGroup
          value={visitType}
          onValueChange={(v) => setVisitType(v as typeof visitType)}
          className="flex gap-3"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="pickup" id="pickup" />
            <Label htmlFor="pickup">Pickup</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="delivery" id="delivery" />
            <Label htmlFor="delivery">Delivery</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="both" id="both" />
            <Label htmlFor="both">Both</Label>
          </div>
        </RadioGroup>
      </div>

      {/* Sub-ratings */}
      <div className="space-y-3">
        <Label className="text-muted-foreground">Detailed Ratings (optional)</Label>
        
        <StarRating
          rating={treatmentRating}
          interactive
          onChange={setTreatmentRating}
          label="Treatment / Attitude"
        />
        <StarRating
          rating={speedRating}
          interactive
          onChange={setSpeedRating}
          label="Speed (load/unload time)"
        />
        <StarRating
          rating={staffHelpRating}
          interactive
          onChange={setStaffHelpRating}
          label="Staff Helpfulness"
        />
        <StarRating
          rating={parkingRating}
          interactive
          onChange={setParkingRating}
          label="Parking (for 53')"
        />
        <StarRating
          rating={exitEaseRating}
          interactive
          onChange={setExitEaseRating}
          label="Exit Ease (gates/traffic)"
        />
      </div>

      {/* Time Spent */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Time Spent
        </Label>
        <div className="flex flex-wrap gap-2">
          {TIME_SPENT_OPTIONS.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant={timeSpent === option.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimeSpent(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Parking Available */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Car className="w-4 h-4" />
          Parking
        </Label>
        <div className="flex gap-2">
          {[
            { value: 'yes', label: 'Yes' },
            { value: 'limited', label: 'Limited' },
            { value: 'no', label: 'No' },
          ].map((option) => (
            <Button
              key={option.value}
              type="button"
              variant={parkingAvailable === option.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setParkingAvailable(option.value as typeof parkingAvailable)}
              className="flex-1"
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Overnight */}
      <div className="space-y-2">
        <Label>Overnight Allowed</Label>
        <div className="flex gap-2">
          {[
            { value: 'allowed', label: 'Allowed' },
            { value: 'not_allowed', label: 'Not Allowed' },
            { value: 'unknown', label: 'Unknown' },
          ].map((option) => (
            <Button
              key={option.value}
              type="button"
              variant={overnightAllowed === option.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setOvernightAllowed(option.value as typeof overnightAllowed)}
              className="flex-1"
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Restroom */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Bath className="w-4 h-4" />
          Restroom
        </Label>
        <div className="flex gap-2">
          {[
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
            { value: 'unknown', label: 'Unknown' },
          ].map((option) => (
            <Button
              key={option.value}
              type="button"
              variant={restroomAvailable === option.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setRestroomAvailable(option.value as typeof restroomAvailable)}
              className="flex-1"
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Tips */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4" />
          Quick Tips (optional)
        </Label>
        <Textarea
          placeholder="Gate X, check-in location, docs needed, best entrance..."
          value={tips}
          onChange={(e) => setTips(e.target.value)}
          rows={2}
        />
      </div>

      {/* Submit Buttons */}
      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={overallRating === 0 || submitting}
          className="flex-1"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Submitting...
            </>
          ) : (
            'Submit Review'
          )}
        </Button>
      </div>
    </div>
  );
};

export default EnhancedFacilityReviewForm;
