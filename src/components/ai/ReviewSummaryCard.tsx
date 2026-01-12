import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Sparkles, 
  ThumbsUp, 
  ThumbsDown, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Review {
  rating: number;
  comment?: string;
  created_at: string;
  tags?: string[];
}

interface ReviewSummaryProps {
  placeName: string;
  placeType: string;
  reviews: Review[];
  avgRating?: number;
}

interface SummaryData {
  summary: string;
  highlights: string[];
  concerns: string[];
  best_for: string | null;
  trucker_rating: string;
  recent_trend: 'melhorando' | 'estável' | 'piorando' | null;
}

export function ReviewSummaryCard({ placeName, placeType, reviews, avgRating }: ReviewSummaryProps) {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = async () => {
    if (reviews.length < 3) {
      setSummary({
        summary: 'Poucas avaliações para gerar um resumo completo.',
        highlights: [],
        concerns: [],
        best_for: null,
        trucker_rating: 'Não avaliado',
        recent_trend: null
      });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: funcError } = await supabase.functions.invoke('review_summary', {
        body: {
          place_name: placeName,
          place_type: placeType,
          reviews,
          avg_rating: avgRating
        }
      });

      if (funcError) throw funcError;
      setSummary(data);
    } catch (err) {
      console.error('Failed to fetch review summary:', err);
      setError('Erro ao gerar resumo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (reviews.length > 0) {
      fetchSummary();
    }
  }, [placeName, reviews.length]);

  if (reviews.length === 0) {
    return null;
  }

  const getTrendIcon = (trend: string | null) => {
    switch (trend) {
      case 'melhorando':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'piorando':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case 'Excelente':
        return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'Bom':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'Regular':
        return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'Ruim':
        return 'bg-red-500/10 text-red-600 border-red-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Resumo IA
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchSummary}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        ) : summary ? (
          <>
            <p className="text-sm text-muted-foreground">{summary.summary}</p>

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className={getRatingColor(summary.trucker_rating)}>
                {summary.trucker_rating}
              </Badge>
              {summary.recent_trend && (
                <Badge variant="outline" className="flex items-center gap-1">
                  {getTrendIcon(summary.recent_trend)}
                  {summary.recent_trend}
                </Badge>
              )}
              {summary.best_for && (
                <Badge variant="secondary">{summary.best_for}</Badge>
              )}
            </div>

            {summary.highlights.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                  <ThumbsUp className="h-3 w-3" /> Pontos positivos
                </p>
                <ul className="text-sm space-y-1">
                  {summary.highlights.slice(0, 3).map((h, i) => (
                    <li key={i} className="text-green-600 dark:text-green-400">• {h}</li>
                  ))}
                </ul>
              </div>
            )}

            {summary.concerns.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                  <ThumbsDown className="h-3 w-3" /> Atenção
                </p>
                <ul className="text-sm space-y-1">
                  {summary.concerns.slice(0, 3).map((c, i) => (
                    <li key={i} className="text-red-600 dark:text-red-400">• {c}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
