import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Brain, 
  Fuel, 
  Coffee, 
  Utensils, 
  Scale,
  Clock,
  AlertTriangle,
  Lightbulb,
  RefreshCw,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface RouteAnalysisProps {
  origin: string;
  destination: string;
  distanceKm: number;
  estimatedHours: number;
  stopsHistory?: Array<{
    name: string;
    type: string;
    rating?: number;
  }>;
}

interface StopRecommendation {
  km: number;
  reason: string;
  type: 'fuel' | 'rest' | 'food' | 'weigh_station';
}

interface AnalysisData {
  recommended_stops: StopRecommendation[];
  best_departure_time: string;
  traffic_tips: string[];
  fuel_strategy: string;
  rest_schedule: string;
  warnings: string[];
}

export function RouteAnalysisCard({ 
  origin, 
  destination, 
  distanceKm, 
  estimatedHours,
  stopsHistory 
}: RouteAnalysisProps) {
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const fetchAnalysis = async () => {
    setLoading(true);
    setError(null);

    try {
      const now = new Date();
      const { data, error: funcError } = await supabase.functions.invoke('route_analysis', {
        body: {
          origin,
          destination,
          distance_km: distanceKm,
          estimated_hours: estimatedHours,
          time_of_day: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          day_of_week: now.toLocaleDateString('pt-BR', { weekday: 'long' }),
          stops_history: stopsHistory
        }
      });

      if (funcError) throw funcError;
      setAnalysis(data);
      setIsOpen(true);
    } catch (err) {
      console.error('Failed to fetch route analysis:', err);
      setError('Erro ao analisar rota');
    } finally {
      setLoading(false);
    }
  };

  const getStopIcon = (type: string) => {
    switch (type) {
      case 'fuel':
        return <Fuel className="h-4 w-4 text-orange-500" />;
      case 'rest':
        return <Coffee className="h-4 w-4 text-blue-500" />;
      case 'food':
        return <Utensils className="h-4 w-4 text-green-500" />;
      case 'weigh_station':
        return <Scale className="h-4 w-4 text-purple-500" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  if (!analysis && !loading) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-6">
          <div className="text-center">
            <Brain className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-3">
              Quer uma análise inteligente desta rota?
            </p>
            <Button onClick={fetchAnalysis} disabled={loading}>
              <Lightbulb className="h-4 w-4 mr-2" />
              Analisar Rota
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-primary/20">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" />
                Análise Inteligente
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    fetchAnalysis();
                  }}
                  disabled={loading}
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : error ? (
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">{error}</span>
              </div>
            ) : analysis ? (
              <>
                {/* Best Departure Time */}
                <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg">
                  <Clock className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Melhor horário para sair</p>
                    <p className="font-medium">{analysis.best_departure_time}</p>
                  </div>
                </div>

                {/* Recommended Stops */}
                {analysis.recommended_stops.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Paradas Recomendadas</p>
                    <ScrollArea className="h-32">
                      <div className="space-y-2">
                        {analysis.recommended_stops.map((stop, i) => (
                          <div key={i} className="flex items-start gap-2 p-2 bg-muted rounded">
                            {getStopIcon(stop.type)}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">Km {stop.km}</p>
                              <p className="text-xs text-muted-foreground truncate">{stop.reason}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {/* Fuel Strategy */}
                <div>
                  <p className="text-sm font-medium mb-1 flex items-center gap-1">
                    <Fuel className="h-4 w-4" /> Estratégia de Combustível
                  </p>
                  <p className="text-sm text-muted-foreground">{analysis.fuel_strategy}</p>
                </div>

                {/* Rest Schedule */}
                <div>
                  <p className="text-sm font-medium mb-1 flex items-center gap-1">
                    <Coffee className="h-4 w-4" /> Descanso
                  </p>
                  <p className="text-sm text-muted-foreground">{analysis.rest_schedule}</p>
                </div>

                {/* Traffic Tips */}
                {analysis.traffic_tips.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-1">Dicas de Trânsito</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {analysis.traffic_tips.map((tip, i) => (
                        <li key={i}>• {tip}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Warnings */}
                {analysis.warnings.length > 0 && (
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400 mb-1 flex items-center gap-1">
                      <AlertTriangle className="h-4 w-4" /> Avisos
                    </p>
                    <ul className="text-sm text-yellow-600 dark:text-yellow-400 space-y-1">
                      {analysis.warnings.map((w, i) => (
                        <li key={i}>• {w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : null}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
