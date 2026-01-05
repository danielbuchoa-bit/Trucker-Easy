import { useMemo, useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { WeighStation } from '@/types/bypass';
import { LngLat } from '@/lib/hereFlexiblePolyline';
import { haversineDistance, matchPositionToRoute } from '@/lib/navigationUtils';

interface WeighStationBadgesProps {
  userLat: number | null;
  userLng: number | null;
  stations: WeighStation[];
  routeCoords: LngLat[];
  maxVisible?: number;
}

function formatDistanceBadge(meters: number): string {
  const miles = meters * 0.000621371;
  if (miles >= 1) return `${Math.round(miles)} mi`;
  if (miles >= 0.1) return `${miles.toFixed(1)} mi`;
  const feet = meters * 3.28084;
  return `${Math.round(feet)} ft`;
}

function routeDistanceMeters(routeCoords: LngLat[], fromSegIndex: number, toSegIndex: number): number {
  if (routeCoords.length < 2) return 0;
  if (toSegIndex <= fromSegIndex) return 0;

  const from = Math.max(0, Math.min(fromSegIndex, routeCoords.length - 2));
  const to = Math.max(0, Math.min(toSegIndex, routeCoords.length - 2));

  let dist = 0;
  for (let i = from; i <= to; i++) {
    const a = routeCoords[i];
    const b = routeCoords[i + 1];
    if (!a || !b) break;
    dist += haversineDistance(a[1], a[0], b[1], b[0]);
  }
  return dist;
}

function distanceToRoute(
  lat: number,
  lng: number,
  routeCoords: LngLat[]
): { distance: number; closestIndex: number } {
  if (routeCoords.length < 2) return { distance: Infinity, closestIndex: 0 };
  const match = matchPositionToRoute(lng, lat, routeCoords);
  return { distance: match.distanceToRouteM, closestIndex: match.closestSegmentIndex };
}

function findUserPositionIndex(userLat: number, userLng: number, routeCoords: LngLat[]): number {
  if (routeCoords.length < 2) return 0;
  return matchPositionToRoute(userLng, userLat, routeCoords).closestSegmentIndex;
}

// More tolerant: some stations are slightly off the centerline.
const MAX_DISTANCE_FROM_ROUTE_M = 5000; // ~3.1 miles

// Mark as "passed" once the driver is clearly beyond it on the route.
const PASSED_BEHIND_DISTANCE_M = 1600; // ~1 mile

type StationMeta = WeighStation & {
  distanceFromRoute: number;
  routeIndex: number;
  distanceAheadM: number;
};

const WeighStationBadges = ({
  userLat,
  userLng,
  stations,
  routeCoords,
  maxVisible = 2,
}: WeighStationBadgesProps) => {
  const [passedStationIds, setPassedStationIds] = useState<Set<string>>(new Set());

  const userRouteIndex = useMemo(() => {
    if (userLat === null || userLng === null || routeCoords.length === 0) return 0;
    return findUserPositionIndex(userLat, userLng, routeCoords);
  }, [userLat, userLng, routeCoords]);

  const stationsOnRoute = useMemo<StationMeta[]>(() => {
    if (userLat === null || userLng === null || routeCoords.length === 0 || stations.length === 0) return [];

    return stations
      .map((station) => {
        const routeInfo = distanceToRoute(station.lat, station.lng, routeCoords);
        const distanceAheadM =
          routeInfo.closestIndex > userRouteIndex
            ? routeDistanceMeters(routeCoords, userRouteIndex, routeInfo.closestIndex)
            : 0;

        return {
          ...station,
          distanceFromRoute: routeInfo.distance,
          routeIndex: routeInfo.closestIndex,
          distanceAheadM,
        };
      })
      .filter((s) => s.distanceFromRoute <= MAX_DISTANCE_FROM_ROUTE_M)
      .filter((s) => s.routeIndex > userRouteIndex)
      .filter((s) => !passedStationIds.has(s.id))
      .sort((a, b) => a.distanceAheadM - b.distanceAheadM)
      .slice(0, maxVisible);
  }, [userLat, userLng, stations, routeCoords, userRouteIndex, passedStationIds, maxVisible]);

  useEffect(() => {
    if (userLat === null || userLng === null || routeCoords.length === 0) return;

    stations.forEach((station) => {
      if (passedStationIds.has(station.id)) return;

      const routeInfo = distanceToRoute(station.lat, station.lng, routeCoords);
      if (routeInfo.distance > MAX_DISTANCE_FROM_ROUTE_M) return;
      if (routeInfo.closestIndex > userRouteIndex) return;

      const behindDistanceM = routeDistanceMeters(routeCoords, routeInfo.closestIndex, userRouteIndex);
      if (behindDistanceM >= PASSED_BEHIND_DISTANCE_M) {
        setPassedStationIds((prev) => new Set([...prev, station.id]));
      }
    });
  }, [userLat, userLng, routeCoords, stations, userRouteIndex, passedStationIds]);

  useEffect(() => {
    setPassedStationIds(new Set());
  }, [routeCoords]);

  if (stationsOnRoute.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {stationsOnRoute.map((station) => (
        <div
          key={station.id}
          className="w-[78px] rounded-2xl bg-card/90 backdrop-blur border border-border shadow-lg px-2 py-2 flex flex-col items-center"
        >
          <div className="relative">
            <div className="h-10 w-10 rounded-full bg-success text-success-foreground font-black text-base flex items-center justify-center">
              W
            </div>
            <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center ring-2 ring-card">
              <X className="h-3.5 w-3.5" strokeWidth={3} />
            </div>
          </div>

          <div className="mt-1 text-base font-extrabold tabular-nums text-info leading-none">
            {formatDistanceBadge(station.distanceAheadM)}
          </div>
        </div>
      ))}
    </div>
  );
};

export default WeighStationBadges;
