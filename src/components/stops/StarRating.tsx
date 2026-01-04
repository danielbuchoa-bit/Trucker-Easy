import React from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  rating: number;
  maxRating?: number;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  onChange?: (rating: number) => void;
  showValue?: boolean;
  label?: string;
}

const StarRating: React.FC<StarRatingProps> = ({
  rating,
  maxRating = 5,
  size = 'md',
  interactive = false,
  onChange,
  showValue = false,
  label,
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const handleClick = (value: number) => {
    if (interactive && onChange) {
      onChange(value);
    }
  };

  return (
    <div className="flex items-center gap-1">
      {label && (
        <span className="text-sm text-muted-foreground mr-2 min-w-[80px]">{label}</span>
      )}
      <div className="flex items-center gap-0.5">
        {Array.from({ length: maxRating }, (_, i) => {
          const value = i + 1;
          const filled = value <= rating;
          const halfFilled = value - 0.5 <= rating && rating < value;
          
          return (
            <button
              key={i}
              type="button"
              onClick={() => handleClick(value)}
              disabled={!interactive}
              className={cn(
                "transition-colors",
                interactive && "cursor-pointer hover:scale-110",
                !interactive && "cursor-default"
              )}
            >
              <Star
                className={cn(
                  sizeClasses[size],
                  filled && "fill-yellow-400 text-yellow-400",
                  halfFilled && "fill-yellow-400/50 text-yellow-400",
                  !filled && !halfFilled && "text-muted-foreground/30"
                )}
              />
            </button>
          );
        })}
      </div>
      {showValue && (
        <span className="text-sm font-medium ml-1">{rating.toFixed(1)}</span>
      )}
    </div>
  );
};

export default StarRating;
