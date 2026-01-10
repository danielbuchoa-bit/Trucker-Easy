import { useEffect, useState } from 'react';
import { Scale, X, Clock, ChevronDown, RefreshCw } from 'lucide-react';
import { StationOnRoute, StationStatus, WeighStationReport, ReportOutcome } from '@/hooks/useWeighStationAlerts';
import { formatDistanceToNow } from 'date-fns';

interface WeighStationBottomSheetProps {
  station: StationOnRoute;
  onClose: () => void;
  onRefresh: () => void;
}

function getStatusText(status: StationStatus): string {
  switch (status) {
    case 'OPEN':
      return 'OPEN';
    case 'CLOSED':
      return 'CLOSED';
    default:
      return 'UNKNOWN';
  }
}

function getStatusColor(status: StationStatus): string {
  switch (status) {
    case 'OPEN':
      return 'bg-green-500 text-white';
    case 'CLOSED':
      return 'bg-red-500 text-white';
    default:
      return 'bg-gray-500 text-white';
  }
}

function getOutcomeText(outcome: ReportOutcome): string {
  switch (outcome) {
    case 'BYPASS':
      return 'BYPASS';
    case 'WEIGHED':
      return 'WEIGHED';
    case 'INSPECTED':
      return 'INSPECTED';
    default:
      return 'N/A';
  }
}

function getOutcomeColor(outcome: ReportOutcome): string {
  switch (outcome) {
    case 'BYPASS':
      return 'text-green-500';
    case 'WEIGHED':
      return 'text-amber-500';
    case 'INSPECTED':
      return 'text-red-500';
    default:
      return 'text-gray-400';
  }
}

function formatDistance(meters: number): string {
  const miles = meters / 1609.34;
  if (miles >= 10) return `${Math.round(miles)} miles`;
  if (miles >= 1) return `${miles.toFixed(1)} miles`;
  const feet = meters * 3.28084;
  return `${Math.round(feet)} ft`;
}

function formatTimeAgo(dateStr: string): string {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: false });
  } catch {
    return 'unknown';
  }
}

const ReportRow = ({ report }: { report: WeighStationReport }) => (
  <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
    <div className="flex items-center gap-2">
      <Clock className="w-4 h-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">
        {formatTimeAgo(report.created_at)} ago
      </span>
    </div>
    <div className="flex items-center gap-3">
      <span className={`text-sm font-medium ${
        report.status_reported === 'OPEN' ? 'text-green-500' :
        report.status_reported === 'CLOSED' ? 'text-red-500' : 'text-gray-400'
      }`}>
        {report.status_reported}
      </span>
      <span className="text-muted-foreground">→</span>
      <span className={`text-sm font-bold ${getOutcomeColor(report.outcome)}`}>
        {getOutcomeText(report.outcome)}
      </span>
    </div>
  </div>
);

const WeighStationBottomSheet = ({ station, onClose, onRefresh }: WeighStationBottomSheetProps) => {
  const [visible, setVisible] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setIsRefreshing(false);
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`
          fixed inset-0 bg-black/50 z-[70]
          transition-opacity duration-300
          ${visible ? 'opacity-100' : 'opacity-0'}
        `}
        onClick={handleClose}
      />

      {/* Sheet */}
      <div 
        className={`
          fixed inset-x-0 bottom-0 z-[71]
          bg-card rounded-t-3xl shadow-2xl
          max-h-[80vh] overflow-hidden
          transition-transform duration-300 ease-out
          ${visible ? 'translate-y-0' : 'translate-y-full'}
        `}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1.5 rounded-full bg-muted" />
        </div>

        {/* Header */}
        <div className="px-4 pb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 flex items-center justify-center">
              <Scale className="w-7 h-7 text-amber-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">
                NEXT WEIGH STATION
              </h2>
              <p className="text-sm text-muted-foreground">on your route</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 pb-8 overflow-y-auto max-h-[60vh]">
          {/* Station info */}
          <div className="bg-muted/50 rounded-2xl p-4 mb-4">
            <h3 className="text-lg font-bold text-foreground">
              {station.station.name}
            </h3>
            {station.station.state && (
              <p className="text-sm text-muted-foreground">{station.station.state}</p>
            )}
            <div className="mt-3 flex items-center gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Distance</p>
                <p className="text-lg font-bold text-primary">
                  {formatDistance(station.distanceAlongRouteM)}
                </p>
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase">
                Current Status
              </h4>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-1 text-xs text-primary"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
            <div className={`rounded-xl py-4 px-5 ${getStatusColor(station.status)}`}>
              <p className="text-2xl font-black text-center">
                {getStatusText(station.status)}
              </p>
              {station.lastUpdatedAt && (
                <p className="text-xs text-center mt-1 opacity-80">
                  Last update: {formatTimeAgo(station.lastUpdatedAt)} ago
                </p>
              )}
            </div>
          </div>

          {/* Recent reports */}
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground uppercase mb-2">
              Last 10 Reports
            </h4>
            <div className="bg-muted/30 rounded-xl px-4">
              {station.recentReports.length === 0 ? (
                <p className="py-6 text-center text-muted-foreground">
                  No recent reports
                </p>
              ) : (
                station.recentReports.map(report => (
                  <ReportRow key={report.id} report={report} />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default WeighStationBottomSheet;
