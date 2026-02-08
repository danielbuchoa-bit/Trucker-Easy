import React from 'react';
import { Fuel, AlertTriangle } from 'lucide-react';
import type { FuelOptimizationResult } from '@/hooks/useFuelOptimization';

interface FuelAlertBadgeProps {
  result: FuelOptimizationResult | null;
  currentFuelPct: number; // 0-1
  onClick: () => void;
}

const FuelAlertBadge = ({ result, currentFuelPct, onClick }: FuelAlertBadgeProps) => {
  if (!result) return null;

  const nextStop = result.optimal_stops[0];
  const isLowFuel = currentFuelPct < 0.25;
  const hasCheapStop = nextStop && nextStop.diesel_price_cents < result.regional_avg_price_cents * 0.9;

  // Don't show badge if no actionable info
  if (!isLowFuel && !hasCheapStop && !nextStop) return null;

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-full shadow-lg backdrop-blur-sm border transition-colors ${
        isLowFuel
          ? 'bg-red-500/90 border-red-400 text-white'
          : hasCheapStop
          ? 'bg-emerald-500/90 border-emerald-400 text-white'
          : 'bg-card/90 border-border text-foreground'
      }`}
    >
      {isLowFuel ? (
        <AlertTriangle className="w-4 h-4" />
      ) : (
        <Fuel className="w-4 h-4" />
      )}
      <span className="text-xs font-bold">
        {isLowFuel
          ? 'Low Fuel!'
          : hasCheapStop
          ? `$${(nextStop!.diesel_price_cents / 100).toFixed(2)} ahead`
          : `${nextStop!.distance_miles.toFixed(0)} mi`}
      </span>
    </button>
  );
};

export default FuelAlertBadge;
