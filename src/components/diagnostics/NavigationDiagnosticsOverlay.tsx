/**
 * Navigation Diagnostics Overlay Panel
 * 
 * Real-time visual diagnostics for HERE ↔ Mapbox integration
 */

import React, { useState, useEffect } from 'react';
import { useNavigationDiagnosticsSafe } from '@/contexts/NavigationDiagnosticsContext';
import { 
  X, Copy, Check, RefreshCw, ChevronDown, ChevronUp, 
  AlertTriangle, CheckCircle, XCircle, Clock, Activity,
  MapPin, Compass, Wifi, WifiOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

const NavigationDiagnosticsOverlay: React.FC = () => {
  const diagnostics = useNavigationDiagnosticsSafe();
  const [copied, setCopied] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>('here');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [, forceUpdate] = useState(0);

  // Auto-refresh every 500ms
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => forceUpdate(n => n + 1), 500);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  if (!diagnostics || !diagnostics.isEnabled) return null;

  const handleCopy = async () => {
    try {
      const data = diagnostics.exportDiagnostics();
      await navigator.clipboard.writeText(data);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const handleRefreshChecklist = () => {
    diagnostics.generateChecklist();
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const formatTime = (ts: number | undefined) => {
    if (!ts) return '--';
    const d = new Date(ts);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getStatusColor = (status: number | 'ok' | 'error' | undefined) => {
    if (status === 'ok' || (typeof status === 'number' && status >= 200 && status < 300)) {
      return 'text-green-400';
    }
    if (status === 401 || status === 403) return 'text-orange-400';
    if (status === 429) return 'text-yellow-400';
    if (typeof status === 'number' && status >= 400) return 'text-red-400';
    return 'text-gray-400';
  };

  const SectionHeader: React.FC<{ 
    id: string; 
    title: string; 
    icon: React.ReactNode; 
    status?: 'ok' | 'error' | 'warning' | 'pending' 
  }> = ({ id, title, icon, status }) => (
    <button
      onClick={() => toggleSection(id)}
      className="w-full flex items-center justify-between p-2 bg-white/5 rounded hover:bg-white/10 transition-colors"
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="font-medium text-sm">{title}</span>
        {status && (
          <Badge variant={
            status === 'ok' ? 'default' : 
            status === 'error' ? 'destructive' : 
            status === 'warning' ? 'secondary' : 'outline'
          } className="text-[10px] px-1.5 py-0">
            {status.toUpperCase()}
          </Badge>
        )}
      </div>
      {expandedSection === id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
    </button>
  );

  const hereStatus = diagnostics.hereRouting?.statusCode === 200 ? 'ok' : 
    diagnostics.hereRouting ? 'error' : 'pending';
  const mapboxStatus = diagnostics.mapboxRender?.routeLayerExists ? 'ok' : 
    diagnostics.mapboxRender?.styleLoaded ? 'error' : 'pending';
  const gpsStatus = diagnostics.gps?.isStale ? 'warning' : 
    diagnostics.gps ? 'ok' : 'pending';

  return (
    <div className="fixed bottom-4 left-2 right-2 z-[9999] max-w-md mx-auto">
      <div className="bg-gray-900/95 backdrop-blur-sm text-white text-xs rounded-lg shadow-2xl border border-white/20 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-2 bg-gradient-to-r from-blue-600/50 to-purple-600/50 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-yellow-400 animate-pulse" />
            <span className="font-bold">DEBUG_NAV</span>
            <Badge variant="outline" className="text-[9px] px-1 py-0 bg-yellow-500/20 border-yellow-500/50">
              ON
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button 
              size="sm" 
              variant="ghost" 
              className="h-6 w-6 p-0"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              <RefreshCw size={12} className={autoRefresh ? 'animate-spin' : ''} />
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              className="h-6 w-6 p-0"
              onClick={handleCopy}
            >
              {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              className="h-6 w-6 p-0"
              onClick={diagnostics.toggleDebugNav}
            >
              <X size={12} />
            </Button>
          </div>
        </div>

        <ScrollArea className="max-h-[50vh]">
          <div className="p-2 space-y-2">
            {/* HERE Routing Section */}
            <div>
              <SectionHeader 
                id="here" 
                title="HERE Routing" 
                icon={<MapPin size={14} className="text-blue-400" />}
                status={hereStatus}
              />
              {expandedSection === 'here' && (
                <div className="mt-2 p-2 bg-black/30 rounded space-y-1 text-[11px]">
                  {diagnostics.hereRouting ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Endpoint:</span>
                        <span className="text-blue-300 truncate max-w-[60%]">
                          {diagnostics.hereRouting.endpoint}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">API Version:</span>
                        <span>{diagnostics.hereRouting.apiVersion}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Status:</span>
                        <span className={getStatusColor(diagnostics.hereRouting.statusCode)}>
                          {diagnostics.hereRouting.statusCode}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Latency:</span>
                        <span className={diagnostics.hereRouting.requestLatencyMs > 5000 ? 'text-yellow-400' : 'text-green-400'}>
                          {diagnostics.hereRouting.requestLatencyMs}ms
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Response Size:</span>
                        <span>{(diagnostics.hereRouting.responseSizeBytes / 1024).toFixed(1)} KB</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Polyline:</span>
                        <span className={diagnostics.hereRouting.hasPolyline ? 'text-green-400' : 'text-red-400'}>
                          {diagnostics.hereRouting.hasPolyline ? '✓ Present' : '✗ Missing'}
                        </span>
                      </div>
                      {diagnostics.hereRouting.hasPolyline && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Path:</span>
                            <span className="text-gray-300">{diagnostics.hereRouting.polylinePath}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Format:</span>
                            <span className="text-purple-300">{diagnostics.hereRouting.polylineFormat}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Decoded Points:</span>
                            <span className="text-cyan-300">{diagnostics.hereRouting.decodedPointCount}</span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-400">Timestamp:</span>
                        <span>{formatTime(diagnostics.hereRouting.timestamp)}</span>
                      </div>
                      {diagnostics.hereRouting.error && (
                        <div className="p-1 bg-red-900/50 rounded text-red-300 break-words">
                          ❌ {diagnostics.hereRouting.error}
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-gray-500">No requests yet</span>
                  )}
                </div>
              )}
            </div>

            {/* Mapbox Render Section */}
            <div>
              <SectionHeader 
                id="mapbox" 
                title="Mapbox Render" 
                icon={<Compass size={14} className="text-purple-400" />}
                status={mapboxStatus}
              />
              {expandedSection === 'mapbox' && (
                <div className="mt-2 p-2 bg-black/30 rounded space-y-1 text-[11px]">
                  {diagnostics.mapboxRender ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Style Loaded:</span>
                        <span className={diagnostics.mapboxRender.styleLoaded ? 'text-green-400' : 'text-red-400'}>
                          {diagnostics.mapboxRender.styleLoaded ? '✓' : '✗'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Map Loaded:</span>
                        <span className={diagnostics.mapboxRender.mapLoaded ? 'text-green-400' : 'text-red-400'}>
                          {diagnostics.mapboxRender.mapLoaded ? '✓' : '✗'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Route Source:</span>
                        <span className={diagnostics.mapboxRender.routeSourceExists ? 'text-green-400' : 'text-red-400'}>
                          {diagnostics.mapboxRender.routeSourceExists ? '✓' : '✗'} {diagnostics.mapboxRender.routeSourceId}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Route Layer:</span>
                        <span className={diagnostics.mapboxRender.routeLayerExists ? 'text-green-400' : 'text-red-400'}>
                          {diagnostics.mapboxRender.routeLayerExists ? '✓' : '✗'} {diagnostics.mapboxRender.routeLayerId}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Features:</span>
                        <span>{diagnostics.mapboxRender.featureCount || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Points:</span>
                        <span>{diagnostics.mapboxRender.pointCount || 0}</span>
                      </div>
                      {diagnostics.mapboxRender.error && (
                        <div className="p-1 bg-red-900/50 rounded text-red-300">
                          ❌ {diagnostics.mapboxRender.error}
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-gray-500">No render data</span>
                  )}
                </div>
              )}
            </div>

            {/* GPS Section */}
            <div>
              <SectionHeader 
                id="gps" 
                title="GPS" 
                icon={diagnostics.gps?.isStale ? <WifiOff size={14} className="text-yellow-400" /> : <Wifi size={14} className="text-green-400" />}
                status={gpsStatus}
              />
              {expandedSection === 'gps' && (
                <div className="mt-2 p-2 bg-black/30 rounded space-y-1 text-[11px]">
                  {diagnostics.gps ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Update Rate:</span>
                        <span className={diagnostics.gps.updateRateHz > 0 ? 'text-green-400' : 'text-yellow-400'}>
                          {diagnostics.gps.updateRateHz} Hz
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Position:</span>
                        <span className="text-cyan-300">
                          {diagnostics.gps.lastLat.toFixed(5)}, {diagnostics.gps.lastLng.toFixed(5)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Speed:</span>
                        <span>{(diagnostics.gps.speed * 3.6).toFixed(1)} km/h</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Heading:</span>
                        <span>{diagnostics.gps.heading.toFixed(0)}°</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Accuracy:</span>
                        <span className={diagnostics.gps.accuracy > 50 ? 'text-yellow-400' : 'text-green-400'}>
                          {diagnostics.gps.accuracy.toFixed(1)}m
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Last Update:</span>
                        <span className={diagnostics.gps.isStale ? 'text-yellow-400' : 'text-gray-300'}>
                          {diagnostics.gps.timeSinceLastUpdateMs}ms ago
                          {diagnostics.gps.isStale && ' ⚠️ STALE'}
                        </span>
                      </div>
                    </>
                  ) : (
                    <span className="text-gray-500">No GPS data</span>
                  )}
                </div>
              )}
            </div>

            {/* Errors Section */}
            <div>
              <SectionHeader 
                id="errors" 
                title="Errors" 
                icon={<AlertTriangle size={14} className="text-red-400" />}
                status={
                  (diagnostics.errorCounters.auth401 + diagnostics.errorCounters.auth403 + 
                   diagnostics.errorCounters.rateLimit429 + diagnostics.errorCounters.server5xx) > 0 
                    ? 'error' : 'ok'
                }
              />
              {expandedSection === 'errors' && (
                <div className="mt-2 p-2 bg-black/30 rounded grid grid-cols-2 gap-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-gray-400">401:</span>
                    <span className={diagnostics.errorCounters.auth401 > 0 ? 'text-red-400' : 'text-gray-500'}>
                      {diagnostics.errorCounters.auth401}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">403:</span>
                    <span className={diagnostics.errorCounters.auth403 > 0 ? 'text-red-400' : 'text-gray-500'}>
                      {diagnostics.errorCounters.auth403}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">429:</span>
                    <span className={diagnostics.errorCounters.rateLimit429 > 0 ? 'text-yellow-400' : 'text-gray-500'}>
                      {diagnostics.errorCounters.rateLimit429}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">5xx:</span>
                    <span className={diagnostics.errorCounters.server5xx > 0 ? 'text-red-400' : 'text-gray-500'}>
                      {diagnostics.errorCounters.server5xx}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Parse:</span>
                    <span className={diagnostics.errorCounters.parseErrors > 0 ? 'text-red-400' : 'text-gray-500'}>
                      {diagnostics.errorCounters.parseErrors}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Polyline:</span>
                    <span className={diagnostics.errorCounters.polylineDecodeErrors > 0 ? 'text-red-400' : 'text-gray-500'}>
                      {diagnostics.errorCounters.polylineDecodeErrors}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Coord Swap:</span>
                    <span className={diagnostics.errorCounters.coordSwapErrors > 0 ? 'text-orange-400' : 'text-gray-500'}>
                      {diagnostics.errorCounters.coordSwapErrors}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Timeouts:</span>
                    <span className={diagnostics.errorCounters.timeouts > 0 ? 'text-yellow-400' : 'text-gray-500'}>
                      {diagnostics.errorCounters.timeouts}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Checklist Section */}
            <div>
              <SectionHeader 
                id="checklist" 
                title="Checklist Pass/Fail" 
                icon={diagnostics.checklist?.overallStatus === 'pass' 
                  ? <CheckCircle size={14} className="text-green-400" />
                  : <XCircle size={14} className="text-red-400" />
                }
                status={diagnostics.checklist?.overallStatus === 'pass' ? 'ok' : 
                        diagnostics.checklist?.overallStatus === 'fail' ? 'error' : 'pending'}
              />
              {expandedSection === 'checklist' && (
                <div className="mt-2 p-2 bg-black/30 rounded space-y-1 text-[11px]">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="w-full h-6 text-[10px] mb-2"
                    onClick={handleRefreshChecklist}
                  >
                    <RefreshCw size={10} className="mr-1" /> Refresh Checklist
                  </Button>
                  {diagnostics.checklist ? (
                    <>
                      <div className="flex justify-between mb-2 pb-1 border-b border-white/10">
                        <span className="text-gray-400">Status:</span>
                        <span className={
                          diagnostics.checklist.overallStatus === 'pass' ? 'text-green-400' :
                          diagnostics.checklist.overallStatus === 'fail' ? 'text-red-400' : 'text-yellow-400'
                        }>
                          {diagnostics.checklist.passedCount}/{diagnostics.checklist.checks.length} passed
                        </span>
                      </div>
                      {diagnostics.checklist.checks.map(check => (
                        <div key={check.id} className="flex items-start gap-1 py-0.5">
                          <span className={
                            check.status === 'pass' ? 'text-green-400' :
                            check.status === 'fail' ? 'text-red-400' :
                            check.status === 'warning' ? 'text-yellow-400' : 'text-gray-400'
                          }>
                            {check.status === 'pass' ? '✓' : 
                             check.status === 'fail' ? '✗' : 
                             check.status === 'warning' ? '⚠' : '○'}
                          </span>
                          <div className="flex-1">
                            <span className="text-gray-200">{check.name}</span>
                            {check.details && (
                              <div className="text-gray-500 text-[10px]">{check.details}</div>
                            )}
                            {check.recommendation && (
                              <div className="text-orange-400 text-[10px]">→ {check.recommendation}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <span className="text-gray-500">Click refresh to generate</span>
                  )}
                </div>
              )}
            </div>

            {/* Event Log Section */}
            <div>
              <SectionHeader 
                id="events" 
                title={`Event Log (${diagnostics.eventLog.length})`}
                icon={<Clock size={14} className="text-gray-400" />}
              />
              {expandedSection === 'events' && (
                <div className="mt-2 p-2 bg-black/30 rounded max-h-40 overflow-y-auto">
                  {diagnostics.eventLog.length > 0 ? (
                    diagnostics.eventLog.slice().reverse().map((event, i) => (
                      <div 
                        key={event.id} 
                        className={`text-[10px] py-0.5 border-b border-white/5 ${
                          event.severity === 'error' ? 'text-red-300' :
                          event.severity === 'warning' ? 'text-yellow-300' : 'text-gray-300'
                        }`}
                      >
                        <span className="text-gray-500">{formatTime(event.timestamp)}</span>
                        {' '}
                        <span className="text-blue-300">[{event.category}]</span>
                        {' '}
                        {event.message}
                      </div>
                    ))
                  ) : (
                    <span className="text-gray-500 text-[11px]">No events</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-1.5 border-t border-white/10 bg-black/30 text-[9px] text-gray-500 text-center">
          Session: {Math.floor((Date.now() - diagnostics.sessionStartTime) / 1000)}s • 
          Set DEBUG_NAV.enabled=false to disable
        </div>
      </div>
    </div>
  );
};

export default NavigationDiagnosticsOverlay;
