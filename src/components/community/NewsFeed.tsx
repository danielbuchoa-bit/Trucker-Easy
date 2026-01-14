import React, { useState, useEffect } from 'react';
import { Newspaper, AlertTriangle, Fuel, CloudSnow, Construction, Scale, Truck, ChevronRight, Loader2, RefreshCw, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  content: string;
  category: 'fmcsa' | 'hos' | 'weather' | 'diesel' | 'road_closure' | 'weigh_station' | 'recall' | 'strike';
  state?: string;
  urgency: 'normal' | 'today' | 'alert' | 'urgent';
  created_at: string;
}

const categoryIcons: Record<string, React.ElementType> = {
  fmcsa: Scale,
  hos: Truck,
  weather: CloudSnow,
  diesel: Fuel,
  road_closure: Construction,
  weigh_station: Scale,
  recall: AlertTriangle,
  strike: AlertTriangle,
};

const categoryLabels: Record<string, string> = {
  fmcsa: 'FMCSA',
  hos: 'HOS',
  weather: 'Weather',
  diesel: 'Diesel Prices',
  road_closure: 'Road Closure',
  weigh_station: 'Weigh Station',
  recall: 'Recall',
  strike: 'Strike',
};

const urgencyColors: Record<string, string> = {
  normal: 'bg-muted text-muted-foreground',
  today: 'bg-info/20 text-info',
  alert: 'bg-warning/20 text-warning',
  urgent: 'bg-destructive/20 text-destructive',
};

const NewsFeed: React.FC = () => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('trucking_news', {
        body: { limit: 20 }
      });

      if (error) throw error;
      
      if (data?.news) {
        setNews(data.news);
      }
    } catch (error) {
      console.error('Error fetching news:', error);
      // Set mock data for demo
      setNews(getMockNews());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getMockNews = (): NewsItem[] => [
    {
      id: '1',
      title: 'FMCSA Proposes New HOS Flexibility Rule',
      summary: 'New proposed rule would allow drivers more flexibility in splitting their 10-hour off-duty period.',
      content: 'The Federal Motor Carrier Safety Administration (FMCSA) has announced a proposed rule that would provide commercial motor vehicle drivers with more flexibility in how they take their required 10-hour off-duty period. The proposal comes after extensive feedback from the trucking industry requesting more practical rest options that better match real-world driving conditions.',
      category: 'fmcsa',
      urgency: 'today',
      created_at: new Date().toISOString(),
    },
    {
      id: '2',
      title: 'Diesel Prices Drop 5 Cents Nationwide',
      summary: 'Average diesel price now at $3.89/gallon, lowest in 6 months.',
      content: 'The national average diesel price has dropped to $3.89 per gallon, marking the lowest point in six months. The decrease is attributed to increased domestic production and lower crude oil prices. Analysts expect prices to remain stable through the coming weeks.',
      category: 'diesel',
      urgency: 'normal',
      created_at: new Date().toISOString(),
    },
    {
      id: '3',
      title: 'Winter Storm Warning: I-80 Wyoming',
      summary: 'Heavy snow expected along I-80 corridor. Chain requirements in effect.',
      content: 'A major winter storm is expected to impact the I-80 corridor through Wyoming starting tonight. The National Weather Service has issued a Winter Storm Warning with expected snowfall of 12-18 inches. Chain requirements are in effect for all commercial vehicles. Drivers are advised to check road conditions before travel.',
      category: 'weather',
      state: 'WY',
      urgency: 'urgent',
      created_at: new Date().toISOString(),
    },
    {
      id: '4',
      title: 'Peterbilt Issues Recall for 2023-2024 Models',
      summary: 'Recall affects steering column components on select 579 and 389 models.',
      content: 'Peterbilt has issued a voluntary recall affecting certain 2023-2024 Model 579 and 389 trucks. The recall addresses a potential issue with steering column components that could affect vehicle handling. Owners should contact their local Peterbilt dealer to schedule inspection and repair.',
      category: 'recall',
      urgency: 'alert',
      created_at: new Date().toISOString(),
    },
    {
      id: '5',
      title: 'California Weigh Station Hours Extended',
      summary: 'Permanent 24/7 operations begin at major I-5 stations.',
      content: 'The California Highway Patrol has announced extended hours at major weigh stations along the I-5 corridor. Starting next month, four key stations will operate 24/7 to improve commercial vehicle safety and compliance. Drivers should expect increased inspections during overnight hours.',
      category: 'weigh_station',
      state: 'CA',
      urgency: 'today',
      created_at: new Date().toISOString(),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Refresh Button */}
      <div className="flex justify-end">
        <button
          onClick={() => fetchNews(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Updating...' : 'Refresh'}
        </button>
      </div>

      {/* News Cards */}
      {news.map((item) => {
        const Icon = categoryIcons[item.category] || Newspaper;
        return (
          <button
            key={item.id}
            onClick={() => setSelectedNews(item)}
            className="w-full p-4 bg-card rounded-xl border border-border hover:border-primary/50 transition-all text-left"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-foreground" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  {item.urgency !== 'normal' && (
                    <Badge className={urgencyColors[item.urgency]}>
                      {item.urgency.toUpperCase()}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    {categoryLabels[item.category]}
                  </Badge>
                  {item.state && (
                    <Badge variant="outline" className="text-xs flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {item.state}
                    </Badge>
                  )}
                </div>
                
                <h3 className="font-semibold text-foreground line-clamp-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{item.summary}</p>
              </div>
              
              <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-2" />
            </div>
          </button>
        );
      })}

      {/* Empty State */}
      {news.length === 0 && (
        <div className="text-center py-12">
          <Newspaper className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No news available</p>
        </div>
      )}

      {/* News Detail Modal */}
      <Dialog open={!!selectedNews} onOpenChange={() => setSelectedNews(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          {selectedNews && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  {selectedNews.urgency !== 'normal' && (
                    <Badge className={urgencyColors[selectedNews.urgency]}>
                      {selectedNews.urgency.toUpperCase()}
                    </Badge>
                  )}
                  <Badge variant="outline">
                    {categoryLabels[selectedNews.category]}
                  </Badge>
                  {selectedNews.state && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {selectedNews.state}
                    </Badge>
                  )}
                </div>
                <DialogTitle className="text-xl">{selectedNews.title}</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  {new Date(selectedNews.created_at).toLocaleDateString()}
                </DialogDescription>
              </DialogHeader>
              
              <div className="mt-4">
                <p className="text-foreground leading-relaxed">{selectedNews.content}</p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NewsFeed;
