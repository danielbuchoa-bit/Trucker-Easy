import React from 'react';
import type { ArrivalDebug } from '@/hooks/useArrivalDetection';

interface ArrivalDebugPanelProps {
  debug: ArrivalDebug;
  visible: boolean;
}

export default function ArrivalDebugPanel({ debug, visible }: ArrivalDebugPanelProps) {
  if (!visible) return null;

  const speedMph = (debug.speed * 2.237).toFixed(1);

  return (
    <div className="absolute top-36 left-2 right-2 z-30 bg-black/80 text-white text-xs p-3 rounded-lg font-mono space-y-1">
      <div className="font-bold text-amber-400 mb-2">ARRIVAL DETECTION DEBUG</div>
      
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <span className="text-gray-400">Nearest POI:</span>
        <span className="truncate">{debug.nearestPoi || '—'}</span>
        
        <span className="text-gray-400">Distance:</span>
        <span>{debug.distanceToPoi ? `${debug.distanceToPoi}m` : '—'}</span>
        
        <span className="text-gray-400">Speed:</span>
        <span>{speedMph} mph ({debug.speed.toFixed(1)} m/s)</span>
        
        <span className="text-gray-400">GPS Accuracy:</span>
        <span>{debug.accuracy ? `${Math.round(debug.accuracy)}m` : '—'}</span>
        
        <span className="text-gray-400">Dwell Time:</span>
        <span>{debug.dwellTime}s</span>
        
        <span className="text-gray-400">Cooldown:</span>
        <span>{debug.cooldownRemaining > 0 ? `${debug.cooldownRemaining}s` : 'None'}</span>
        
        <span className="text-gray-400">Triggered:</span>
        <span className={debug.arrivalTriggered ? 'text-green-400' : 'text-gray-500'}>
          {debug.arrivalTriggered ? 'YES' : 'NO'}
        </span>
      </div>
      
      <div className="pt-2 border-t border-gray-600 mt-2">
        <span className="text-gray-400">Reason: </span>
        <span className={debug.arrivalTriggered ? 'text-green-400' : 'text-amber-300'}>
          {debug.reason}
        </span>
      </div>
    </div>
  );
}
