import React, { useMemo } from 'react';
import { X, Check } from 'lucide-react';
import { WeighStation } from '@/types/bypass';
import { HereService } from '@/services/HereService';

interface WeighStationBadgesProps {
  userLat: number | null;
  userLng: number | null;
  stations: WeighStation[];
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

const WeighStationBadges = ({
  userLat,
  userLng,
  stations,
  maxVisible = 2,
}: WeighStationBadgesProps) => {
  // Calculate distances and sort by closest
  const stationsWithDistance = useMemo(() => {
    if (userLat === null || userLng === null || stations.length === 0) {
      return [];
    }

    return stations
      .map(station => ({
        ...station,
        distance: calculateDistanceMeters(userLat, userLng, station.lat, station.lng),
      }))
      .filter(s => s.distance > 0) // Exclude stations we've passed
      .sort((a, b) => a.distance - b.distance)
      .slice(0, maxVisible);
  }, [userLat, userLng, stations, maxVisible]);

  if (stationsWithDistance.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      {stationsWithDistance.map((station) => (
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
          
          {/* Distance */}
          <div className="px-2.5 py-1.5 font-bold text-sm">
            {HereService.formatDistance(station.distance)}
          </div>
        </div>
      ))}
    </div>
  );
};

export default WeighStationBadges;
