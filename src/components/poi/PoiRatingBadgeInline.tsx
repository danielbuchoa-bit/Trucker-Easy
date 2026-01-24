import { Star, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PoiRatingSummary } from '@/hooks/useBatchPoiRatings';

interface PoiRatingBadgeInlineProps {
  rating: PoiRatingSummary | null;
  onClick?: () => void;
  className?: string;
  compact?: boolean;
}

const PoiRatingBadgeInline = ({ rating, onClick, className, compact = false }: PoiRatingBadgeInlineProps) => {
  if (!rating) {
    return null; // Don't show anything if no rating
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/10 hover:bg-amber-500/20 transition-colors',
        className
      )}
    >
      {/* Stars display */}
      <div className="flex items-center gap-0.5">
        {compact ? (
          <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
        ) : (
          [1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={cn(
                'w-3 h-3',
                star <= Math.round(rating.avgRating)
                  ? 'fill-amber-500 text-amber-500'
                  : 'text-muted-foreground/30'
              )}
            />
          ))
        )}
      </div>

      {/* Rating number */}
      <span className="text-xs font-semibold text-foreground">
        {rating.avgRating.toFixed(1)}
      </span>

      {/* Review count */}
      <span className="text-xs text-muted-foreground flex items-center gap-0.5">
        <MessageSquare className="w-3 h-3" />
        {rating.totalReviews}
      </span>
    </button>
  );
};

export default PoiRatingBadgeInline;
