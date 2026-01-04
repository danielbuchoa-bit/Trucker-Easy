import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { subscribeToDiagnostics } from '@/services/HereService';

export interface DiagnosticEntry {
  timestamp: number;
  service: 'HERE' | 'Mapbox' | 'Other';
  endpoint: string;
  status: number | 'ok' | 'error';
  message?: string;
  resultCount?: number;
}

interface DiagnosticsState {
  enabled: boolean;
  lastHereCall: DiagnosticEntry | null;
  lastMapboxCall: DiagnosticEntry | null;
  lastError: DiagnosticEntry | null;
  lastPoiQuery: DiagnosticEntry | null;
  reroutesLastMinute: number;
  allLogs: DiagnosticEntry[];
}

interface DiagnosticsContextType extends DiagnosticsState {
  toggleDiagnostics: () => void;
  logHereCall: (entry: Omit<DiagnosticEntry, 'timestamp' | 'service'>) => void;
  logMapboxCall: (entry: Omit<DiagnosticEntry, 'timestamp' | 'service'>) => void;
  logPoiQuery: (entry: Omit<DiagnosticEntry, 'timestamp' | 'service'>) => void;
  logError: (entry: Omit<DiagnosticEntry, 'timestamp'>) => void;
  logReroute: () => void;
  copyDiagnostics: () => Promise<void>;
  getStatusMessage: (status: number | 'ok' | 'error') => string;
}

const DiagnosticsContext = createContext<DiagnosticsContextType | null>(null);

export const useDiagnostics = () => {
  const ctx = useContext(DiagnosticsContext);
  if (!ctx) {
    throw new Error('useDiagnostics must be used within DiagnosticsProvider');
  }
  return ctx;
};

// Safe hook that returns null if not in provider (for components that might not have it)
export const useDiagnosticsSafe = () => {
  return useContext(DiagnosticsContext);
};

export const DiagnosticsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [enabled, setEnabled] = useState(false);
  const [lastHereCall, setLastHereCall] = useState<DiagnosticEntry | null>(null);
  const [lastMapboxCall, setLastMapboxCall] = useState<DiagnosticEntry | null>(null);
  const [lastError, setLastError] = useState<DiagnosticEntry | null>(null);
  const [lastPoiQuery, setLastPoiQuery] = useState<DiagnosticEntry | null>(null);
  const [allLogs, setAllLogs] = useState<DiagnosticEntry[]>([]);
  const [reroutesLastMinute, setReroutesLastMinute] = useState(0);
  
  const rerouteTimestamps = useRef<number[]>([]);

  const addLog = useCallback((entry: DiagnosticEntry) => {
    setAllLogs(prev => [...prev.slice(-49), entry]); // Keep last 50
    console.log(`[Diagnostics] ${entry.service} | ${entry.endpoint} | ${entry.status}`, entry.message || '');
  }, []);

  // Subscribe to HereService diagnostics
  useEffect(() => {
    const unsubscribe = subscribeToDiagnostics((data) => {
      const entry: DiagnosticEntry = {
        timestamp: Date.now(),
        service: 'HERE',
        endpoint: data.endpoint,
        status: data.status,
        message: data.message,
        resultCount: data.resultCount,
      };
      
      setLastHereCall(entry);
      addLog(entry);
      
      // Check if it's a POI query
      if (data.endpoint.includes('browse') || data.endpoint.includes('poi')) {
        setLastPoiQuery(entry);
      }
      
      // Check for errors
      if (data.status === 'error' || data.status === 401 || data.status === 403 || data.status === 429) {
        setLastError(entry);
      }
    });
    
    return unsubscribe;
  }, [addLog]);

  const getStatusMessage = useCallback((status: number | 'ok' | 'error'): string => {
    if (status === 'ok') return '✅ OK';
    if (status === 'error') return '❌ Error';
    if (status === 401 || status === 403) return `🔐 ${status}: Serviço HERE não habilitado ou credencial inválida`;
    if (status === 429) return `⚠️ ${status}: Rate limit - reduzir chamadas / aplicar debounce`;
    if (status >= 500) return `💥 ${status}: Server error`;
    if (status >= 400) return `❌ ${status}: Client error`;
    if (status >= 200 && status < 300) return `✅ ${status}`;
    return `${status}`;
  }, []);

  const logHereCall = useCallback((entry: Omit<DiagnosticEntry, 'timestamp' | 'service'>) => {
    const fullEntry: DiagnosticEntry = { ...entry, timestamp: Date.now(), service: 'HERE' };
    setLastHereCall(fullEntry);
    addLog(fullEntry);
    
    if (entry.status === 401 || entry.status === 403 || entry.status === 429 || entry.status === 'error') {
      setLastError(fullEntry);
    }
  }, [addLog]);

  const logMapboxCall = useCallback((entry: Omit<DiagnosticEntry, 'timestamp' | 'service'>) => {
    const fullEntry: DiagnosticEntry = { ...entry, timestamp: Date.now(), service: 'Mapbox' };
    setLastMapboxCall(fullEntry);
    addLog(fullEntry);
    
    if (entry.status === 401 || entry.status === 403 || entry.status === 'error') {
      setLastError(fullEntry);
    }
  }, [addLog]);

  const logPoiQuery = useCallback((entry: Omit<DiagnosticEntry, 'timestamp' | 'service'>) => {
    const fullEntry: DiagnosticEntry = { ...entry, timestamp: Date.now(), service: 'HERE' };
    setLastPoiQuery(fullEntry);
    addLog(fullEntry);
  }, [addLog]);

  const logError = useCallback((entry: Omit<DiagnosticEntry, 'timestamp'>) => {
    const fullEntry: DiagnosticEntry = { ...entry, timestamp: Date.now() };
    setLastError(fullEntry);
    addLog(fullEntry);
  }, [addLog]);

  const logReroute = useCallback(() => {
    const now = Date.now();
    rerouteTimestamps.current.push(now);
    // Keep only last minute
    rerouteTimestamps.current = rerouteTimestamps.current.filter(t => now - t < 60000);
    setReroutesLastMinute(rerouteTimestamps.current.length);
  }, []);

  const toggleDiagnostics = useCallback(() => {
    setEnabled(prev => !prev);
  }, []);

  const copyDiagnostics = useCallback(async () => {
    const data = {
      timestamp: new Date().toISOString(),
      enabled,
      lastHereCall,
      lastMapboxCall,
      lastError,
      lastPoiQuery,
      reroutesLastMinute,
      recentLogs: allLogs.slice(-20),
    };
    
    const text = JSON.stringify(data, null, 2);
    
    try {
      await navigator.clipboard.writeText(text);
      console.log('[Diagnostics] Copied to clipboard');
    } catch (err) {
      console.error('[Diagnostics] Failed to copy:', err);
      // Fallback for mobile
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  }, [enabled, lastHereCall, lastMapboxCall, lastError, lastPoiQuery, reroutesLastMinute, allLogs]);

  return (
    <DiagnosticsContext.Provider value={{
      enabled,
      lastHereCall,
      lastMapboxCall,
      lastError,
      lastPoiQuery,
      reroutesLastMinute,
      allLogs,
      toggleDiagnostics,
      logHereCall,
      logMapboxCall,
      logPoiQuery,
      logError,
      logReroute,
      copyDiagnostics,
      getStatusMessage,
    }}>
      {children}
    </DiagnosticsContext.Provider>
  );
};
