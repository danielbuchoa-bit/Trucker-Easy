import { useState } from 'react';
import { X, Scale, Clock, RefreshCw, FileText } from 'lucide-react';
import { StationOnRoute, StationStatus } from '@/hooks/useWeighStationAlerts';
import { formatDistanceToNow } from 'date-fns';

interface WeighStationDetailCardProps {
  station: StationOnRoute;
  onClose: () => void;
  onOpenReports: () => void;
  onRefresh: () => void;
}

function getStatusLabel(status: StationStatus): string {
  switch (status) {
    case 'OPEN': return 'OPEN';
    case 'CLOSED': return 'CLOSED';
    default: return 'UNKNOWN';
  }
}

function getStatusBg(status: StationStatus): string {
  switch (status) {
    case 'OPEN': return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'CLOSED': return 'bg-red-500/20 text-red-400 border-red-500/30';
    default: return 'bg-muted text-muted-foreground border-border';
  }
}

function formatDistance(meters: number): string {
  const miles = meters / 1609.34;
  if (miles >= 10) return `${Math.round(miles)} mi`;
  if (miles >= 1) return `${miles.toFixed(1)} mi`;
  const feet = meters * 3.28084;
  return `${Math.round(feet)} ft`;
}

function formatTimeAgo(dateStr: string): string {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return 'unknown';
  }
}

const WeighStationDetailCard = ({ station, onClose, onOpenReports, onRefresh }: WeighStationDetailCardProps) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const lastReport = station.recentReports[0] || null;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setIsRefreshing(false);
  };

  return (
    <div className="fixed inset-x-4 bottom-28 z-[60] animate-in slide-in-from-bottom-4 duration-200">
      <div className="bg-card/95 backdrop-blur-lg rounded-2xl border border-border shadow-2xl overflow-hidden max-w-sm mx-auto">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Scale className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground leading-tight">
                {station.station.name}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm font-semibold text-primary">
                  {formatDistance(station.distanceAlongRouteM)}
                </span>
                {station.station.state && (
                  <span className="text-xs text-muted-foreground">
                    • {station.station.state}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status from last report */}
        <div className="px-4 pb-3">
          <div className={`rounded-xl border px-4 py-3 ${getStatusBg(station.status)}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium opacity-70 uppercase">Last Report Status</p>
                <p className="text-xl font-black mt-0.5">
                  {lastReport ? lastReport.status_reported : 'No Reports'}
                </p>
              </div>
              {lastReport && (
                <div className="text-right">
                  <div className="flex items-center gap-1 text-xs opacity-70">
                    <Clock className="w-3 h-3" />
                    {formatTimeAgo(lastReport.created_at)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-4 pb-4 flex items-center gap-2">
          <button
            onClick={onOpenReports}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm active:scale-95 transition-transform"
          >
            <FileText className="w-4 h-4" />
            REPORTS
          </button>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center active:scale-95 transition-transform"
          >
            <RefreshCw className={`w-4 h-4 text-muted-foreground ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default WeighStationDetailCard;
