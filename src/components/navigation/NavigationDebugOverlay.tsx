/**
 * Navigation Debug Overlay
 * 
 * Real-time display of:
 * - Raw lat/lng, snapped lat/lng
 * - Accuracy, speed, bearing_raw, bearing_used
 * - offRoute (true/false)
 * - stepIndex, distanceToNextManeuver
 * - Timestamp of last update
 */

import React, { useState, useEffect } from 'react';
import { X, Bug, MapPin, Navigation, Gauge, Route, Clock, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface NavigationDebugData {
  // Raw GPS
  rawLat: number;
  rawLng: number;
  
  // Snapped position
  snappedLat: number;
  snappedLng: number;
  
  // GPS quality
  accuracy: number | null;
  speed: number | null; // m/s
  
  // Heading
  bearingRaw: number | null;
  bearingUsed: number;
  headingSource: 'gps' | 'cog' | 'route' | 'blend';
  
  // Route matching
  offRoute: boolean;
  distanceToRoute: number;
  snapStrength: number;
  matchConfidence: number;
  
  // Navigation progress
  stepIndex: number;
  distanceToNextManeuver: number;
  currentInstruction: string;
  
  // Timing
  timestamp: number;
  updateRate: number; // updates per second
}

interface NavigationDebugOverlayProps {
  data: NavigationDebugData | null;
  visible: boolean;
  onClose: () => void;
}

const NavigationDebugOverlay: React.FC<NavigationDebugOverlayProps> = ({
  data,
  visible,
  onClose,
}) => {
  const [logs, setLogs] = useState<string[]>([]);
  
  // Log data every second
  useEffect(() => {
    if (!data || !visible) return;
    
    const interval = setInterval(() => {
      const logEntry = [
        `[${new Date().toISOString().slice(11, 19)}]`,
        `raw:(${data.rawLat.toFixed(5)},${data.rawLng.toFixed(5)})`,
        `snap:(${data.snappedLat.toFixed(5)},${data.snappedLng.toFixed(5)})`,
        `acc:${data.accuracy?.toFixed(0) ?? '?'}m`,
        `spd:${data.speed?.toFixed(1) ?? '?'}m/s`,
        `brg:${data.bearingUsed.toFixed(0)}°`,
        `offRt:${data.offRoute}`,
        `dist:${data.distanceToRoute.toFixed(1)}m`,
        `step:${data.stepIndex}`,
      ].join(' ');
      
      console.log('[NAV_DEBUG]', logEntry);
      
      setLogs(prev => [...prev.slice(-20), logEntry]);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [data, visible]);

  if (!visible || !data) return null;

  const formatCoord = (val: number) => val.toFixed(6);
  const formatMeters = (val: number) => `${val.toFixed(1)}m`;
  const formatSpeed = (val: number | null) => val !== null ? `${(val * 2.237).toFixed(1)} mph` : '--';
  const formatBearing = (val: number) => `${val.toFixed(0)}°`;

  return (
    <div className="fixed top-16 left-2 right-2 z-[1000] max-w-md">
      <div className="bg-black/90 backdrop-blur-sm rounded-lg border border-cyan-500/30 text-white text-xs font-mono overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-cyan-900/50 border-b border-cyan-500/30">
          <div className="flex items-center gap-2">
            <Bug size={14} className="text-cyan-400" />
            <span className="font-semibold text-cyan-300">NAV DEBUG</span>
            <span className={cn(
              "px-1.5 py-0.5 rounded text-[10px] font-bold",
              data.offRoute ? "bg-red-500/30 text-red-300" : "bg-green-500/30 text-green-300"
            )}>
              {data.offRoute ? 'OFF ROUTE' : 'ON ROUTE'}
            </span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded">
            <X size={14} />
          </button>
        </div>

        {/* Data Grid */}
        <div className="p-2 space-y-2">
          {/* Position */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/5 rounded p-1.5">
              <div className="flex items-center gap-1 text-yellow-400 mb-1">
                <MapPin size={10} />
                <span>RAW GPS</span>
              </div>
              <div className="text-[10px]">
                {formatCoord(data.rawLat)}, {formatCoord(data.rawLng)}
              </div>
            </div>
            <div className="bg-white/5 rounded p-1.5">
              <div className="flex items-center gap-1 text-green-400 mb-1">
                <MapPin size={10} />
                <span>SNAPPED</span>
              </div>
              <div className="text-[10px]">
                {formatCoord(data.snappedLat)}, {formatCoord(data.snappedLng)}
              </div>
            </div>
          </div>

          {/* Speed & Heading */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/5 rounded p-1.5 text-center">
              <div className="text-gray-400 text-[10px]">SPEED</div>
              <div className="text-cyan-300">{formatSpeed(data.speed)}</div>
            </div>
            <div className="bg-white/5 rounded p-1.5 text-center">
              <div className="text-gray-400 text-[10px]">BEARING</div>
              <div className="text-cyan-300">{formatBearing(data.bearingUsed)}</div>
            </div>
            <div className="bg-white/5 rounded p-1.5 text-center">
              <div className="text-gray-400 text-[10px]">ACCURACY</div>
              <div className="text-cyan-300">{data.accuracy?.toFixed(0) ?? '--'}m</div>
            </div>
          </div>

          {/* Route Matching */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/5 rounded p-1.5 text-center">
              <div className="text-gray-400 text-[10px]">DIST TO RT</div>
              <div className={cn(
                data.distanceToRoute > 15 ? "text-red-400" : "text-green-400"
              )}>
                {formatMeters(data.distanceToRoute)}
              </div>
            </div>
            <div className="bg-white/5 rounded p-1.5 text-center">
              <div className="text-gray-400 text-[10px]">SNAP STR</div>
              <div className="text-cyan-300">{(data.snapStrength * 100).toFixed(0)}%</div>
            </div>
            <div className="bg-white/5 rounded p-1.5 text-center">
              <div className="text-gray-400 text-[10px]">CONFIDENCE</div>
              <div className="text-cyan-300">{(data.matchConfidence * 100).toFixed(0)}%</div>
            </div>
          </div>

          {/* Navigation Progress */}
          <div className="bg-white/5 rounded p-1.5">
            <div className="flex items-center gap-1 text-purple-400 mb-1">
              <Route size={10} />
              <span>STEP {data.stepIndex}</span>
              <span className="text-gray-400">•</span>
              <span className="text-gray-300">{formatMeters(data.distanceToNextManeuver)} to next</span>
            </div>
            <div className="text-[10px] text-gray-300 truncate">
              {data.currentInstruction || 'No instruction'}
            </div>
          </div>

          {/* Timing */}
          <div className="flex items-center justify-between text-[10px] text-gray-500 px-1">
            <div className="flex items-center gap-1">
              <Clock size={10} />
              <span>Last: {new Date(data.timestamp).toISOString().slice(11, 19)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Zap size={10} />
              <span>{data.updateRate.toFixed(1)} Hz</span>
            </div>
          </div>
        </div>

        {/* Console Logs */}
        <div className="border-t border-cyan-500/20 max-h-24 overflow-y-auto">
          <div className="p-1.5 space-y-0.5">
            {logs.slice(-5).map((log, i) => (
              <div key={i} className="text-[9px] text-gray-400 font-mono">
                {log}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NavigationDebugOverlay;
