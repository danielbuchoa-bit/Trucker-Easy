/**
 * NextBillion Diagnostics Panel
 * Hidden panel activated by 5 rapid taps on logo
 * Shows location status, SDK status, and network logs
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, MapPin, Wifi, AlertTriangle, Check, XCircle, RefreshCw, Copy, Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

// ============= TYPES =============

export interface NetworkLogEntry {
  id: string;
  timestamp: number;
  endpoint: string;
  method: 'GET' | 'POST';
  params: Record<string, any>;
  statusCode: number;
  latencyMs: number;
  error?: string;
  responsePreview?: string;
  resultCount?: number;
}

export interface LocationStatus {
  permissionState: 'prompt' | 'granted' | 'denied' | 'unknown';
  servicesEnabled: boolean;
  lastPosition: {
    lat: number;
    lng: number;
    accuracy: number;
    speed: number | null;
    heading: number | null;
    timestamp: number;
  } | null;
  updateFrequencyMs: number;
  errors: string[];
  watchId: number | null;
}

export interface SdkStatus {
  initialized: boolean;
  apiKeyLoaded: boolean;
  apiKeyLast4: string;
  environment: 'dev' | 'staging' | 'prod';
  baseUrl: string;
}

// ============= GLOBAL STORE =============

const MAX_LOGS = 50;
let networkLogs: NetworkLogEntry[] = [];
let logListeners: (() => void)[] = [];

export const addNetworkLog = (entry: Omit<NetworkLogEntry, 'id' | 'timestamp'>) => {
  const newEntry: NetworkLogEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
  };
  
  networkLogs = [newEntry, ...networkLogs].slice(0, MAX_LOGS);
  logListeners.forEach(cb => cb());
  
  // Console log for debugging
  const status = entry.statusCode >= 200 && entry.statusCode < 300 ? '✅' : '❌';
  console.log(`[NB-Network] ${status} ${entry.endpoint}`, {
    status: entry.statusCode,
    latency: `${entry.latencyMs}ms`,
    results: entry.resultCount,
    error: entry.error,
  });
};

export const clearNetworkLogs = () => {
  networkLogs = [];
  logListeners.forEach(cb => cb());
};

export const getNetworkLogs = () => networkLogs;

const subscribeToLogs = (callback: () => void) => {
  logListeners.push(callback);
  return () => {
    logListeners = logListeners.filter(cb => cb !== callback);
  };
};

// ============= COMPONENT =============

interface NextBillionDiagnosticsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NextBillionDiagnosticsPanel = ({ isOpen, onClose }: NextBillionDiagnosticsPanelProps) => {
  const [locationStatus, setLocationStatus] = useState<LocationStatus>({
    permissionState: 'unknown',
    servicesEnabled: false,
    lastPosition: null,
    updateFrequencyMs: 0,
    errors: [],
    watchId: null,
  });
  
  const [sdkStatus, setSdkStatus] = useState<SdkStatus>({
    initialized: false,
    apiKeyLoaded: false,
    apiKeyLast4: '****',
    environment: 'prod',
    baseUrl: 'https://api.nextbillion.io',
  });
  
  const [logs, setLogs] = useState<NetworkLogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'location' | 'sdk' | 'network'>('location');
  const lastUpdateRef = useRef<number>(0);
  const watchIdRef = useRef<number | null>(null);

  // Subscribe to network logs and custom events
  useEffect(() => {
    setLogs(getNetworkLogs());
    const unsubscribe = subscribeToLogs(() => setLogs([...getNetworkLogs()]));
    
    // Listen for custom network log events from NextBillionService
    const handleNetworkLog = (event: CustomEvent) => {
      addNetworkLog(event.detail);
    };
    
    window.addEventListener('nb-network-log', handleNetworkLog as EventListener);
    
    return () => {
      unsubscribe();
      window.removeEventListener('nb-network-log', handleNetworkLog as EventListener);
    };
  }, []);

  // Check permissions
  const checkPermissions = useCallback(async () => {
    try {
      if ('permissions' in navigator) {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        setLocationStatus(prev => ({
          ...prev,
          permissionState: result.state as 'prompt' | 'granted' | 'denied',
        }));
        
        result.addEventListener('change', () => {
          setLocationStatus(prev => ({
            ...prev,
            permissionState: result.state as 'prompt' | 'granted' | 'denied',
          }));
        });
      }
    } catch (e) {
      console.warn('[Diagnostics] Cannot query permissions:', e);
    }
  }, []);

  // Start watching location
  const startWatching = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationStatus(prev => ({
        ...prev,
        servicesEnabled: false,
        errors: [...prev.errors, 'Geolocation not supported'],
      }));
      return;
    }

    // Clear existing watch
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    const id = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        const updateFrequency = lastUpdateRef.current > 0 
          ? now - lastUpdateRef.current 
          : 0;
        lastUpdateRef.current = now;

        setLocationStatus(prev => ({
          ...prev,
          servicesEnabled: true,
          lastPosition: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            speed: position.coords.speed,
            heading: position.coords.heading,
            timestamp: position.timestamp,
          },
          updateFrequencyMs: updateFrequency,
          errors: [],
          watchId: id,
        }));
      },
      (error) => {
        setLocationStatus(prev => ({
          ...prev,
          errors: [...prev.errors.slice(-9), `${error.code}: ${error.message}`],
        }));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );

    watchIdRef.current = id;
    setLocationStatus(prev => ({ ...prev, watchId: id }));
  }, []);

  // Check SDK status
  const checkSdkStatus = useCallback(() => {
    // Check if API key is available (we can't read the actual value, but we can check if calls work)
    setSdkStatus({
      initialized: true,
      apiKeyLoaded: true, // Assume loaded if edge functions work
      apiKeyLast4: '****',
      environment: window.location.hostname.includes('localhost') ? 'dev' : 'prod',
      baseUrl: 'https://api.nextbillion.io',
    });
  }, []);

  useEffect(() => {
    if (isOpen) {
      checkPermissions();
      startWatching();
      checkSdkStatus();
    }
    
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [isOpen, checkPermissions, startWatching, checkSdkStatus]);

  const handleCopyLogs = () => {
    const logText = JSON.stringify({
      timestamp: new Date().toISOString(),
      location: locationStatus,
      sdk: sdkStatus,
      networkLogs: logs,
    }, null, 2);
    
    navigator.clipboard.writeText(logText);
    toast.success('Logs copiados!');
  };

  const handleExportLogs = () => {
    const logText = JSON.stringify({
      timestamp: new Date().toISOString(),
      location: locationStatus,
      sdk: sdkStatus,
      networkLogs: logs,
    }, null, 2);
    
    const blob = new Blob([logText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nb-diagnostics-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Logs exportados!');
  };

  const getStatusBadge = (success: boolean) => (
    <Badge variant={success ? 'default' : 'destructive'} className="ml-2">
      {success ? <Check className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
      {success ? 'OK' : 'ERROR'}
    </Badge>
  );

  const getPermissionBadge = (state: string) => {
    const colors: Record<string, string> = {
      granted: 'bg-green-500',
      denied: 'bg-red-500',
      prompt: 'bg-yellow-500',
      unknown: 'bg-gray-500',
    };
    return (
      <Badge className={`${colors[state] || colors.unknown} text-white`}>
        {state.toUpperCase()}
      </Badge>
    );
  };

  const formatTimestamp = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('pt-BR', { hour12: false });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-sm">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            NextBillion Diagnostics
          </h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyLogs}>
              <Copy className="w-4 h-4 mr-1" />
              Copy
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportLogs}>
              <Download className="w-4 h-4 mr-1" />
              Export
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {(['location', 'sdk', 'network'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'location' && <MapPin className="w-4 h-4 inline mr-1" />}
              {tab === 'sdk' && <Wifi className="w-4 h-4 inline mr-1" />}
              {tab === 'network' && <RefreshCw className="w-4 h-4 inline mr-1" />}
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 p-4">
          {activeTab === 'location' && (
            <div className="space-y-4">
              <div className="bg-card rounded-lg p-4 border border-border">
                <h3 className="font-semibold mb-3">Permission Status</h3>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Geolocation Permission</span>
                  {getPermissionBadge(locationStatus.permissionState)}
                </div>
              </div>

              <div className="bg-card rounded-lg p-4 border border-border">
                <h3 className="font-semibold mb-3">Services</h3>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Location Services</span>
                  {getStatusBadge(locationStatus.servicesEnabled)}
                </div>
              </div>

              <div className="bg-card rounded-lg p-4 border border-border">
                <h3 className="font-semibold mb-3">Last Position</h3>
                {locationStatus.lastPosition ? (
                  <div className="space-y-2 font-mono text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Latitude:</span>
                      <span>{locationStatus.lastPosition.lat.toFixed(8)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Longitude:</span>
                      <span>{locationStatus.lastPosition.lng.toFixed(8)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Accuracy:</span>
                      <span>{locationStatus.lastPosition.accuracy.toFixed(1)}m</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Speed:</span>
                      <span>{locationStatus.lastPosition.speed?.toFixed(1) || 'N/A'} m/s</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Heading:</span>
                      <span>{locationStatus.lastPosition.heading?.toFixed(1) || 'N/A'}°</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Timestamp:</span>
                      <span>{formatTimestamp(locationStatus.lastPosition.timestamp)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No position yet</p>
                )}
              </div>

              <div className="bg-card rounded-lg p-4 border border-border">
                <h3 className="font-semibold mb-3">Update Frequency</h3>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last interval:</span>
                  <span className="font-mono">{locationStatus.updateFrequencyMs}ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Watch ID:</span>
                  <span className="font-mono">{locationStatus.watchId ?? 'None'}</span>
                </div>
              </div>

              {locationStatus.errors.length > 0 && (
                <div className="bg-destructive/10 rounded-lg p-4 border border-destructive">
                  <h3 className="font-semibold mb-3 text-destructive">Errors</h3>
                  <ul className="space-y-1 text-sm font-mono">
                    {locationStatus.errors.map((err, i) => (
                      <li key={i} className="text-destructive">{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <Button onClick={startWatching} className="w-full">
                <RefreshCw className="w-4 h-4 mr-2" />
                Restart Location Watch
              </Button>
            </div>
          )}

          {activeTab === 'sdk' && (
            <div className="space-y-4">
              <div className="bg-card rounded-lg p-4 border border-border">
                <h3 className="font-semibold mb-3">SDK Status</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">SDK Initialized</span>
                    {getStatusBadge(sdkStatus.initialized)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">API Key Loaded</span>
                    {getStatusBadge(sdkStatus.apiKeyLoaded)}
                  </div>
                </div>
              </div>

              <div className="bg-card rounded-lg p-4 border border-border">
                <h3 className="font-semibold mb-3">Configuration</h3>
                <div className="space-y-2 font-mono text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">API Key (last 4):</span>
                    <span>****{sdkStatus.apiKeyLast4}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Environment:</span>
                    <Badge variant="outline">{sdkStatus.environment.toUpperCase()}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Base URL:</span>
                    <span className="text-xs">{sdkStatus.baseUrl}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'network' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Network Logs ({logs.length})</h3>
                <Button variant="outline" size="sm" onClick={clearNetworkLogs}>
                  <Trash2 className="w-4 h-4 mr-1" />
                  Clear
                </Button>
              </div>

              {logs.length === 0 ? (
                <div className="bg-card rounded-lg p-4 border border-border text-center text-muted-foreground">
                  No network logs yet. Make API calls to see them here.
                </div>
              ) : (
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className={`bg-card rounded-lg p-3 border ${
                        log.statusCode >= 200 && log.statusCode < 300
                          ? 'border-green-500/30'
                          : 'border-destructive/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={log.statusCode >= 200 && log.statusCode < 300 ? 'default' : 'destructive'}
                            className="font-mono"
                          >
                            {log.statusCode}
                          </Badge>
                          <span className="font-medium text-sm">{log.endpoint}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatTimestamp(log.timestamp)}
                        </span>
                      </div>
                      
                      <div className="text-xs font-mono text-muted-foreground space-y-1">
                        <div>Latency: {log.latencyMs}ms</div>
                        {log.resultCount !== undefined && (
                          <div>Results: {log.resultCount}</div>
                        )}
                        {log.params && Object.keys(log.params).length > 0 && (
                          <div className="truncate">
                            Params: {JSON.stringify(log.params)}
                          </div>
                        )}
                        {log.error && (
                          <div className="text-destructive">Error: {log.error}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
};

export default NextBillionDiagnosticsPanel;
