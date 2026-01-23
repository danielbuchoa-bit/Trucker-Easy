import React, { useState, useEffect } from 'react';
import { Newspaper, ExternalLink, RefreshCw, MapPin, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  image_url: string | null;
  source_url: string;
  source: string;
  category: string;
  state?: string;
  urgency: 'normal' | 'today' | 'alert' | 'urgent';
  published_at: string;
  fetched_at?: string;
}

const urgencyColors: Record<string, string> = {
  normal: 'bg-muted text-muted-foreground',
  today: 'bg-info/20 text-info',
  alert: 'bg-warning/20 text-warning',
  urgent: 'bg-destructive/20 text-destructive',
};

const NewsFeed: React.FC = () => {
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  const fetchNews = async (force = false) => {
    try {
      setError(null);
      const today = new Date().toISOString().split('T')[0];
      
      console.log('[NewsFeed] Fetching news, force:', force, 'today:', today);
      
      // First try to get from database
      const { data: dbNews, error: dbError } = await supabase
        .from('trucking_news')
        .select('*')
        .order('published_at', { ascending: false })
        .limit(15);

      if (dbError) {
        console.error('[NewsFeed] DB error:', dbError);
      }

      // Log what we got from DB
      if (dbNews && dbNews.length > 0) {
        const latestDate = dbNews[0]?.published_at?.split('T')[0];
        const fetchedAt = dbNews[0]?.fetched_at;
        const fetchedDate = fetchedAt?.split('T')[0];
        console.log('[NewsFeed] DB news count:', dbNews.length, 'latest date:', latestDate, 'fetched:', fetchedAt);
        setLastUpdate(fetchedAt || null);
        
        // Cache por data de coleta (fetched_at), não por published_at (que pode ser dias atrás)
        if (fetchedDate === today && !force) {
          console.log('[NewsFeed] Using cached news from today');
          setNews(dbNews as NewsItem[]);
          setLoading(false);
          return;
        }
      }

      // Fetch fresh news from edge function
      console.log('[NewsFeed] Calling edge function to refresh...');
      const { data, error: fnError } = await supabase.functions.invoke('fetch_trucking_news', {
        body: { forceRefresh: force },
      });

      if (fnError) {
        console.error('[NewsFeed] Function error:', fnError);
        // Fall back to DB news if available
        if (dbNews && dbNews.length > 0) {
          console.log('[NewsFeed] Using cached news due to function error');
          setNews(dbNews as NewsItem[]);
          setLoading(false);
          return;
        }
        throw fnError;
      }

      console.log('[NewsFeed] Function response:', {
        ok: data?.ok,
        cached: data?.cached,
        itemCount: data?.itemCount ?? data?.count,
        generatedAt: data?.generatedAt ?? data?.lastUpdate,
        warning: data?.warning,
      });

      // Compat: aceita formatos antigos e novos da função
      if (Array.isArray(data?.news) && data.news.length >= 0) {
        setNews(data.news as NewsItem[]);
        setLastUpdate((data.generatedAt || data.lastUpdate) ?? new Date().toISOString());
        if (force) {
          const isCached = Boolean(data?.cached);
          toast.success(isCached ? 'Notícias já atualizadas' : `${data.news.length} notícias atualizadas!`);
        }
      } else {
        throw new Error(data?.error || 'Failed to fetch news');
      }
    } catch (err) {
      console.error('[NewsFeed] Error:', err);
      setError('Não foi possível carregar as notícias');
      toast.error('Erro ao carregar notícias');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchNews(true);
  };

  const openNews = (url: string) => {
    window.open(url, '_blank');
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Hoje';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Ontem';
    }
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-card rounded-xl border border-border animate-pulse">
            <div className="h-32 bg-muted rounded-t-xl" />
            <div className="p-3 space-y-2">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-full" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error && news.length === 0) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
        <p className="text-muted-foreground mb-4">{error}</p>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header with Refresh Button and Last Update */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {lastUpdate && (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
              <span>Atualizado: {new Date(lastUpdate).toLocaleString('pt-BR', { 
                day: '2-digit', 
                month: '2-digit', 
                hour: '2-digit', 
                minute: '2-digit' 
              })}</span>
            </>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>

      {/* News Cards */}
      {news.map((item) => (
        <button
          key={item.id}
          onClick={() => openNews(item.source_url)}
          className="w-full bg-card rounded-xl border border-border hover:border-primary/50 transition-all text-left overflow-hidden"
        >
          {/* Image */}
          <div className="relative h-32 w-full">
            <img 
              src={item.image_url || 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=400&h=200&fit=crop'} 
              alt={item.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=400&h=200&fit=crop';
              }}
            />
            <div className="absolute top-2 left-2 flex items-center gap-2 flex-wrap">
              {item.urgency !== 'normal' && (
                <Badge className={urgencyColors[item.urgency]}>
                  {item.urgency === 'today' ? 'HOJE' : item.urgency === 'alert' ? 'ALERTA' : 'URGENTE'}
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
                <span>{formatDate(item.published_at)}</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-primary">
                <span>Ler mais</span>
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
          <p className="text-muted-foreground">Nenhuma notícia disponível</p>
          <button
            onClick={handleRefresh}
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg"
          >
            Carregar notícias
          </button>
        </div>
      )}
    </div>
  );
};

export default NewsFeed;
