import { Scale } from 'lucide-react';
import { StationOnRoute, StationStatus } from '@/hooks/useWeighStationAlerts';

interface WeighStationOverlayProps {
  nextStation: StationOnRoute | null;
  onPress: () => void;
}

function getStatusColor(status: StationStatus): string {
  switch (status) {
    case 'OPEN':
      return 'bg-green-500';
    case 'CLOSED':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
}

function getStatusBorderColor(status: StationStatus): string {
  switch (status) {
    case 'OPEN':
      return 'ring-green-400';
    case 'CLOSED':
      return 'ring-red-400';
    default:
      return 'ring-gray-400';
  }
}

function formatDistance(meters: number): string {
  const miles = meters / 1609.34;
  if (miles >= 10) return `${Math.round(miles)} mi`;
  if (miles >= 1) return `${miles.toFixed(1)} mi`;
  const feet = meters * 3.28084;
  return `${Math.round(feet)} ft`;
}

const WeighStationOverlay = ({ nextStation, onPress }: WeighStationOverlayProps) => {
  if (!nextStation) return null;

  const statusColor = getStatusColor(nextStation.status);
  const borderColor = getStatusBorderColor(nextStation.status);

  return (
    <button
      onClick={onPress}
      className={`
        flex items-center gap-2 px-3 py-2 
        bg-card/95 backdrop-blur-sm rounded-xl 
        border border-border shadow-lg
        ring-2 ${borderColor}
        active:scale-95 transition-transform
      `}
    >
      {/* Icon with status badge */}
      <div className="relative">
        <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
          <Scale className="w-5 h-5 text-amber-500" />
        </div>
        {/* Status dot */}
        <div className={`absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full ${statusColor} ring-2 ring-card`} />
      </div>

      {/* Info */}
      <div className="text-left">
        <div className="text-xs font-semibold text-foreground leading-tight">
          WEIGH STATION
        </div>
        <div className="text-sm font-bold text-primary tabular-nums">
          {formatDistance(nextStation.distanceAlongRouteM)}
        </div>
      </div>
    </button>
  );
};

export default WeighStationOverlay;
