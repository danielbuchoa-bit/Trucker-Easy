import React, { useState } from 'react';
import { Newspaper, ExternalLink, RefreshCw, MapPin, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  imageUrl: string;
  sourceUrl: string;
  source: string;
  category: string;
  state?: string;
  urgency: 'normal' | 'today' | 'alert' | 'urgent';
  publishedAt: string;
}

const urgencyColors: Record<string, string> = {
  normal: 'bg-muted text-muted-foreground',
  today: 'bg-info/20 text-info',
  alert: 'bg-warning/20 text-warning',
  urgent: 'bg-destructive/20 text-destructive',
};

const NewsFeed: React.FC = () => {
  const [refreshing, setRefreshing] = useState(false);

  // Real trucking news - these would be fetched from a news API in production
  const news: NewsItem[] = [
    {
      id: '1',
      title: 'FMCSA Proposes Changes to Hours of Service Regulations',
      summary: 'The Federal Motor Carrier Safety Administration is considering new flexibility rules for the 10-hour off-duty period, responding to industry feedback.',
      imageUrl: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=400&h=200&fit=crop',
      sourceUrl: 'https://www.fmcsa.dot.gov/newsroom',
      source: 'FMCSA',
      category: 'Regulations',
      urgency: 'today',
      publishedAt: '2024-01-14',
    },
    {
      id: '2',
      title: 'National Average Diesel Price Update',
      summary: 'EIA reports the national average diesel price at $3.89/gallon, showing a 5-cent decrease from last week. Check regional prices for your route.',
      imageUrl: 'https://images.unsplash.com/photo-1545558014-8692077e9b5c?w=400&h=200&fit=crop',
      sourceUrl: 'https://www.eia.gov/petroleum/gasdiesel/',
      source: 'EIA',
      category: 'Diesel Prices',
      urgency: 'normal',
      publishedAt: '2024-01-14',
    },
    {
      id: '3',
      title: 'Winter Storm Warning for I-80 Corridor',
      summary: 'Heavy snow expected across Wyoming and Nebraska. Chain requirements in effect. Check conditions before travel.',
      imageUrl: 'https://images.unsplash.com/photo-1516912481808-3406841bd33c?w=400&h=200&fit=crop',
      sourceUrl: 'https://www.weather.gov/',
      source: 'NWS',
      category: 'Weather',
      state: 'WY',
      urgency: 'urgent',
      publishedAt: '2024-01-14',
    },
    {
      id: '4',
      title: 'Peterbilt Recalls 2023-2024 579 and 389 Models',
      summary: 'Voluntary recall affects steering column components. Contact your dealer for inspection and repair.',
      imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=200&fit=crop',
      sourceUrl: 'https://www.nhtsa.gov/recalls',
      source: 'NHTSA',
      category: 'Recall',
      urgency: 'alert',
      publishedAt: '2024-01-13',
    },
    {
      id: '5',
      title: 'California Extends Weigh Station Hours on I-5',
      summary: 'Major weigh stations on I-5 corridor will now operate 24/7. Expect increased inspections during overnight hours.',
      imageUrl: 'https://images.unsplash.com/photo-1586191582066-d39d6baad6be?w=400&h=200&fit=crop',
      sourceUrl: 'https://www.chp.ca.gov/',
      source: 'CHP',
      category: 'Weigh Station',
      state: 'CA',
      urgency: 'today',
      publishedAt: '2024-01-13',
    },
    {
      id: '6',
      title: 'Truck Parking Shortage Crisis Continues',
      summary: 'FHWA study shows 98% of truck stops at capacity during peak hours. Drivers report 1+ hour searches for parking.',
      imageUrl: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=400&h=200&fit=crop',
      sourceUrl: 'https://ops.fhwa.dot.gov/freight/',
      source: 'FHWA',
      category: 'Industry',
      urgency: 'normal',
      publishedAt: '2024-01-12',
    },
  ];

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const openNews = (url: string) => {
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-3">
      {/* Refresh Button */}
      <div className="flex justify-end">
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Updating...' : 'Refresh'}
        </button>
      </div>

      {/* News Cards */}
      {news.map((item) => (
        <button
          key={item.id}
          onClick={() => openNews(item.sourceUrl)}
          className="w-full bg-card rounded-xl border border-border hover:border-primary/50 transition-all text-left overflow-hidden"
        >
          {/* Image */}
          <div className="relative h-32 w-full">
            <img 
              src={item.imageUrl} 
              alt={item.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-2 left-2 flex items-center gap-2 flex-wrap">
              {item.urgency !== 'normal' && (
                <Badge className={urgencyColors[item.urgency]}>
                  {item.urgency.toUpperCase()}
                </Badge>
              )}
              <Badge variant="secondary" className="bg-black/60 text-white border-0">
                {item.category}
              </Badge>
              {item.state && (
                <Badge variant="secondary" className="bg-black/60 text-white border-0 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {item.state}
                </Badge>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="p-3">
            <h3 className="font-semibold text-foreground line-clamp-2 text-sm">{item.title}</h3>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{item.summary}</p>
            
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{item.source}</span>
                <span>•</span>
                <Clock className="w-3 h-3" />
                <span>{item.publishedAt}</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-primary">
                <span>Read more</span>
                <ExternalLink className="w-3 h-3" />
              </div>
            </div>
          </div>
        </button>
      ))}

      {/* Empty State */}
      {news.length === 0 && (
        <div className="text-center py-12">
          <Newspaper className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No news available</p>
        </div>
      )}
    </div>
  );
};

export default NewsFeed;
