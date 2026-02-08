import React from 'react';
import { Fuel, TrendingDown, MapPin, DollarSign, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { FuelOptimizationResult, FuelStop } from '@/hooks/useFuelOptimization';

interface FuelOptimizationCardProps {
  result: FuelOptimizationResult;
  onViewStops: () => void;
  onNavigateToStop?: (stop: FuelStop) => void;
}

const FuelOptimizationCard = ({ result, onViewStops, onNavigateToStop }: FuelOptimizationCardProps) => {
  const nextStop = result.optimal_stops[0];
  const totalCostDollars = (result.total_fuel_cost_cents / 100).toFixed(2);
  const savingsDollars = (result.savings_vs_average_cents / 100).toFixed(2);

  return (
    <div className="bg-card/95 backdrop-blur-sm border border-border rounded-xl p-4 space-y-3 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <Fuel className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-semibold">Smart Fuel Plan</p>
            <p className="text-xs text-muted-foreground">
              {result.optimal_stops.length} stop{result.optimal_stops.length !== 1 ? 's' : ''} • {result.total_gallons_needed.toFixed(0)} gal needed
            </p>
          </div>
        </div>
        {result.savings_vs_average_cents > 0 && (
          <div className="flex items-center gap-1 bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full">
            <TrendingDown className="w-3 h-3" />
            <span className="text-xs font-bold">Save ${savingsDollars}</span>
          </div>
        )}
      </div>

      {/* Next fuel stop */}
      {nextStop && (
        <div 
          className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg cursor-pointer active:bg-muted"
          onClick={() => onNavigateToStop?.(nextStop)}
        >
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <MapPin className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{nextStop.name}</p>
            <p className="text-xs text-muted-foreground">
              {nextStop.distance_miles.toFixed(0)} mi • ${(nextStop.diesel_price_cents / 100).toFixed(2)}/gal
              {nextStop.price_source === 'estimate' && ' (est.)'}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-bold text-emerald-400">
              +{nextStop.recommended_gallons.toFixed(0)} gal
            </p>
            <p className="text-xs text-muted-foreground">
              ${(nextStop.estimated_cost_cents / 100).toFixed(2)}
            </p>
          </div>
        </div>
      )}

      {/* Summary row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <DollarSign className="w-3 h-3" />
          <span>Total est: <span className="font-semibold text-foreground">${totalCostDollars}</span></span>
        </div>
        <Button variant="ghost" size="sm" className="text-xs h-7" onClick={onViewStops}>
          All Stops
          <ChevronRight className="w-3 h-3 ml-1" />
        </Button>
      </div>
    </div>
  );
};

export default FuelOptimizationCard;
