import React from 'react';
import { Fuel, MapPin, Navigation, Clock, TrendingDown, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { FuelOptimizationResult, FuelStop } from '@/hooks/useFuelOptimization';

interface FuelStopsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: FuelOptimizationResult;
  onNavigateToStop?: (stop: FuelStop) => void;
}

const FuelStopsSheet = ({ open, onOpenChange, result, onNavigateToStop }: FuelStopsSheetProps) => {
  const totalCostDollars = (result.total_fuel_cost_cents / 100).toFixed(2);
  const savingsDollars = (result.savings_vs_average_cents / 100).toFixed(2);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Fuel className="w-5 h-5 text-emerald-400" />
            Fuel Plan
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4 overflow-y-auto pb-8" style={{ maxHeight: 'calc(80vh - 100px)' }}>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Distance</p>
              <p className="text-sm font-bold">{result.total_distance_miles.toFixed(0)} mi</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Total Cost</p>
              <p className="text-sm font-bold text-primary">${totalCostDollars}</p>
            </div>
            <div className="bg-emerald-500/10 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Savings</p>
              <p className="text-sm font-bold text-emerald-400">${savingsDollars}</p>
            </div>
          </div>

          {/* Current fuel */}
          <div className="flex items-center gap-2 px-2">
            <Fuel className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Current: {result.current_fuel_gallons.toFixed(0)} gal • Need: {result.total_gallons_needed.toFixed(0)} gal
            </span>
          </div>

          {/* Stops list */}
          <div className="space-y-3">
            {result.optimal_stops.map((stop, idx) => (
              <div
                key={stop.place_id}
                className="bg-card border border-border rounded-xl p-4 space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-primary">{idx + 1}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{stop.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Mile {stop.distance_miles.toFixed(0)} •{' '}
                        <span className={stop.price_source === 'estimate' ? 'text-amber-400' : 'text-emerald-400'}>
                          ${(stop.diesel_price_cents / 100).toFixed(2)}/gal
                          {stop.price_source === 'estimate' ? ' (est.)' : ''}
                        </span>
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 h-8"
                    onClick={() => onNavigateToStop?.(stop)}
                  >
                    <Navigation className="w-3 h-3 mr-1" />
                    Go
                  </Button>
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground pl-11">
                  <span className="flex items-center gap-1">
                    <Fuel className="w-3 h-3" />
                    Fill {stop.recommended_gallons.toFixed(0)} gal
                  </span>
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    ${(stop.estimated_cost_cents / 100).toFixed(2)}
                  </span>
                  <span className="flex items-center gap-1">
                    ⛽ Arrive: {stop.arrival_fuel_gallons.toFixed(0)} gal
                  </span>
                </div>
              </div>
            ))}
          </div>

          {result.optimal_stops.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Fuel className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">You have enough fuel for this trip!</p>
              <p className="text-xs mt-1">No stops needed with current fuel level.</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default FuelStopsSheet;
