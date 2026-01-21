import React from 'react';
import { useRoadTestSafe } from '@/contexts/RoadTestContext';
import { X, Wifi, MapPin, Gauge, Compass, Clock, Activity, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

const RoadTestDiagnosticsPanel: React.FC = () => {
  const roadTest = useRoadTestSafe();
  
  if (!roadTest || !roadTest.isRoadTestMode || !roadTest.showDiagnosticsPanel) {
    return null;
  }

  const { diagnostics, setShowDiagnosticsPanel } = roadTest;
  const { gps, mapMatching, routeProvider, renderProvider, lastApiError, isNavigating, cursorOnRoad, rerouteCount, voiceEnabled } = diagnostics;

  const timeSinceUpdate = gps?.timestamp ? Math.round((Date.now() - gps.timestamp) / 1000) : null;

  return (
    <div className="absolute top-16 left-2 right-2 z-50 pointer-events-auto">
      <div className="bg-black/90 backdrop-blur-md rounded-lg border border-cyan-500/30 text-white text-xs overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-cyan-600/50 to-blue-600/50 border-b border-cyan-500/30">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span className="font-bold text-cyan-400">ROAD TEST MODE</span>
          </div>
          <button 
            onClick={() => setShowDiagnosticsPanel(false)}
            className="p-1 hover:bg-white/10 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Grid */}
        <div className="p-2 grid grid-cols-2 gap-2">
          {/* GPS Section */}
          <div className="bg-white/5 rounded p-2 space-y-1">
            <div className="flex items-center gap-1 text-cyan-400 font-semibold mb-1">
              <MapPin className="w-3 h-3" />
              <span>GPS</span>
              <span className={cn(
                "ml-auto px-1.5 py-0.5 rounded text-[10px] font-bold",
                gps?.source === 'real' ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"
              )}>
                {gps?.source?.toUpperCase() || 'N/A'}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]">
              <span className="text-gray-400">Lat:</span>
              <span className="font-mono">{gps?.lat?.toFixed(6) || '—'}</span>
              
              <span className="text-gray-400">Lng:</span>
              <span className="font-mono">{gps?.lng?.toFixed(6) || '—'}</span>
              
              <span className="text-gray-400">Accuracy:</span>
              <span className={cn("font-mono", (gps?.accuracy ?? 100) < 15 ? "text-green-400" : "text-yellow-400")}>
                {gps?.accuracy?.toFixed(1) || '—'} m
              </span>
              
              <span className="text-gray-400">Speed:</span>
              <span className="font-mono">{gps?.speed != null ? `${(gps.speed * 2.237).toFixed(0)} mph` : '—'}</span>
              
              <span className="text-gray-400">Heading:</span>
              <span className="font-mono">{gps?.heading?.toFixed(0) || '—'}°</span>
              
              <span className="text-gray-400">Updates/s:</span>
              <span className="font-mono">{gps?.updatesPerSecond?.toFixed(1) || '0'}</span>
              
              <span className="text-gray-400">Last Update:</span>
              <span className={cn("font-mono", timeSinceUpdate !== null && timeSinceUpdate > 3 ? "text-red-400" : "text-green-400")}>
                {timeSinceUpdate !== null ? `${timeSinceUpdate}s ago` : '—'}
              </span>
              
              <span className="text-gray-400">State:</span>
              <span className={cn("font-mono", gps?.appState === 'foreground' ? "text-green-400" : "text-yellow-400")}>
                {gps?.appState?.toUpperCase() || '—'}
              </span>
            </div>
          </div>

          {/* Navigation Status */}
          <div className="bg-white/5 rounded p-2 space-y-1">
            <div className="flex items-center gap-1 text-cyan-400 font-semibold mb-1">
              <Compass className="w-3 h-3" />
              <span>Navigation</span>
            </div>
            
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]">
              <span className="text-gray-400">Status:</span>
              <span className={cn("font-bold", isNavigating ? "text-green-400" : "text-gray-400")}>
                {isNavigating ? 'NAVEGANDO' : 'PARADO'}
              </span>
              
              <span className="text-gray-400">On Road:</span>
              <span className="flex items-center gap-1">
                {cursorOnRoad ? (
                  <CheckCircle className="w-3 h-3 text-green-400" />
                ) : (
                  <XCircle className="w-3 h-3 text-red-400" />
                )}
              </span>
              
              <span className="text-gray-400">Reroutes:</span>
              <span className="font-mono">{rerouteCount}</span>
              
              <span className="text-gray-400">Voice:</span>
              <span className={cn("font-bold", voiceEnabled ? "text-green-400" : "text-red-400")}>
                {voiceEnabled ? 'ON' : 'OFF'}
              </span>
              
              <span className="text-gray-400">Route:</span>
              <span className="font-mono text-blue-400">{routeProvider}</span>
              
              <span className="text-gray-400">Render:</span>
              <span className="font-mono text-purple-400">{renderProvider}</span>
              
              <span className="text-gray-400">Map Match:</span>
              <span className={cn("font-bold", mapMatching.enabled ? "text-green-400" : "text-red-400")}>
                {mapMatching.enabled ? 'ON' : 'OFF'}
              </span>
              
              <span className="text-gray-400">Confidence:</span>
              <span className="font-mono">{(mapMatching.confidence * 100).toFixed(0)}%</span>
            </div>
          </div>
        </div>

        {/* Last API Error */}
        {lastApiError && (
          <div className="mx-2 mb-2 p-2 bg-red-500/20 border border-red-500/30 rounded">
            <div className="flex items-center gap-1 text-red-400 font-semibold text-[10px] mb-1">
              <AlertTriangle className="w-3 h-3" />
              <span>LAST API ERROR</span>
            </div>
            <div className="text-[10px] text-red-300">
              <span className="font-mono">{lastApiError.endpoint}</span> — 
              <span className="font-bold"> {lastApiError.status}</span>
              {lastApiError.errorMessage && (
                <span className="text-red-400"> — {lastApiError.errorMessage}</span>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-3 py-1.5 bg-white/5 border-t border-cyan-500/20 flex items-center justify-between text-[10px] text-gray-400">
          <span>HERE → Mapbox Integration</span>
          <span className="font-mono">{new Date().toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
};

export default RoadTestDiagnosticsPanel;
