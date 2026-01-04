import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star, Loader2 } from 'lucide-react';
import StarRating from './StarRating';
import { STOP_TAGS } from '@/types/stops';
import { cn } from '@/lib/utils';

interface StopRatingFormProps {
  placeName: string;
  onSubmit: (rating: {
    overall_rating: number;
    parking_rating?: number;
    safety_rating?: number;
    bathroom_rating?: number;
    food_rating?: number;
    price_rating?: number;
    tags: string[];
    comment?: string;
  }) => Promise<void>;
  isLoading?: boolean;
}

const TAG_LABELS: Record<string, string> = {
  lot_full: 'Lot Full',
  easy_in_out: 'Easy In/Out',
  clean: 'Clean',
  sketchy: 'Sketchy',
  good_coffee: 'Good Coffee',
  good_showers: 'Good Showers',
  truck_friendly: 'Truck Friendly',
  tight_parking: 'Tight Parking',
};

const StopRatingForm: React.FC<StopRatingFormProps> = ({
  placeName,
  onSubmit,
  isLoading = false,
}) => {
  const [overallRating, setOverallRating] = useState(0);
  const [parkingRating, setParkingRating] = useState(0);
  const [safetyRating, setSafetyRating] = useState(0);
  const [bathroomRating, setBathroomRating] = useState(0);
  const [foodRating, setFoodRating] = useState(0);
  const [priceRating, setPriceRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (overallRating === 0) return;

    await onSubmit({
      overall_rating: overallRating,
      parking_rating: parkingRating || undefined,
      safety_rating: safetyRating || undefined,
      bathroom_rating: bathroomRating || undefined,
      food_rating: foodRating || undefined,
      price_rating: priceRating || undefined,
      tags: selectedTags,
      comment: comment.trim() || undefined,
    });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Star className="w-5 h-5 text-yellow-500" />
          Rate {placeName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Rating */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Overall Rating *</label>
          <StarRating
            rating={overallRating}
            interactive
            onChange={setOverallRating}
            size="lg"
          />
        </div>

        {/* Sub-ratings */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-muted-foreground">Detailed Ratings (optional)</label>
          
          <StarRating
            rating={parkingRating}
            interactive
            onChange={setParkingRating}
            label="Parking (53')"
          />
          <StarRating
            rating={safetyRating}
            interactive
            onChange={setSafetyRating}
            label="Safety"
          />
          <StarRating
            rating={bathroomRating}
            interactive
            onChange={setBathroomRating}
            label="Bathroom"
          />
          <StarRating
            rating={foodRating}
            interactive
            onChange={setFoodRating}
            label="Food"
          />
          <StarRating
            rating={priceRating}
            interactive
            onChange={setPriceRating}
            label="Price"
          />
        </div>

        {/* Quick Tags */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Quick Tags</label>
          <div className="flex flex-wrap gap-2">
            {STOP_TAGS.map(tag => (
              <Badge
                key={tag}
                variant={selectedTags.includes(tag) ? "default" : "outline"}
                className={cn(
                  "cursor-pointer transition-all",
                  selectedTags.includes(tag) && "bg-primary"
                )}
                onClick={() => toggleTag(tag)}
              >
                {TAG_LABELS[tag] || tag}
              </Badge>
            ))}
          </div>
        </div>

        {/* Comment */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Comment (optional)</label>
          <Textarea
            placeholder="Share your experience..."
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={3}
          />
        </div>

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={overallRating === 0 || isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Submitting...
            </>
          ) : (
            'Submit Rating'
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default StopRatingForm;
