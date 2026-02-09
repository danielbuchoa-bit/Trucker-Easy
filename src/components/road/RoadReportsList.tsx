import React, { useEffect, useState } from 'react';
import { Scale, CloudSnow, Car, ThumbsUp, ThumbsDown, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useGeolocation, calculateDistance } from '@/hooks/useGeolocation';
import { toast } from '@/hooks/use-toast';
import type { RoadReport, RoadReportDetails } from '@/types/collaborative';
import { ROAD_CONDITIONS } from '@/types/collaborative';
import { formatDistanceToNow } from 'date-fns';

interface RoadReportsListProps {
  maxDistance?: number; // in meters
}

const RoadReportsList: React.FC<RoadReportsListProps> = ({ maxDistance = 50000 }) => {
  const { latitude, longitude } = useGeolocation();
  const [reports, setReports] = useState<RoadReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id || null);
    });
  }, []);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const { data, error } = await supabase
          .from('road_reports')
          .select('*')
          .eq('active', true)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false });

        if (error) throw error;
        setReports((data || []) as unknown as RoadReport[]);
      } catch (error) {
        console.error('Error fetching reports:', error);
      }
      setLoading(false);
    };

    fetchReports();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('road_reports_channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'road_reports',
        },
        () => {
          fetchReports();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleVote = async (reportId: string, voteType: 'confirm' | 'deny') => {
    if (!userId) {
      toast({ title: 'Please sign in', variant: 'destructive' });
      return;
    }

    setVoting(reportId);
    
    try {
      // Insert vote
      const { error: voteError } = await supabase.from('report_votes').insert({
        report_id: reportId,
        user_id: userId,
        vote_type: voteType,
      });

      if (voteError) {
        if (voteError.code === '23505') {
          toast({ title: 'Already voted', variant: 'destructive' });
        } else {
          throw voteError;
        }
        setVoting(null);
        return;
      }

      // Update report counts
      const report = reports.find(r => r.id === reportId);
      if (report) {
        const updates = voteType === 'confirm'
          ? { confirmations: report.confirmations + 1 }
          : { denials: report.denials + 1 };

        const { error: updateError } = await supabase
          .from('road_reports')
          .update(updates)
          .eq('id', reportId);

        if (updateError) throw updateError;

        setReports(prev => prev.map(r => 
          r.id === reportId ? { ...r, ...updates } : r
        ));
      }

      toast({ title: voteType === 'confirm' ? 'Confirmed!' : 'Reported as not there' });
    } catch (error) {
      console.error('Error voting:', error);
      toast({ title: 'Failed to vote', variant: 'destructive' });
    }
    
    setVoting(null);
  };

  const getReportIcon = (type: string) => {
    switch (type) {
      case 'weigh_station':
        return <Scale className="w-5 h-5" />;
      case 'road_condition':
        return <CloudSnow className="w-5 h-5" />;
      case 'parking':
        return <Car className="w-5 h-5" />;
      default:
        return null;
    }
  };

  const getReportLabel = (report: RoadReport) => {
    const details = report.details as RoadReportDetails;
    
    if (report.report_type === 'weigh_station') {
      return `Scale ${details.status?.toUpperCase() || 'UNKNOWN'}`;
    }
    if (report.report_type === 'road_condition') {
      const condition = ROAD_CONDITIONS.find(c => c.value === details.condition);
      return condition ? `${condition.icon} ${condition.label}` : 'Road Issue';
    }
    if (report.report_type === 'parking') {
      const status = details.parking_status;
      if (status === 'full') return '🔴 Lot Full';
      if (status === 'few_spots') return '🟡 Few Spots';
      return '🟢 Plenty';
    }
    return 'Report';
  };

  const getDistance = (report: RoadReport): string => {
    if (!latitude || !longitude) return '';
    const dist = calculateDistance(latitude, longitude, report.lat, report.lng);
    if (dist < 1000) return `${Math.round(dist)}m`;
    return `${(dist / 1000).toFixed(1)}km`;
  };

  const getConfidenceScore = (report: RoadReport): number => {
    const total = report.confirmations + report.denials;
    if (total === 0) return 50;
    return Math.round((report.confirmations / total) * 100);
  };

  // Filter by distance if location available
  const filteredReports = latitude && longitude
    ? reports.filter(report => {
        const dist = calculateDistance(latitude, longitude, report.lat, report.lng);
        return dist <= maxDistance;
      })
    : reports;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (filteredReports.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <AlertTriangle className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-muted-foreground font-medium">No active reports right now</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Reports expire after a few hours. Use the Report button to share road conditions!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {filteredReports.map((report) => {
        const details = report.details as RoadReportDetails;
        const confidence = getConfidenceScore(report);
        
        return (
          <Card key={report.id}>
            <CardContent className="py-3">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    {getReportIcon(report.report_type)}
                  </div>
                  <div>
                    <p className="font-semibold">{getReportLabel(report)}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{getDistance(report)} away</span>
                      <span>•</span>
                      <span>{formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}</span>
                    </div>
                    {report.report_type === 'weigh_station' && details.inspection && details.inspection !== 'none' && (
                      <Badge variant="destructive" className="mt-1 text-xs">
                        Inspection: {details.inspection.replace('_', ' ')}
                      </Badge>
                    )}
                  </div>
                </div>
                
                <Badge 
                  variant={confidence >= 70 ? 'default' : confidence >= 40 ? 'secondary' : 'outline'}
                  className="text-xs"
                >
                  {confidence}% confident
                </Badge>
              </div>

              <div className="flex gap-2 mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleVote(report.id, 'confirm')}
                  disabled={voting === report.id}
                  className="flex-1"
                >
                  {voting === report.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <ThumbsUp className="w-4 h-4 mr-1" />
                      Confirm ({report.confirmations})
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleVote(report.id, 'deny')}
                  disabled={voting === report.id}
                  className="flex-1"
                >
                  {voting === report.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <ThumbsDown className="w-4 h-4 mr-1" />
                      Not There ({report.denials})
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default RoadReportsList;
