import { useMemo, useState, useEffect, useCallback } from 'react';
import { X, Circle } from 'lucide-react';
import { StationOnRoute, StationStatus } from '@/hooks/useWeighStationAlerts';
import WeighStationDetailCard from '@/components/weighstation/WeighStationDetailCard';

interface WeighStationBadgesProps {
  stationsOnRoute: StationOnRoute[];
  maxVisible?: number;
  onOpenReports: (station: StationOnRoute) => void;
  onRefresh: (stationId: string) => void;
}

function formatDistanceBadge(meters: number): string {
  const miles = meters / 1609.34;
  if (miles >= 10) return `${Math.round(miles)} mi`;
  if (miles >= 1) return `${miles.toFixed(1)} mi`;
  const feet = meters * 3.28084;
  return `${Math.round(feet)} ft`;
}

const WeighStationBadges = ({
  stationsOnRoute,
  maxVisible = 3,
  onOpenReports,
  onRefresh,
}: WeighStationBadgesProps) => {
  const [selectedStation, setSelectedStation] = useState<StationOnRoute | null>(null);

  const visibleStations = useMemo(() => {
    return stationsOnRoute.slice(0, maxVisible);
  }, [stationsOnRoute, maxVisible]);

  const handleBadgeClick = useCallback((station: StationOnRoute) => {
    setSelectedStation(prev => prev?.station.id === station.station.id ? null : station);
  }, []);

  if (visibleStations.length === 0) return null;

  return (
    <>
      <div className="flex flex-col gap-2">
        {visibleStations.map((station) => (
          <button
            key={station.station.id}
            onClick={() => handleBadgeClick(station)}
            className={`
              w-[78px] rounded-2xl bg-card/90 backdrop-blur border shadow-lg px-2 py-2 
              flex flex-col items-center active:scale-95 transition-transform
              ${selectedStation?.station.id === station.station.id ? 'border-primary ring-1 ring-primary' : 'border-border'}
            `}
          >
            <div className="relative">
              <div className="h-10 w-10 rounded-full bg-amber-500/20 text-amber-500 font-black text-base flex items-center justify-center">
                W
              </div>
              {/* Status indicator */}
              {station.status === 'CLOSED' ? (
                <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center ring-2 ring-card">
                  <X className="h-3.5 w-3.5" strokeWidth={3} />
                </div>
              ) : station.status === 'OPEN' ? (
                <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-green-500 text-white flex items-center justify-center ring-2 ring-card">
                  <Circle className="h-3 w-3" fill="white" strokeWidth={0} />
                </div>
              ) : (
                <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-muted text-muted-foreground flex items-center justify-center ring-2 ring-card">
                  <span className="text-[9px] font-bold">?</span>
                </div>
              )}
            </div>

            <div className="mt-1 text-xs font-extrabold tabular-nums text-primary leading-none">
              {formatDistanceBadge(station.distanceAlongRouteM)}
            </div>
          </button>
        ))}
      </div>

      {/* Detail card overlay */}
      {selectedStation && (
        <WeighStationDetailCard
          station={selectedStation}
          onClose={() => setSelectedStation(null)}
          onOpenReports={() => {
            onOpenReports(selectedStation);
            setSelectedStation(null);
          }}
          onRefresh={() => onRefresh(selectedStation.station.id)}
        />
      )}
    </>
  );
};

export default WeighStationBadges;
