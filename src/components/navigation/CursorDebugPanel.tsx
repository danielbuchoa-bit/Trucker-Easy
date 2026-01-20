import React from 'react';

// === [A][D][E] UPDATED: Enhanced debug info for all fixes ===
interface CursorDebugInfo {
  // Raw GPS
  rawLat: number | null;
  rawLng: number | null;
  rawHeading: number | null;
  rawSpeed: number | null;
  rawAccuracy: number | null;
  
  // Matched/Snapped position
  snappedLat: number | null;
  snappedLng: number | null;
  matchConfidence: number;
  isOnRoute: boolean;
  
  // Render cursor
  renderLat: number | null;
  renderLng: number | null;
  renderHeading: number;
  isAnimating: boolean;
  isDeadReckoning: boolean;
  frameCount: number;
  
  // [A] FIX: Enhanced spike detection info
  lastSpikeRejected: { distance: number; speed: string; reason?: string } | null;
  spikeRejectCount: number;
  consecutiveRejects?: number;
  
  // Timestamps
  lastGpsUpdate: number;
  lastRenderUpdate: number;
}

interface CursorDebugPanelProps {
  debug: CursorDebugInfo;
  visible: boolean;
}

export default function CursorDebugPanel({ debug, visible }: CursorDebugPanelProps) {
  if (!visible) return null;

  const speedMph = debug.rawSpeed !== null ? (debug.rawSpeed * 2.237).toFixed(1) : '—';
  const speedKmh = debug.rawSpeed !== null ? (debug.rawSpeed * 3.6).toFixed(1) : '—';
  const timeSinceGps = debug.lastGpsUpdate > 0 
    ? ((Date.now() - debug.lastGpsUpdate) / 1000).toFixed(1) + 's ago'
    : '—';

  // Calculate stats
  const positionDelta = debug.rawLat && debug.snappedLat
    ? Math.abs(debug.rawLat - debug.snappedLat) * 111000 // rough meters
    : 0;

  return (
    <div className="absolute top-36 left-2 right-2 z-30 bg-black/90 text-white text-xs p-3 rounded-lg font-mono space-y-2 max-h-[50vh] overflow-y-auto">
      <div className="font-bold text-cyan-400 mb-2">🔧 CURSOR & ROUTE DEBUG v2</div>
      
      {/* [A] FIX: Enhanced Spike Rejection Warning */}
      {debug.spikeRejectCount > 0 && (
        <div className="bg-red-900/50 border border-red-500 rounded p-2 mb-2">
          <div className="text-red-400 font-bold">
            ⚠️ SPIKES: {debug.spikeRejectCount} total 
            {debug.consecutiveRejects !== undefined && debug.consecutiveRejects > 0 && (
              <span className="text-yellow-400 ml-2">({debug.consecutiveRejects} consecutive)</span>
            )}
          </div>
          {debug.lastSpikeRejected && (
            <div className="text-red-300 text-xs">
              Last: {debug.lastSpikeRejected.distance}m @ {debug.lastSpikeRejected.speed}
              {debug.lastSpikeRejected.reason && (
                <span className="text-gray-400 block">Reason: {debug.lastSpikeRejected.reason}</span>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Raw GPS Section */}
      <div className="border-b border-gray-600 pb-2">
        <div className="text-gray-400 font-semibold mb-1">📍 RAW GPS</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
          <span className="text-gray-500">Position:</span>
          <span className="text-green-400">
            {debug.rawLat?.toFixed(5) ?? '—'}, {debug.rawLng?.toFixed(5) ?? '—'}
          </span>
          
          <span className="text-gray-500">Speed:</span>
          <span>{speedMph} mph ({debug.rawSpeed?.toFixed(1) ?? '—'} m/s)</span>
          
          <span className="text-gray-500">Heading:</span>
          <span>{debug.rawHeading?.toFixed(0) ?? '—'}°</span>
          
          <span className="text-gray-500">Accuracy:</span>
          <span className={debug.rawAccuracy && debug.rawAccuracy > 20 ? 'text-yellow-400' : ''}>
            {debug.rawAccuracy?.toFixed(0) ?? '—'}m
          </span>
          
          <span className="text-gray-500">Last Update:</span>
          <span className={debug.lastGpsUpdate > 0 && (Date.now() - debug.lastGpsUpdate) > 3000 ? 'text-red-400' : ''}>
            {timeSinceGps}
          </span>
        </div>
      </div>
      
      {/* Matched Position Section */}
      <div className="border-b border-gray-600 pb-2">
        <div className="text-gray-400 font-semibold mb-1">🎯 MATCHED POSITION</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
          <span className="text-gray-500">Snapped:</span>
          <span className="text-blue-400">
            {debug.snappedLat?.toFixed(5) ?? '—'}, {debug.snappedLng?.toFixed(5) ?? '—'}
          </span>
          
          <span className="text-gray-500">On Route:</span>
          <span className={debug.isOnRoute ? 'text-green-400' : 'text-red-400'}>
            {debug.isOnRoute ? 'YES' : 'NO'}
          </span>
          
          <span className="text-gray-500">Confidence:</span>
          <span className={debug.matchConfidence > 0.7 ? 'text-green-400' : debug.matchConfidence > 0.4 ? 'text-yellow-400' : 'text-red-400'}>
            {(debug.matchConfidence * 100).toFixed(0)}%
          </span>
        </div>
      </div>
      
      {/* Render Cursor Section */}
      <div>
        <div className="text-gray-400 font-semibold mb-1">🎮 RENDER CURSOR</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
          <span className="text-gray-500">Position:</span>
          <span className="text-purple-400">
            {debug.renderLat?.toFixed(5) ?? '—'}, {debug.renderLng?.toFixed(5) ?? '—'}
          </span>
          
          <span className="text-gray-500">Heading:</span>
          <span>{debug.renderHeading?.toFixed(0) ?? '—'}°</span>
          
          <span className="text-gray-500">Animating:</span>
          <span className={debug.isAnimating ? 'text-green-400' : 'text-gray-500'}>
            {debug.isAnimating ? 'YES' : 'NO'}
          </span>
          
          <span className="text-gray-500">Dead Reckoning:</span>
          <span className={debug.isDeadReckoning ? 'text-yellow-400' : 'text-gray-500'}>
            {debug.isDeadReckoning ? 'YES' : 'NO'}
          </span>
          
          <span className="text-gray-500">Frame:</span>
          <span>#{debug.frameCount}</span>
        </div>
      </div>
    </div>
  );
}

// Export the debug info type for use in ActiveNavigationView
export type { CursorDebugInfo };
