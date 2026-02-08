import { useEffect, useState } from 'react';
import { Scale, X, Clock, MessageSquare } from 'lucide-react';
import { StationOnRoute, StationStatus, ReportOutcome } from '@/hooks/useWeighStationAlerts';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

interface FullReport {
  id: string;
  station_id: string;
  created_at: string;
  status_reported: string;
  outcome: string;
  comment: string | null;
}

interface WeighStationReportsSheetProps {
  station: StationOnRoute;
  onClose: () => void;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'OPEN': return 'text-green-500';
    case 'CLOSED': return 'text-red-500';
    default: return 'text-muted-foreground';
  }
}

function getOutcomeLabel(outcome: string): string {
  switch (outcome) {
    case 'BYPASS': return 'Bypass';
    case 'WEIGHED': return 'Rolling Across';
    case 'INSPECTED': return 'Inspection';
    default: return outcome;
  }
}

function getOutcomeColor(outcome: string): string {
  switch (outcome) {
    case 'BYPASS': return 'text-green-500';
    case 'WEIGHED': return 'text-amber-500';
    case 'INSPECTED': return 'text-red-500';
    default: return 'text-muted-foreground';
  }
}

function formatTimeAgo(dateStr: string): string {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return 'unknown';
  }
}

const WeighStationReportsSheet = ({ station, onClose }: WeighStationReportsSheetProps) => {
  const [visible, setVisible] = useState(false);
  const [reports, setReports] = useState<FullReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const { data, error } = await supabase
        .from('weigh_station_reports')
        .select('id, station_id, created_at, status_reported, outcome, comment')
        .eq('station_id', station.station.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setReports((data || []) as FullReport[]);
    } catch (e) {
      console.error('[REPORTS] Error fetching:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-[80] transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />

      {/* Sheet */}
      <div
        className={`
          fixed inset-x-0 bottom-0 z-[81]
          bg-card rounded-t-3xl shadow-2xl
          max-h-[85vh] overflow-hidden
          transition-transform duration-300 ease-out
          ${visible ? 'translate-y-0' : 'translate-y-full'}
        `}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1.5 rounded-full bg-muted" />
        </div>

        {/* Header */}
        <div className="px-4 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Scale className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">{station.station.name}</h2>
              <p className="text-xs text-muted-foreground">Last 20 driver reports</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-9 h-9 rounded-full bg-muted flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Reports List */}
        <div className="px-4 pb-8 overflow-y-auto max-h-[70vh]">
          {loading ? (
            <div className="py-12 text-center text-muted-foreground text-sm">Loading reports...</div>
          ) : reports.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">No reports yet for this station.</div>
          ) : (
            <div className="space-y-2">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="bg-muted/40 rounded-xl p-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${getStatusColor(report.status_reported)}`}>
                        {report.status_reported}
                      </span>
                      {report.outcome && report.status_reported !== 'CLOSED' && (
                        <>
                          <span className="text-muted-foreground text-xs">→</span>
                          <span className={`text-sm font-semibold ${getOutcomeColor(report.outcome)}`}>
                            {getOutcomeLabel(report.outcome)}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {formatTimeAgo(report.created_at)}
                    </div>
                  </div>
                  {report.comment && (
                    <div className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
                      <MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <p className="italic">"{report.comment}"</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default WeighStationReportsSheet;
