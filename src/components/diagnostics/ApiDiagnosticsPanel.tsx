/**
 * API Diagnostics Panel - P0-1 Fix
 * 
 * Shows last 100 API events with:
 * - Request counts per minute
 * - Status codes and latency
 * - Circuit breaker state
 * - Cache hit rates
 */

import React, { useState, useEffect } from 'react';
import { apiDiagnostics, type ApiRequest, type ApiStats } from '@/services/ApiDiagnosticsService';
import { poiCache } from '@/services/PoiCacheService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, RefreshCw, Trash2, AlertTriangle, CheckCircle, Clock, Wifi, WifiOff } from 'lucide-react';

interface ApiDiagnosticsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApiDiagnosticsPanel: React.FC<ApiDiagnosticsPanelProps> = ({ isOpen, onClose }) => {
  const [stats, setStats] = useState<ApiStats>(apiDiagnostics.getStats());
  const [requests, setRequests] = useState<ApiRequest[]>(apiDiagnostics.getRequestLog());
  const [circuitBreaker, setCircuitBreaker] = useState(apiDiagnostics.getCircuitBreakerState());
  const [cacheStats, setCacheStats] = useState(poiCache.getStats());

  useEffect(() => {
    if (!isOpen) return;

    // Initial load
    setStats(apiDiagnostics.getStats());
    setRequests(apiDiagnostics.getRequestLog());
    setCircuitBreaker(apiDiagnostics.getCircuitBreakerState());
    setCacheStats(poiCache.getStats());

    // Subscribe to updates
    const unsubscribe = apiDiagnostics.subscribe((newStats) => {
      setStats(newStats);
      setRequests(apiDiagnostics.getRequestLog());
      setCircuitBreaker(apiDiagnostics.getCircuitBreakerState());
      setCacheStats(poiCache.getStats());
    });

    // Poll for updates
    const interval = setInterval(() => {
      setStats(apiDiagnostics.getStats());
      setCircuitBreaker(apiDiagnostics.getCircuitBreakerState());
      setCacheStats(poiCache.getStats());
    }, 2000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [isOpen]);

  const handleClear = () => {
    apiDiagnostics.clear();
    poiCache.clear();
    setStats(apiDiagnostics.getStats());
    setRequests([]);
    setCircuitBreaker(apiDiagnostics.getCircuitBreakerState());
    setCacheStats(poiCache.getStats());
  };

  const getStatusColor = (statusCode: number) => {
    if (statusCode >= 200 && statusCode < 300) return 'bg-primary';
    if (statusCode === 429) return 'bg-destructive';
    if (statusCode >= 400 && statusCode < 500) return 'bg-accent';
    return 'bg-destructive';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col border">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wifi className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">API Diagnostics</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={handleClear}>
              <Trash2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="p-4 border-b grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{stats.requestsPerMinute}</div>
            <div className="text-xs text-muted-foreground">Req/min</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${stats.successRate < 0.8 ? 'text-destructive' : 'text-primary'}`}>
              {Math.round(stats.successRate * 100)}%
            </div>
            <div className="text-xs text-muted-foreground">Success</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{stats.avgLatencyMs}ms</div>
            <div className="text-xs text-muted-foreground">Avg Latency</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{Math.round(stats.cacheHitRate * 100)}%</div>
            <div className="text-xs text-muted-foreground">Cache Hits</div>
          </div>
        </div>

        {/* Circuit Breaker Status */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {circuitBreaker.isOpen ? (
                <>
                  <WifiOff className="w-5 h-5 text-destructive" />
                  <span className="font-medium text-destructive">Circuit Breaker OPEN</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5 text-primary" />
                  <span className="font-medium text-primary">Circuit Breaker Closed</span>
                </>
              )}
            </div>
            {circuitBreaker.isOpen && circuitBreaker.openedAt && (
              <Badge variant="destructive">
                Cooldown: {Math.ceil((circuitBreaker.cooldownMs - (Date.now() - circuitBreaker.openedAt)) / 1000)}s
              </Badge>
            )}
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            429 errors: {stats.rateLimitedRequests} | Cache entries: {cacheStats.entries}
          </div>
        </div>

        {/* Request Log */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-2">
            {requests.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No API requests logged yet
              </div>
            ) : (
              requests.map((req) => (
                <div
                  key={req.id}
                  className={`p-3 rounded-lg border ${req.cached ? 'bg-blue-500/10' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${getStatusColor(req.statusCode)}`} />
                      <span className="font-mono text-sm">{req.endpoint}</span>
                      {req.cached && (
                        <Badge variant="secondary" className="text-xs">cached</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {req.latencyMs}ms
                    </div>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>Status: {req.statusCode}</span>
                    <span>Provider: {req.provider || 'unknown'}</span>
                    <span>{new Date(req.timestamp).toLocaleTimeString()}</span>
                  </div>
                  {req.error && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-destructive">
                      <AlertTriangle className="w-3 h-3" />
                      {req.error}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default ApiDiagnosticsPanel;
