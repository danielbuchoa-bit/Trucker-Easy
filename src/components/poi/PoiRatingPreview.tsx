import React, { useEffect, useState } from 'react';
import { Star, ThumbsUp, Users, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface PoiRatingPreviewProps {
  poiId: string;
  poiName?: string;
  className?: string;
  compact?: boolean;
}

interface RatingData {
  review_count: number;
  avg_overall: number;
  avg_friendliness: number;
  avg_cleanliness: number;
  would_return_pct: number;
}

const PoiRatingPreview: React.FC<PoiRatingPreviewProps> = ({
  poiId,
  poiName,
  className,
  compact = false,
}) => {
  const [rating, setRating] = useState<RatingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRating = async () => {
      if (!poiId) {
        setLoading(false);
        return;
      }

      try {
        // First try the view
        const { data: viewData, error: viewError } = await supabase
          .from('poi_ratings_aggregate')
          .select('*')
          .eq('poi_id', poiId)
          .maybeSingle();

        if (!viewError && viewData) {
          setRating({
            review_count: viewData.review_count || 0,
            avg_overall: viewData.avg_overall || 0,
            avg_friendliness: viewData.avg_friendliness || 0,
            avg_cleanliness: viewData.avg_cleanliness || 0,
            would_return_pct: viewData.would_return_pct || 0,
          });
          setLoading(false);
          return;
        }

        // Fallback to manual calculation
        const { data, error } = await supabase
          .from('poi_feedback')
          .select('friendliness_rating, cleanliness_rating, recommendation_rating, structure_rating, would_return')
          .eq('poi_id', poiId);

        if (error || !data || data.length === 0) {
          setRating(null);
          setLoading(false);
          return;
        }

        const count = data.length;
        const avgFriendliness = data.reduce((sum, r) => sum + r.friendliness_rating, 0) / count;
        const avgCleanliness = data.reduce((sum, r) => sum + r.cleanliness_rating, 0) / count;
        const avgRecommendation = data.reduce((sum, r) => sum + r.recommendation_rating, 0) / count;
        const avgStructure = data.reduce((sum, r) => sum + (r.structure_rating || 0), 0) / count;
        const avgOverall = (avgFriendliness + avgCleanliness + avgRecommendation + avgStructure) / 4;
        const wouldReturnCount = data.filter((r) => r.would_return).length;
        const wouldReturnPct = (wouldReturnCount / count) * 100;

        setRating({
          review_count: count,
          avg_overall: Math.round(avgOverall * 10) / 10,
          avg_friendliness: Math.round(avgFriendliness * 10) / 10,
          avg_cleanliness: Math.round(avgCleanliness * 10) / 10,
          would_return_pct: Math.round(wouldReturnPct),
        });
      } catch (err) {
        console.error('[PoiRatingPreview] Error:', err);
        setRating(null);
      } finally {
        setLoading(false);
      }
    };

    fetchRating();
  }, [poiId]);

  if (loading) {
    return (
      <div className={cn("flex items-center gap-1 text-muted-foreground", className)}>
        <Loader2 className="w-3 h-3 animate-spin" />
      </div>
    );
  }

  if (!rating || rating.review_count === 0) {
    return compact ? null : (
      <div className={cn("text-xs text-muted-foreground italic", className)}>
        Sem avaliações
      </div>
    );
  }

  // Compact version - just star and number
  if (compact) {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        <Star className="w-3.5 h-3.5 fill-yellow-500 text-yellow-500" />
        <span className="text-sm font-medium">{rating.avg_overall.toFixed(1)}</span>
        <span className="text-xs text-muted-foreground">({rating.review_count})</span>
      </div>
    );
  }

  // Full version
  return (
    <div className={cn("bg-card/80 backdrop-blur rounded-lg p-2 space-y-1.5", className)}>
      {/* Overall rating */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
          <span className="text-lg font-bold">{rating.avg_overall.toFixed(1)}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="w-3 h-3" />
          <span>{rating.review_count} avaliações</span>
        </div>
      </div>

      {/* Quick stats */}
      <div className="flex items-center gap-3 text-xs">
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">Atendimento:</span>
          <span className="font-medium">{rating.avg_friendliness.toFixed(1)}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">Limpeza:</span>
          <span className="font-medium">{rating.avg_cleanliness.toFixed(1)}</span>
        </div>
      </div>

      {/* Would return */}
      {rating.would_return_pct > 0 && (
        <div className="flex items-center gap-1.5 text-xs">
          <ThumbsUp className="w-3 h-3 text-green-500" />
          <span className="text-green-600 font-medium">
            {rating.would_return_pct}% voltariam
          </span>
        </div>
      )}
    </div>
  );
};

export default PoiRatingPreview;
