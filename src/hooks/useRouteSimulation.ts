import { useState, useRef, useCallback, useEffect } from 'react';
import type { LngLat } from '@/lib/hereFlexiblePolyline';
import type { UserPosition } from '@/contexts/ActiveNavigationContext';

export interface SimulationState {
  isSimulating: boolean;
  currentIndex: number;
  speed: number; // points per second
  isPaused: boolean;
}

// Calculate bearing between two points
function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  
  const dLng = toRad(lng2 - lng1);
  const lat1Rad = toRad(lat1);
  const lat2Rad = toRad(lat2);
  
  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
  
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// Estimate speed based on distance and time interval
function estimateSpeed(distanceMeters: number, intervalMs: number): number {
  return distanceMeters / (intervalMs / 1000); // m/s
}

// Haversine distance in meters
function haversineDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

export function useRouteSimulation(
  routeCoords: LngLat[],
  onPositionUpdate: (position: UserPosition) => void
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

  const getPositionWithHeading = useCallback((index: number): UserPosition => {
    const [lng, lat] = routeCoords[index];
    
    // Calculate heading to next point (or use current heading for last point)
    let heading = 0;
    let speed = 0;
    
    if (index < routeCoords.length - 1) {
      const [nextLng, nextLat] = routeCoords[index + 1];
      heading = calculateBearing(lat, lng, nextLat, nextLng);
      const distance = haversineDistanceMeters(lat, lng, nextLat, nextLng);
      speed = estimateSpeed(distance, 1000 / state.speed); // Based on simulation interval
    } else if (index > 0) {
      const [prevLng, prevLat] = routeCoords[index - 1];
      heading = calculateBearing(prevLat, prevLng, lat, lng);
    }
    
    return {
      lat,
      lng,
      heading,
      speed,
      accuracy: 5, // Simulated high accuracy
    };
  }, [routeCoords, state.speed]);

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
    onPositionUpdate(getPositionWithHeading(0));

    // Start interval
    intervalRef.current = setInterval(() => {
      currentIndexRef.current += 1;

      if (currentIndexRef.current >= routeCoords.length) {
        clearSimulation();
        setState(prev => ({ ...prev, isSimulating: false, isPaused: false }));
        return;
      }

      onPositionUpdate(getPositionWithHeading(currentIndexRef.current));
      setState(prev => ({ ...prev, currentIndex: currentIndexRef.current }));
    }, 1000 / state.speed);
  }, [routeCoords, onPositionUpdate, clearSimulation, state.speed, getPositionWithHeading]);

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

      onPositionUpdate(getPositionWithHeading(currentIndexRef.current));
      setState(prev => ({ ...prev, currentIndex: currentIndexRef.current }));
    }, 1000 / state.speed);
  }, [state.isSimulating, state.speed, routeCoords, onPositionUpdate, clearSimulation, getPositionWithHeading]);

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

        onPositionUpdate(getPositionWithHeading(currentIndexRef.current));
        setState(prev => ({ ...prev, currentIndex: currentIndexRef.current }));
      }, 1000 / speed);
    }
  }, [state.isSimulating, state.isPaused, routeCoords, onPositionUpdate, clearSimulation, getPositionWithHeading]);

  // Skip to a specific point
  const skipTo = useCallback((index: number) => {
    if (index < 0 || index >= routeCoords.length) return;
    
    currentIndexRef.current = index;
    onPositionUpdate(getPositionWithHeading(index));
    setState(prev => ({ ...prev, currentIndex: index }));
  }, [routeCoords, onPositionUpdate, getPositionWithHeading]);

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
