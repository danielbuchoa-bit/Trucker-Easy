import React from 'react';
import { Star, ThumbsUp, Users, Sparkles, Home, Heart } from 'lucide-react';
import { PoiRating } from '@/hooks/usePoiRatings';
import { Progress } from '@/components/ui/progress';

interface PoiRatingDetailsProps {
  rating: PoiRating;
}

interface RatingRowProps {
  label: string;
  value: number;
  icon: React.ReactNode;
}

const RatingRow: React.FC<RatingRowProps> = ({ label, value, icon }) => {
  const percentage = (value / 5) * 100;
  
  return (
    <div className="flex items-center gap-2">
      <div className="w-5 h-5 flex items-center justify-center text-muted-foreground">
        {icon}
      </div>
      <span className="text-xs text-muted-foreground w-24">{label}</span>
      <Progress value={percentage} className="flex-1 h-2" />
      <span className="text-xs font-medium w-8 text-right">{value.toFixed(1)}</span>
    </div>
  );
};

const PoiRatingDetails: React.FC<PoiRatingDetailsProps> = ({ rating }) => {
  return (
    <div className="space-y-4">
      {/* Overall Score */}
      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-1">
          <Star className="w-6 h-6 fill-yellow-400 text-yellow-400" />
          <span className="text-2xl font-bold">{rating.avg_overall.toFixed(1)}</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Users className="w-4 h-4" />
            <span>{rating.review_count} review{rating.review_count !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-1 text-sm">
            <ThumbsUp className="w-4 h-4 text-success" />
            <span className="text-success">{rating.would_return_pct}% would return</span>
          </div>
        </div>
      </div>

      {/* Detailed Ratings */}
      <div className="space-y-2">
        <RatingRow
          label="Service"
          value={rating.avg_friendliness}
          icon={<Heart className="w-4 h-4" />}
        />
        <RatingRow
          label="Cleanliness"
          value={rating.avg_cleanliness}
          icon={<Sparkles className="w-4 h-4" />}
        />
        <RatingRow
          label="Facilities"
          value={rating.avg_structure}
          icon={<Home className="w-4 h-4" />}
        />
        <RatingRow
          label="Overall"
          value={rating.avg_recommendation}
          icon={<Star className="w-4 h-4" />}
        />
      </div>
    </div>
  );
};

export default PoiRatingDetails;
