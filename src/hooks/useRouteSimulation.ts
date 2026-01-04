import { useState, useRef, useCallback, useEffect } from 'react';
import type { LngLat } from '@/lib/hereFlexiblePolyline';

export interface SimulationState {
  isSimulating: boolean;
  currentIndex: number;
  speed: number; // points per second
  isPaused: boolean;
}

export function useRouteSimulation(
  routeCoords: LngLat[],
  onPositionUpdate: (position: { lat: number; lng: number }) => void
) {
  const [state, setState] = useState<SimulationState>({
    isSimulating: false,
    currentIndex: 0,
    speed: 2, // Default: 2 points per second (roughly 60mph on highways)
    isPaused: false,
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentIndexRef = useRef(0);

  const clearSimulation = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startSimulation = useCallback(() => {
    if (routeCoords.length === 0) return;

    clearSimulation();
    currentIndexRef.current = 0;

    setState(prev => ({
      ...prev,
      isSimulating: true,
      currentIndex: 0,
      isPaused: false,
    }));

    // Update position immediately
    const [lng, lat] = routeCoords[0];
    onPositionUpdate({ lat, lng });

    // Start interval
    intervalRef.current = setInterval(() => {
      currentIndexRef.current += 1;

      if (currentIndexRef.current >= routeCoords.length) {
        clearSimulation();
        setState(prev => ({ ...prev, isSimulating: false, isPaused: false }));
        return;
      }

      const [lng, lat] = routeCoords[currentIndexRef.current];
      onPositionUpdate({ lat, lng });
      setState(prev => ({ ...prev, currentIndex: currentIndexRef.current }));
    }, 1000 / state.speed);
  }, [routeCoords, onPositionUpdate, clearSimulation, state.speed]);

  const stopSimulation = useCallback(() => {
    clearSimulation();
    currentIndexRef.current = 0;
    setState({
      isSimulating: false,
      currentIndex: 0,
      speed: state.speed,
      isPaused: false,
    });
  }, [clearSimulation, state.speed]);

  const pauseSimulation = useCallback(() => {
    clearSimulation();
    setState(prev => ({ ...prev, isPaused: true }));
  }, [clearSimulation]);

  const resumeSimulation = useCallback(() => {
    if (!state.isSimulating || routeCoords.length === 0) return;

    setState(prev => ({ ...prev, isPaused: false }));

    intervalRef.current = setInterval(() => {
      currentIndexRef.current += 1;

      if (currentIndexRef.current >= routeCoords.length) {
        clearSimulation();
        setState(prev => ({ ...prev, isSimulating: false, isPaused: false }));
        return;
      }

      const [lng, lat] = routeCoords[currentIndexRef.current];
      onPositionUpdate({ lat, lng });
      setState(prev => ({ ...prev, currentIndex: currentIndexRef.current }));
    }, 1000 / state.speed);
  }, [state.isSimulating, state.speed, routeCoords, onPositionUpdate, clearSimulation]);

  const setSpeed = useCallback((speed: number) => {
    setState(prev => ({ ...prev, speed }));
    
    // If currently simulating and not paused, restart with new speed
    if (state.isSimulating && !state.isPaused) {
      clearSimulation();
      
      intervalRef.current = setInterval(() => {
        currentIndexRef.current += 1;

        if (currentIndexRef.current >= routeCoords.length) {
          clearSimulation();
          setState(prev => ({ ...prev, isSimulating: false, isPaused: false }));
          return;
        }

        const [lng, lat] = routeCoords[currentIndexRef.current];
        onPositionUpdate({ lat, lng });
        setState(prev => ({ ...prev, currentIndex: currentIndexRef.current }));
      }, 1000 / speed);
    }
  }, [state.isSimulating, state.isPaused, routeCoords, onPositionUpdate, clearSimulation]);

  // Skip to a specific point
  const skipTo = useCallback((index: number) => {
    if (index < 0 || index >= routeCoords.length) return;
    
    currentIndexRef.current = index;
    const [lng, lat] = routeCoords[index];
    onPositionUpdate({ lat, lng });
    setState(prev => ({ ...prev, currentIndex: index }));
  }, [routeCoords, onPositionUpdate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearSimulation();
    };
  }, [clearSimulation]);

  return {
    ...state,
    progress: routeCoords.length > 0 ? (state.currentIndex / routeCoords.length) * 100 : 0,
    startSimulation,
    stopSimulation,
    pauseSimulation,
    resumeSimulation,
    setSpeed,
    skipTo,
  };
}
