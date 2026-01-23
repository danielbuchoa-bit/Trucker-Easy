import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, Star, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RateFacilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  facilityName?: string;
  facilityId?: string;
  userLocation?: { lat: number; lng: number } | null;
}

const RateFacilityModal: React.FC<RateFacilityModalProps> = ({
  isOpen,
  onClose,
  facilityName: initialName = '',
  facilityId,
  userLocation,
}) => {
  const [facilityName, setFacilityName] = useState(initialName);
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!facilityName.trim() || rating === 0) {
      toast.error('Please enter a facility name and rating');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast.error('Please sign in to rate facilities');
        return;
      }

      const { error } = await supabase.from('facility_ratings').insert({
        user_id: userData.user.id,
        facility_name: facilityName.trim(),
        facility_type: 'shipper',
        overall_rating: rating,
        comment: comment.trim() || null,
        lat: userLocation?.lat || null,
        lng: userLocation?.lng || null,
      });

      if (error) throw error;

      toast.success('Rating submitted successfully!');
      onClose();
      // Reset form
      setFacilityName('');
      setRating(0);
      setComment('');
    } catch (err) {
      console.error('Error submitting rating:', err);
      toast.error('Failed to submit rating. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayRating = hoveredRating || rating;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Rate a Facility
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Facility Name */}
          <div className="space-y-2">
            <Label htmlFor="facility-name">Facility Name *</Label>
            <Input
              id="facility-name"
              placeholder="Enter facility name..."
              value={facilityName}
              onChange={(e) => setFacilityName(e.target.value)}
              maxLength={100}
            />
          </div>

          {/* Star Rating */}
          <div className="space-y-2">
            <Label>Rating *</Label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="p-1 transition-transform hover:scale-110 focus:outline-none"
                  aria-label={`Rate ${star} stars`}
                >
                  <Star
                    className={`w-8 h-8 transition-colors ${
                      star <= displayRating
                        ? 'fill-primary text-primary'
                        : 'text-muted-foreground'
                    }`}
                  />
                </button>
              ))}
              {displayRating > 0 && (
                <span className="ml-2 text-sm text-muted-foreground">
                  {displayRating} / 5
                </span>
              )}
            </div>
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <Label htmlFor="comment">Comment (optional)</Label>
            <Textarea
              id="comment"
              placeholder="Share your experience... (max 280 characters)"
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 280))}
              rows={3}
              maxLength={280}
            />
            <p className="text-xs text-muted-foreground text-right">
              {comment.length}/280
            </p>
          </div>

          {/* Submit Button */}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!facilityName.trim() || rating === 0 || isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Rating'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RateFacilityModal;
