import { useEffect, useState } from 'react';
import { Scale, X, AlertTriangle } from 'lucide-react';
import { StationOnRoute, StationStatus } from '@/hooks/useWeighStationAlerts';

interface WeighStationAlertProps {
  station: StationOnRoute;
  onDismiss: () => void;
}

function getStatusText(status: StationStatus): string {
  switch (status) {
    case 'OPEN':
      return 'OPEN';
    case 'CLOSED':
      return 'CLOSED';
    default:
      return 'UNKNOWN STATUS';
  }
}

function getStatusColor(status: StationStatus): string {
  switch (status) {
    case 'OPEN':
      return 'text-green-500';
    case 'CLOSED':
      return 'text-red-500';
    default:
      return 'text-gray-400';
  }
}

function getStatusBgColor(status: StationStatus): string {
  switch (status) {
    case 'OPEN':
      return 'bg-green-500/10';
    case 'CLOSED':
      return 'bg-red-500/10';
    default:
      return 'bg-gray-500/10';
  }
}

function formatDistance(meters: number): string {
  const miles = meters / 1609.34;
  return `${Math.round(miles)} miles`;
}

const WeighStationAlert = ({ station, onDismiss }: WeighStationAlertProps) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Animate in
    requestAnimationFrame(() => setVisible(true));
    
    // Auto-dismiss after 10 seconds
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300);
    }, 10000);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(onDismiss, 300);
  };

  return (
    <div 
      className={`
        fixed inset-x-4 top-20 z-[60] 
        transition-all duration-300 ease-out
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}
      `}
    >
      <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-amber-500/20 px-4 py-3 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-amber-500/30 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-foreground">
              WEIGH STATION AHEAD
            </h2>
            <p className="text-sm text-muted-foreground">
              {formatDistance(station.distanceAlongRouteM)} ahead on your route
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Station name */}
          <div className="flex items-center gap-3">
            <Scale className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="font-semibold text-foreground">
                {station.station.name}
              </p>
              {station.station.state && (
                <p className="text-sm text-muted-foreground">{station.station.state}</p>
              )}
            </div>
          </div>

          {/* Status */}
          <div className={`rounded-xl p-3 ${getStatusBgColor(station.status)}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Current Status:</span>
              <span className={`text-lg font-bold ${getStatusColor(station.status)}`}>
                {getStatusText(station.status)}
              </span>
            </div>
            {station.lastUpdatedAt && (
              <p className="text-xs text-muted-foreground mt-1">
                Last update: {new Date(station.lastUpdatedAt).toLocaleTimeString()}
              </p>
            )}
          </div>

          {/* Dismiss button */}
          <button
            onClick={handleDismiss}
            className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold"
          >
            GOT IT
          </button>
        </div>
      </div>
    </div>
  );
};

export default WeighStationAlert;
