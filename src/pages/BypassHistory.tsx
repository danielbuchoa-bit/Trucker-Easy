import { useState, useEffect } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Scale, CheckCircle, XCircle, HelpCircle, TrendingUp, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BypassEvent } from '@/types/bypass';
import BottomNav from '@/components/navigation/BottomNav';

interface BypassStats {
  total: number;
  bypassCount: number;
  pullInCount: number;
  bypassPercentage: number;
  pullInPercentage: number;
  topStates: { state: string; count: number }[];
}

const BypassHistory = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [events, setEvents] = useState<BypassEvent[]>([]);
  const [stats, setStats] = useState<BypassStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'history' | 'stats'>('history');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate('/auth');
          return;
        }

        // Fetch last 50 events
        const { data: eventsData, error: eventsError } = await supabase
          .from('bypass_events')
          .select(`
            *,
            weigh_stations (
              name,
              state
            )
          `)
          .eq('user_id', user.id)
          .order('occurred_at', { ascending: false })
          .limit(50);

        if (eventsError) throw eventsError;
        // Cast events to proper type
        const typedEvents = (eventsData || []).map(e => ({
          ...e,
          result: e.result as 'bypass' | 'pull_in' | 'unknown'
        }));
        setEvents(typedEvents);

        // Fetch stats for last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: statsData, error: statsError } = await supabase
          .from('bypass_events')
          .select(`
            result,
            weigh_stations (
              state
            )
          `)
          .eq('user_id', user.id)
          .gte('occurred_at', thirtyDaysAgo.toISOString());

        if (statsError) throw statsError;

        // Calculate stats
        const total = statsData?.length || 0;
        const bypassCount = statsData?.filter(e => e.result === 'bypass').length || 0;
        const pullInCount = statsData?.filter(e => e.result === 'pull_in').length || 0;

        // Group by state
        const stateCount: Record<string, number> = {};
        statsData?.forEach(e => {
          const state = (e.weigh_stations as any)?.state;
          if (state) {
            stateCount[state] = (stateCount[state] || 0) + 1;
          }
        });

        const topStates = Object.entries(stateCount)
          .map(([state, count]) => ({ state, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        setStats({
          total,
          bypassCount,
          pullInCount,
          bypassPercentage: total > 0 ? Math.round((bypassCount / total) * 100) : 0,
          pullInPercentage: total > 0 ? Math.round((pullInCount / total) * 100) : 0,
          topStates,
        });
      } catch (error) {
        console.error('Error fetching bypass history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

  const getResultIcon = (result: string) => {
    switch (result) {
      case 'bypass':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'pull_in':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <HelpCircle className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getResultLabel = (result: string) => {
    switch (result) {
      case 'bypass':
        return t.bypass.gotBypass;
      case 'pull_in':
        return t.bypass.pulledIn;
      default:
        return t.bypass.dontKnow;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-gradient-to-b from-primary/20 to-background pt-safe">
        <div className="p-4 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <Scale className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-bold">{t.bypass.history}</h1>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-4 pb-4">
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
              activeTab === 'history'
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-muted-foreground'
            }`}
          >
            {t.bypass.historyTab}
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
              activeTab === 'stats'
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-muted-foreground'
            }`}
          >
            {t.bypass.statsTab}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : activeTab === 'history' ? (
        <div className="p-4 space-y-3">
          {events.length === 0 ? (
            <div className="text-center py-12">
              <Scale className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">{t.bypass.noHistory}</p>
            </div>
          ) : (
            events.map((event) => (
              <div
                key={event.id}
                className="bg-card rounded-xl border border-border p-4 flex items-center gap-4"
              >
                {getResultIcon(event.result)}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">
                    {(event.weigh_stations as any)?.name || t.bypass.unknownStation}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {(event.weigh_stations as any)?.state || ''} • {formatDate(event.occurred_at)}
                  </p>
                </div>
                <span className={`text-sm font-medium ${
                  event.result === 'bypass' ? 'text-green-500' :
                  event.result === 'pull_in' ? 'text-red-500' :
                  'text-muted-foreground'
                }`}>
                  {getResultLabel(event.result)}
                </span>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="p-4 space-y-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card rounded-xl border border-border p-4 text-center">
              <TrendingUp className="w-6 h-6 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">{stats?.total || 0}</p>
              <p className="text-xs text-muted-foreground">{t.bypass.totalEvents}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 text-center">
              <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-green-500">{stats?.bypassPercentage || 0}%</p>
              <p className="text-xs text-muted-foreground">{t.bypass.bypassRate}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 text-center">
              <XCircle className="w-6 h-6 text-red-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-red-500">{stats?.pullInPercentage || 0}%</p>
              <p className="text-xs text-muted-foreground">{t.bypass.pullInRate}</p>
            </div>
          </div>

          {/* Last 30 days label */}
          <p className="text-sm text-muted-foreground text-center">{t.bypass.last30Days}</p>

          {/* Top States */}
          {stats?.topStates && stats.topStates.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">{t.bypass.topStates}</h3>
              </div>
              <div className="space-y-3">
                {stats.topStates.map((item, index) => (
                  <div key={item.state} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                      {index + 1}
                    </span>
                    <span className="flex-1 font-medium">{item.state}</span>
                    <span className="text-muted-foreground">{item.count} {t.bypass.events}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <BottomNav activeTab="profile" onTabChange={(tab) => navigate(`/${tab === 'map' ? 'home' : tab}`)} />
    </div>
  );
};

export default BypassHistory;
