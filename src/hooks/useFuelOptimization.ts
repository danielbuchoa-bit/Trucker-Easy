import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { LngLat } from '@/lib/hereFlexiblePolyline';

export interface FuelStop {
  place_id: string;
  name: string;
  lat: number;
  lng: number;
  distance_miles: number;
  diesel_price_cents: number;
  price_source: string;
  recommended_gallons: number;
  estimated_cost_cents: number;
  arrival_fuel_gallons: number;
}

export interface FuelOptimizationResult {
  optimal_stops: FuelStop[];
  total_fuel_cost_cents: number;
  total_distance_miles: number;
  total_gallons_needed: number;
  savings_vs_average_cents: number;
  current_fuel_gallons: number;
  regional_avg_price_cents: number;
}

interface UseFuelOptimizationOptions {
  truckMpg?: number;
  currentFuelGallons?: number;
  tankCapacityGallons?: number;
  preference?: 'cheapest' | 'fastest' | 'balanced';
}

export function useFuelOptimization(options: UseFuelOptimizationOptions = {}) {
  const {
    truckMpg = 6.5,
    currentFuelGallons = 75,
    tankCapacityGallons = 150,
    preference = 'cheapest',
  } = options;

  const [result, setResult] = useState<FuelOptimizationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const optimize = useCallback(async (routeCoords: LngLat[]) => {
    if (routeCoords.length < 2) return;

    setLoading(true);
    setError(null);

    try {
      // Sample route coords to reduce payload
      const maxPoints = 100;
      const step = Math.max(1, Math.floor(routeCoords.length / maxPoints));
      const sampled = routeCoords.filter((_, i) => i % step === 0 || i === routeCoords.length - 1);

      const routePoints = sampled.map(([lng, lat]) => ({ lat, lng }));

      const { data, error: fnError } = await supabase.functions.invoke('fuel_optimize', {
        body: {
          route_points: routePoints,
          truck_mpg: truckMpg,
          current_fuel_gallons: currentFuelGallons,
          tank_capacity_gallons: tankCapacityGallons,
          preference,
        },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);

      setResult(data as FuelOptimizationResult);
    } catch (err: any) {
      console.error('[FUEL] Optimization error:', err);
      setError(err.message || 'Failed to optimize fuel');
    } finally {
      setLoading(false);
    }
  }, [truckMpg, currentFuelGallons, tankCapacityGallons, preference]);

  const clear = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { result, loading, error, optimize, clear };
}
