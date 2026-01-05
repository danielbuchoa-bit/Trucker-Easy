import React, { useMemo, useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { WeighStation } from '@/types/bypass';
import { HereService } from '@/services/HereService';
import { LngLat } from '@/lib/hereFlexiblePolyline';

interface WeighStationBadgesProps {
  userLat: number | null;
  userLng: number | null;
  stations: WeighStation[];
  routeCoords: LngLat[];
  maxVisible?: number;
}

// Calculate distance between two points in meters
function calculateDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Find minimum distance from a point to any segment of a polyline
function distanceToRoute(lat: number, lng: number, routeCoords: LngLat[]): { distance: number; closestIndex: number } {
  let minDistance = Infinity;
  let closestIndex = 0;

  for (let i = 0; i < routeCoords.length; i++) {
    const [routeLng, routeLat] = routeCoords[i];
    const dist = calculateDistanceMeters(lat, lng, routeLat, routeLng);
    if (dist < minDistance) {
      minDistance = dist;
      closestIndex = i;
    }
  }

  return { distance: minDistance, closestIndex };
}

// Find user's current position index on the route
function findUserPositionIndex(userLat: number, userLng: number, routeCoords: LngLat[]): number {
  let minDistance = Infinity;
  let closestIndex = 0;

  for (let i = 0; i < routeCoords.length; i++) {
    const [routeLng, routeLat] = routeCoords[i];
    const dist = calculateDistanceMeters(userLat, userLng, routeLat, routeLng);
    if (dist < minDistance) {
      minDistance = dist;
      closestIndex = i;
    }
  }

  return closestIndex;
}

// Maximum distance from route to consider a station "on route" (in meters)
const MAX_DISTANCE_FROM_ROUTE_M = 500; // 500 meters from the route line

const WeighStationBadges = ({
  userLat,
  userLng,
  stations,
  routeCoords,
  maxVisible = 2,
}: WeighStationBadgesProps) => {
  // Track stations that have been passed
  const [passedStationIds, setPassedStationIds] = useState<Set<string>>(new Set());

  // Find user's current position on route
  const userRouteIndex = useMemo(() => {
    if (userLat === null || userLng === null || routeCoords.length === 0) {
      return 0;
    }
    return findUserPositionIndex(userLat, userLng, routeCoords);
  }, [userLat, userLng, routeCoords]);

  // Filter stations that are on the route and ahead of the user
  const stationsOnRoute = useMemo(() => {
    if (userLat === null || userLng === null || routeCoords.length === 0 || stations.length === 0) {
      return [];
    }

    return stations
      .map(station => {
        const routeInfo = distanceToRoute(station.lat, station.lng, routeCoords);
        return {
          ...station,
          distanceFromRoute: routeInfo.distance,
          routeIndex: routeInfo.closestIndex,
          distanceFromUser: calculateDistanceMeters(userLat, userLng, station.lat, station.lng),
        };
      })
      // Only include stations that are close to the route (within 500m)
      .filter(s => s.distanceFromRoute <= MAX_DISTANCE_FROM_ROUTE_M)
      // Only include stations that are ahead of the user on the route
      .filter(s => s.routeIndex > userRouteIndex)
      // Exclude passed stations
      .filter(s => !passedStationIds.has(s.id))
      // Sort by position along the route (closest along route first)
      .sort((a, b) => a.routeIndex - b.routeIndex)
      .slice(0, maxVisible);
  }, [userLat, userLng, stations, routeCoords, userRouteIndex, passedStationIds, maxVisible]);

  // Detect when user passes a station
  useEffect(() => {
    if (userLat === null || userLng === null || routeCoords.length === 0) return;

    stations.forEach(station => {
      if (passedStationIds.has(station.id)) return;

      const routeInfo = distanceToRoute(station.lat, station.lng, routeCoords);
      
      // If station is on route and user has passed it
      if (routeInfo.distance <= MAX_DISTANCE_FROM_ROUTE_M && routeInfo.closestIndex <= userRouteIndex) {
        setPassedStationIds(prev => new Set([...prev, station.id]));
      }
    });
  }, [userLat, userLng, routeCoords, stations, userRouteIndex, passedStationIds]);

  // Reset passed stations when route changes
  useEffect(() => {
    setPassedStationIds(new Set());
  }, [routeCoords]);

  if (stationsOnRoute.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      {stationsOnRoute.map((station) => (
        <div
          key={station.id}
          className="flex items-center bg-teal-500/90 text-white rounded-lg shadow-lg overflow-hidden"
        >
          {/* W icon */}
          <div className="bg-white text-teal-600 font-bold text-lg px-2.5 py-2 flex items-center justify-center">
            W
          </div>
          
          {/* Status indicator - for now show X as closed by default */}
          <div className="bg-red-500 p-1">
            <X className="w-4 h-4 text-white" strokeWidth={3} />
          </div>
          
          {/* Distance from user */}
          <div className="px-2.5 py-1.5 font-bold text-sm">
            {HereService.formatDistance(station.distanceFromUser)}
          </div>
        </div>
      ))}
    </div>
  );
};

export default WeighStationBadges;
