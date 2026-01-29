/**
 * Native Navigation Debug Panel
 * 
 * Real-time diagnostic overlay showing:
 * - GPS update metrics
 * - Raw vs snapped position
 * - Speed (raw and smoothed)
 * - Heading/course
 * - Route distance and snap offset
 * - Reroute counter
 * - Error codes
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X, ChevronDown, ChevronUp, Navigation, Gauge, Compass, Route, AlertTriangle, RefreshCw } from 'lucide-react';
import { TruckerNavigation, TruckerLocationUpdate, isNativeNavigationAvailable } from '@/plugins/TruckerNavigationPlugin';
import { NavigationDiagnostics, createEmptyDiagnostics, getActiveConfig } from '@/lib/navigation/nativeNavigationConfig';

interface NativeNavigationDebugPanelProps {
  isVisible: boolean;
  onClose: () => void;
}

const NativeNavigationDebugPanel: React.FC<NativeNavigationDebugPanelProps> = ({
  isVisible,
  onClose,
}) => {
  const [diagnostics, setDiagnostics] = useState<NavigationDiagnostics>(createEmptyDiagnostics());
  const [isExpanded, setIsExpanded] = useState(true);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [rerouteCount, setRerouteCount] = useState(0);
  const [lastUpdateTime, setLastUpdateTime] = useState(0);
  const [isNative, setIsNative] = useState(false);
  
  // Calculate accuracy color
  const getAccuracyColor = (offset: number): string => {
    if (offset <= 5) return 'bg-green-500';
    if (offset <= 10) return 'bg-lime-500';
    if (offset <= 15) return 'bg-yellow-500';
    if (offset <= 25) return 'bg-orange-500';
    return 'bg-red-500';
  };
  
  const getAccuracyLabel = (offset: number): string => {
    if (offset <= 5) return 'Excellent';
    if (offset <= 10) return 'Good';
    if (offset <= 15) return 'Fair';
    if (offset <= 25) return 'Poor';
    return 'Off-Route';
  };

  useEffect(() => {
    if (!isVisible) return;
    
    setIsNative(isNativeNavigationAvailable());
    
    // Listen for location updates
    const locationListener = TruckerNavigation.addListener(
      'nativeLocationUpdate',
      (update: TruckerLocationUpdate) => {
        const now = Date.now();
        
        setDiagnostics(prev => ({
          ...prev,
          lastGpsUpdate: update.timestamp,
          rawLatLng: { lat: update.rawLatitude, lng: update.rawLongitude },
          snappedLatLng: update.snappedLatitude && update.snappedLongitude
            ? { lat: update.snappedLatitude, lng: update.snappedLongitude }
            : null,
          snapOffsetM: update.snapOffsetMeters ?? 0,
          speedRaw: update.rawSpeed,
          speedSmoothed: update.speed,
          headingCourse: update.heading,
          distanceToRouteM: update.distanceToRouteMeters ?? 0,
          updateFrequencyHz: update.updateFrequencyHz,
          isOnRoute: update.isOnRoute,
          lastError: update.rejectionReason,
        }));
        
        setLastUpdateTime(now);
      }
    );
    
    // Listen for reroute events
    const rerouteListener = TruckerNavigation.addListener(
      'nativeRerouteRequired',
      () => {
        setRerouteCount(prev => prev + 1);
      }
    );
    
    // Listen for debug logs
    const debugListener = TruckerNavigation.addListener(
      'nativeDebugLog',
      (data: { message: string }) => {
        setDebugLogs(prev => [...prev.slice(-49), data.message]);
      }
    );
    
    // Load recent logs
    TruckerNavigation.getDebugLogs({ limit: 20 }).then(result => {
      setDebugLogs(result.logs);
    });
    
    return () => {
      locationListener.then(l => l.remove());
      rerouteListener.then(l => l.remove());
      debugListener.then(l => l.remove());
    };
  }, [isVisible]);

  if (!isVisible) return null;

  const config = getActiveConfig();
  const timeSinceUpdate = Date.now() - lastUpdateTime;
  const isStale = timeSinceUpdate > 3000;

  return (
    <div className="fixed bottom-20 left-2 right-2 z-50 pointer-events-auto">
      <div className="bg-black/90 backdrop-blur-md rounded-lg border border-gray-700 text-white text-xs overflow-hidden">
        {/* Header */}
        <div 
          className="flex items-center justify-between p-2 bg-gray-800/50 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2">
            <Navigation className="w-4 h-4 text-blue-400" />
            <span className="font-semibold">Navigation Diagnostics</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] ${isNative ? 'bg-green-600' : 'bg-yellow-600'}`}>
              {isNative ? 'NATIVE iOS' : 'WEB FALLBACK'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isStale && (
              <span className="text-red-400 animate-pulse">STALE</span>
            )}
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            <button 
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="p-1 hover:bg-gray-700 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className="p-2 space-y-2">
            {/* Snap-to-Road Accuracy Bar */}
            <div className="bg-gray-800/50 rounded p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-gray-400">Snap Accuracy</span>
                <span className={`font-mono ${diagnostics.snapOffsetM > config.offRouteThresholdMeters ? 'text-red-400' : 'text-green-400'}`}>
                  {diagnostics.snapOffsetM.toFixed(1)}m
                </span>
              </div>
              <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all ${getAccuracyColor(diagnostics.snapOffsetM)}`}
                  style={{ width: `${Math.min(100, (1 - diagnostics.snapOffsetM / config.offRouteThresholdMeters) * 100)}%` }}
                />
              </div>
              <div className="text-center mt-1 text-[10px] text-gray-400">
                {getAccuracyLabel(diagnostics.snapOffsetM)} | Threshold: {config.offRouteThresholdMeters}m
              </div>
            </div>

            {/* Main Metrics Grid */}
            <div className="grid grid-cols-2 gap-2">
              {/* GPS Update */}
              <div className="bg-gray-800/50 rounded p-2">
                <div className="flex items-center gap-1 text-gray-400 mb-1">
                  <RefreshCw className="w-3 h-3" />
                  <span>GPS Update</span>
                </div>
                <div className="font-mono">
                  <div className={timeSinceUpdate > 2000 ? 'text-red-400' : 'text-green-400'}>
                    {(timeSinceUpdate / 1000).toFixed(1)}s ago
                  </div>
                  <div className="text-gray-400">{diagnostics.updateFrequencyHz.toFixed(1)} Hz</div>
                </div>
              </div>

              {/* Speed */}
              <div className="bg-gray-800/50 rounded p-2">
                <div className="flex items-center gap-1 text-gray-400 mb-1">
                  <Gauge className="w-3 h-3" />
                  <span>Speed</span>
                </div>
                <div className="font-mono">
                  <div className="text-white text-lg">{(diagnostics.speedSmoothed * 2.23694).toFixed(0)} mph</div>
                  <div className="text-gray-400 text-[10px]">
                    raw: {(diagnostics.speedRaw * 2.23694).toFixed(1)} mph
                  </div>
                </div>
              </div>

              {/* Position */}
              <div className="bg-gray-800/50 rounded p-2">
                <div className="flex items-center gap-1 text-gray-400 mb-1">
                  <Navigation className="w-3 h-3" />
                  <span>Position (Raw)</span>
                </div>
                <div className="font-mono text-[10px]">
                  <div>{diagnostics.rawLatLng.lat.toFixed(6)}</div>
                  <div>{diagnostics.rawLatLng.lng.toFixed(6)}</div>
                </div>
              </div>

              {/* Snapped Position */}
              <div className="bg-gray-800/50 rounded p-2">
                <div className="flex items-center gap-1 text-gray-400 mb-1">
                  <Route className="w-3 h-3" />
                  <span>Position (Snapped)</span>
                </div>
                <div className="font-mono text-[10px]">
                  {diagnostics.snappedLatLng ? (
                    <>
                      <div className="text-green-400">{diagnostics.snappedLatLng.lat.toFixed(6)}</div>
                      <div className="text-green-400">{diagnostics.snappedLatLng.lng.toFixed(6)}</div>
                    </>
                  ) : (
                    <div className="text-gray-500">No route</div>
                  )}
                </div>
              </div>

              {/* Heading */}
              <div className="bg-gray-800/50 rounded p-2">
                <div className="flex items-center gap-1 text-gray-400 mb-1">
                  <Compass className="w-3 h-3" />
                  <span>Heading</span>
                </div>
                <div className="font-mono">
                  <div className="text-white">{diagnostics.headingCourse.toFixed(0)}°</div>
                </div>
              </div>

              {/* Route Status */}
              <div className="bg-gray-800/50 rounded p-2">
                <div className="flex items-center gap-1 text-gray-400 mb-1">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Route Status</span>
                </div>
                <div className="font-mono">
                  <div className={diagnostics.isOnRoute ? 'text-green-400' : 'text-red-400'}>
                    {diagnostics.isOnRoute ? 'ON ROUTE' : 'OFF ROUTE'}
                  </div>
                  <div className="text-gray-400 text-[10px]">
                    Reroutes: {rerouteCount}
                  </div>
                </div>
              </div>
            </div>

            {/* Distance to Route */}
            <div className="bg-gray-800/50 rounded p-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Distance to Route</span>
                <span className={`font-mono ${diagnostics.distanceToRouteM > config.offRouteThresholdMeters ? 'text-red-400' : 'text-green-400'}`}>
                  {diagnostics.distanceToRouteM.toFixed(1)}m
                </span>
              </div>
            </div>

            {/* Last Error */}
            {diagnostics.lastError && (
              <div className="bg-red-900/30 border border-red-700 rounded p-2">
                <div className="text-red-400 text-[10px]">
                  <strong>Last Error:</strong> {diagnostics.lastError}
                </div>
              </div>
            )}

            {/* Debug Logs (collapsed by default) */}
            <details className="bg-gray-800/50 rounded">
              <summary className="p-2 cursor-pointer text-gray-400 hover:text-white">
                Debug Logs ({debugLogs.length})
              </summary>
              <div className="max-h-32 overflow-y-auto p-2 text-[10px] font-mono space-y-0.5">
                {debugLogs.slice(-10).map((log, i) => (
                  <div key={i} className="text-gray-400 truncate">{log}</div>
                ))}
              </div>
            </details>

            {/* Config Summary */}
            <details className="bg-gray-800/50 rounded">
              <summary className="p-2 cursor-pointer text-gray-400 hover:text-white">
                Active Config
              </summary>
              <div className="p-2 text-[10px] font-mono grid grid-cols-2 gap-1">
                <div>Snap: {config.snapThresholdMeters}m</div>
                <div>OffRoute: {config.offRouteThresholdMeters}m</div>
                <div>Duration: {config.offRouteDurationSeconds}s</div>
                <div>SpeedSmooth: {config.speedSmoothingSamples}</div>
                <div>HeadingLerp: {config.headingLerpFactor}</div>
                <div>DistFilter: {config.distanceFilter}m</div>
              </div>
            </details>
          </div>
        )}
      </div>
    </div>
  );
};

export default NativeNavigationDebugPanel;
