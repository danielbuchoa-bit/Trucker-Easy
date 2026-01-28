import React from 'react';

// === ENHANCED: Debug info with snap-to-road distance ===
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
  
  // === NEW: Snap-to-road distance metrics ===
  distanceToRouteM: number | null; // Distance from raw GPS to route in meters
  snapOffsetM: number | null; // Distance from raw GPS to snapped position
  nearestSegmentIndex: number | null; // Index of nearest route segment
  
  // HERE Map Matching (legacy name kept for compatibility)
  hereMatchUsed: boolean;
  hereMatchConfidence: number;
  hereCacheSize?: number;
  hereBufferSize?: number;
  
  // Render cursor
  renderLat: number | null;
  renderLng: number | null;
  renderHeading: number;
  isAnimating: boolean;
  isDeadReckoning: boolean;
  frameCount: number;
  
  // Spike detection info
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
  const timeSinceGps = debug.lastGpsUpdate > 0 
    ? ((Date.now() - debug.lastGpsUpdate) / 1000).toFixed(1) + 's ago'
    : '—';

  // Calculate snap offset if we have both raw and snapped positions
  const snapOffset = debug.rawLat && debug.snappedLat && debug.rawLng && debug.snappedLng
    ? calculateDistanceM(debug.rawLat, debug.rawLng, debug.snappedLat, debug.snappedLng)
    : debug.snapOffsetM;

  // Get color based on distance to route
  const getDistanceColor = (distance: number | null) => {
    if (distance === null) return 'text-gray-400';
    if (distance <= 5) return 'text-green-400';
    if (distance <= 15) return 'text-yellow-400';
    if (distance <= 30) return 'text-orange-400';
    return 'text-red-400';
  };

  return (
    <div className="absolute top-36 left-2 right-2 z-30 bg-black/90 text-white text-xs p-3 rounded-lg font-mono space-y-2 max-h-[50vh] overflow-y-auto">
      <div className="font-bold text-cyan-400 mb-2">🔧 SNAP-TO-ROAD DEBUG v3</div>
      
      {/* === NEW: Snap-to-Road Distance Section === */}
      <div className="bg-blue-900/50 border border-blue-500 rounded p-2 mb-2">
        <div className="text-blue-400 font-semibold mb-1">📍 SNAP-TO-ROAD DISTANCE</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <span className="text-gray-400">Distance to Route:</span>
          <span className={`font-bold ${getDistanceColor(debug.distanceToRouteM)}`}>
            {debug.distanceToRouteM !== null ? `${debug.distanceToRouteM.toFixed(1)}m` : '—'}
          </span>
          
          <span className="text-gray-400">Snap Offset:</span>
          <span className={`${getDistanceColor(snapOffset ?? null)}`}>
            {snapOffset !== null ? `${snapOffset.toFixed(1)}m` : '—'}
          </span>
          
          <span className="text-gray-400">Nearest Segment:</span>
          <span className="text-gray-300">
            {debug.nearestSegmentIndex !== null ? `#${debug.nearestSegmentIndex}` : '—'}
          </span>
          
          <span className="text-gray-400">On Route:</span>
          <span className={debug.isOnRoute ? 'text-green-400 font-bold' : 'text-red-400'}>
            {debug.isOnRoute ? '✓ YES' : '✗ NO'}
          </span>
        </div>
        
        {/* Visual distance bar */}
        <div className="mt-2">
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-[10px]">0m</span>
            <div className="flex-1 h-2 bg-gray-700 rounded overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ${
                  debug.distanceToRouteM !== null && debug.distanceToRouteM <= 5 ? 'bg-green-500' :
                  debug.distanceToRouteM !== null && debug.distanceToRouteM <= 15 ? 'bg-yellow-500' :
                  debug.distanceToRouteM !== null && debug.distanceToRouteM <= 30 ? 'bg-orange-500' :
                  'bg-red-500'
                }`}
                style={{ 
                  width: debug.distanceToRouteM !== null 
                    ? `${Math.min(100, (debug.distanceToRouteM / 50) * 100)}%` 
                    : '0%' 
                }}
              />
            </div>
            <span className="text-gray-500 text-[10px]">50m</span>
          </div>
          <div className="text-center text-[10px] text-gray-500 mt-1">
            🟢 ≤5m | 🟡 ≤15m | 🟠 ≤30m | 🔴 &gt;30m
          </div>
        </div>
      </div>
      
      {/* Spike Rejection Warning */}
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
        <div className="text-gray-400 font-semibold mb-1">🎯 SNAPPED POSITION</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
          <span className="text-gray-500">Snapped:</span>
          <span className="text-blue-400">
            {debug.snappedLat?.toFixed(5) ?? '—'}, {debug.snappedLng?.toFixed(5) ?? '—'}
          </span>
          
          <span className="text-gray-500">Confidence:</span>
          <span className={debug.matchConfidence > 0.7 ? 'text-green-400' : debug.matchConfidence > 0.4 ? 'text-yellow-400' : 'text-red-400'}>
            {(debug.matchConfidence * 100).toFixed(0)}%
          </span>
          
          <span className="text-gray-500">Match Engine:</span>
          <span className={debug.hereMatchUsed ? 'text-cyan-400' : 'text-gray-400'}>
            {debug.hereMatchUsed ? `API ${(debug.hereMatchConfidence * 100).toFixed(0)}%` : 'Local HMM'}
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

// Helper: Calculate distance between two points in meters
function calculateDistanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) ** 2 + 
            Math.cos(lat1 * Math.PI / 180) * 
            Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLng/2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Export the debug info type for use in ActiveNavigationView
export type { CursorDebugInfo };
