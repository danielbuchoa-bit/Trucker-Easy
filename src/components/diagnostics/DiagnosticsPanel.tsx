import React from 'react';
import { useDiagnostics } from '@/contexts/DiagnosticsContext';
import { X, Copy, Check } from 'lucide-react';
import { useState } from 'react';

const DiagnosticsPanel: React.FC = () => {
  const {
    enabled,
    lastHereCall,
    lastMapboxCall,
    lastError,
    lastPoiQuery,
    reroutesLastMinute,
    toggleDiagnostics,
    copyDiagnostics,
    getStatusMessage,
  } = useDiagnostics();

  const [copied, setCopied] = useState(false);

  if (!enabled) return null;

  const handleCopy = async () => {
    await copyDiagnostics();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTime = (ts: number | undefined) => {
    if (!ts) return '--';
    const d = new Date(ts);
    return d.toLocaleTimeString();
  };

  const truncate = (str: string, len: number) => {
    if (!str) return '--';
    return str.length > len ? str.slice(0, len) + '...' : str;
  };

  return (
    <div className="fixed bottom-20 left-2 right-2 z-[9999] bg-black/90 text-white text-xs rounded-lg p-3 max-h-[40vh] overflow-auto shadow-2xl border border-white/20">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/20">
        <span className="font-bold text-yellow-400">🔧 DIAGNOSTICS MODE</span>
        <div className="flex gap-2">
          <button 
            onClick={handleCopy}
            className="p-1 bg-blue-600 rounded hover:bg-blue-500 flex items-center gap-1"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button 
            onClick={toggleDiagnostics}
            className="p-1 bg-red-600 rounded hover:bg-red-500"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="space-y-1.5">
        {/* HERE Call */}
        <div className="flex flex-wrap gap-1">
          <span className="text-gray-400">HERE:</span>
          {lastHereCall ? (
            <>
              <span className="text-blue-300">{truncate(lastHereCall.endpoint, 25)}</span>
              <span className={lastHereCall.status === 'ok' || (typeof lastHereCall.status === 'number' && lastHereCall.status < 400) ? 'text-green-400' : 'text-red-400'}>
                {getStatusMessage(lastHereCall.status)}
              </span>
              <span className="text-gray-500">{formatTime(lastHereCall.timestamp)}</span>
            </>
          ) : (
            <span className="text-gray-500">No calls yet</span>
          )}
        </div>

        {/* Mapbox Call */}
        <div className="flex flex-wrap gap-1">
          <span className="text-gray-400">Mapbox:</span>
          {lastMapboxCall ? (
            <>
              <span className="text-purple-300">{truncate(lastMapboxCall.endpoint, 25)}</span>
              <span className={lastMapboxCall.status === 'ok' ? 'text-green-400' : 'text-red-400'}>
                {getStatusMessage(lastMapboxCall.status)}
              </span>
              <span className="text-gray-500">{formatTime(lastMapboxCall.timestamp)}</span>
            </>
          ) : (
            <span className="text-gray-500">No calls yet</span>
          )}
        </div>

        {/* POI Query */}
        <div className="flex flex-wrap gap-1">
          <span className="text-gray-400">POIs:</span>
          {lastPoiQuery ? (
            <>
              <span className="text-cyan-300">{truncate(lastPoiQuery.endpoint, 20)}</span>
              <span className="text-yellow-300">
                {lastPoiQuery.resultCount ?? 0} results
              </span>
              <span className="text-gray-500">{formatTime(lastPoiQuery.timestamp)}</span>
            </>
          ) : (
            <span className="text-gray-500">No queries yet</span>
          )}
        </div>

        {/* Reroutes */}
        <div className="flex gap-1">
          <span className="text-gray-400">Reroutes/min:</span>
          <span className={reroutesLastMinute > 5 ? 'text-orange-400' : 'text-green-400'}>
            {reroutesLastMinute}
          </span>
          {reroutesLastMinute > 5 && <span className="text-orange-400">⚠️ High</span>}
        </div>

        {/* Last Error */}
        {lastError && (
          <div className="mt-2 p-2 bg-red-900/50 rounded border border-red-500/50">
            <div className="flex gap-1 flex-wrap">
              <span className="text-red-400 font-bold">❌ Last Error:</span>
              <span className="text-red-300">{lastError.service}</span>
              <span className="text-red-200">{getStatusMessage(lastError.status)}</span>
            </div>
            {lastError.message && (
              <div className="text-red-200 mt-1 break-words">
                {truncate(lastError.message, 100)}
              </div>
            )}
            <div className="text-gray-500 text-[10px] mt-1">
              {formatTime(lastError.timestamp)}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-2 pt-2 border-t border-white/10 text-[10px] text-gray-500">
        Tap 5x on map to toggle • Data updates in real-time
      </div>
    </div>
  );
};

export default DiagnosticsPanel;
