import React from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PoiRatingBadgeProps {
  rating: number;
  reviewCount: number;
  size?: 'sm' | 'md';
  className?: string;
}

const PoiRatingBadge: React.FC<PoiRatingBadgeProps> = ({
  rating,
  reviewCount,
  size = 'sm',
  className,
}) => {
  const getColorClass = (rating: number) => {
    if (rating >= 4) return 'bg-success text-success-foreground';
    if (rating >= 3) return 'bg-warning text-warning-foreground';
    return 'bg-destructive text-destructive-foreground';
  };

  const sizeClasses = {
    sm: 'text-[10px] px-1 py-0.5',
    md: 'text-xs px-1.5 py-0.5',
  };

  const starSizes = {
    sm: 'w-2.5 h-2.5',
    md: 'w-3 h-3',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-0.5 rounded font-semibold',
        getColorClass(rating),
        sizeClasses[size],
        className
      )}
    >
      <Star className={cn(starSizes[size], 'fill-current')} />
      <span>{rating.toFixed(1)}</span>
      <span className="opacity-75">({reviewCount})</span>
    </div>
  );
};

export default PoiRatingBadge;
