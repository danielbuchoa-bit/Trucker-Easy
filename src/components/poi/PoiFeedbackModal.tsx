import React, { useState } from 'react';
import { X, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StarRating from '@/components/stops/StarRating';

interface PoiFeedbackModalProps {
  poiName: string;
  poiType: 'fuel' | 'truck_stop' | 'rest_area';
  onSubmit: (ratings: {
    friendliness_rating: number;
    cleanliness_rating: number;
    structure_rating: number;
    recommendation_rating: number;
    would_return: boolean;
  }) => void;
  onSkip: () => void;
}

const PoiFeedbackModal: React.FC<PoiFeedbackModalProps> = ({
  poiName,
  poiType,
  onSubmit,
  onSkip,
}) => {
  const [friendlinessRating, setFriendlinessRating] = useState(0);
  const [cleanlinessRating, setCleanlinessRating] = useState(0);
  const [structureRating, setStructureRating] = useState(0);
  const [recommendationRating, setRecommendationRating] = useState(0);
  const [wouldReturn, setWouldReturn] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = 
    friendlinessRating > 0 && 
    cleanlinessRating > 0 && 
    structureRating > 0 &&
    recommendationRating > 0 &&
    wouldReturn !== null;

  const handleSubmit = async () => {
    if (!canSubmit || wouldReturn === null) return;
    setIsSubmitting(true);
    await onSubmit({
      friendliness_rating: friendlinessRating,
      cleanliness_rating: cleanlinessRating,
      structure_rating: structureRating,
      recommendation_rating: recommendationRating,
      would_return: wouldReturn,
    });
    setIsSubmitting(false);
  };

  const getPoiTypeLabel = () => {
    switch (poiType) {
      case 'fuel': return 'Gas Station';
      case 'truck_stop': return 'Truck Stop';
      case 'rest_area': return 'Rest Area';
      default: return 'Location';
    }
  };

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 pointer-events-none">
      <div className="bg-card border border-border rounded-xl shadow-xl p-4 pointer-events-auto max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 pr-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              How was your visit?
            </p>
            <h3 className="text-sm font-semibold text-foreground truncate">
              {poiName} ({getPoiTypeLabel()})
            </h3>
          </div>
          <button
            onClick={onSkip}
            className="p-1 hover:bg-muted rounded-full transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Questions */}
        <div className="space-y-3">
          {/* Friendliness */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              Service (was the staff friendly?)
            </p>
            <StarRating
              rating={friendlinessRating}
              size="md"
              interactive
              onChange={setFriendlinessRating}
            />
          </div>

          {/* Cleanliness */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              Cleanliness (restrooms, common area)
            </p>
            <StarRating
              rating={cleanlinessRating}
              size="md"
              interactive
              onChange={setCleanlinessRating}
            />
          </div>

          {/* Structure */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              Facilities (parking, amenities)
            </p>
            <StarRating
              rating={structureRating}
              size="md"
              interactive
              onChange={setStructureRating}
            />
          </div>

          {/* Recommendation */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              Overall rating
            </p>
            <StarRating
              rating={recommendationRating}
              size="md"
              interactive
              onChange={setRecommendationRating}
            />
          </div>

          {/* Would Return */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Would you return?
            </p>
            <div className="flex gap-2">
              <Button
                variant={wouldReturn === true ? "default" : "outline"}
                size="sm"
                className="flex-1 gap-1"
                onClick={() => setWouldReturn(true)}
              >
                <ThumbsUp className="w-4 h-4" />
                Yes
              </Button>
              <Button
                variant={wouldReturn === false ? "destructive" : "outline"}
                size="sm"
                className="flex-1 gap-1"
                onClick={() => setWouldReturn(false)}
              >
                <ThumbsDown className="w-4 h-4" />
                No
              </Button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onSkip}
            className="flex-1 text-muted-foreground"
          >
            Skip
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            className="flex-1"
          >
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PoiFeedbackModal;