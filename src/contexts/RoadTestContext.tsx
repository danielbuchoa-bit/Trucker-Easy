import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

// ============= TYPES =============

export interface GpsDiagnostics {
  lat: number;
  lng: number;
  accuracy: number;
  speed: number | null;
  heading: number | null;
  timestamp: number;
  updatesPerSecond: number;
  source: 'real' | 'simulated' | 'unknown';
  appState: 'foreground' | 'background';
}

export interface ApiDiagnostics {
  endpoint: string;
  status: number | 'pending' | 'error';
  latencyMs: number;
  timestamp: number;
  errorMessage?: string;
}

export interface MapMatchingDiagnostics {
  enabled: boolean;
  lastMatchedLat: number | null;
  lastMatchedLng: number | null;
  confidence: number;
  distanceFromRaw: number;
}

export interface RoadTestDiagnostics {
  gps: GpsDiagnostics | null;
  mapMatching: MapMatchingDiagnostics;
  routeProvider: 'HERE' | 'NextBillion' | 'none';
  renderProvider: 'Mapbox' | 'HERE' | 'none';
  lastApiError: ApiDiagnostics | null;
  apiCalls: ApiDiagnostics[];
  locationUpdates: GpsDiagnostics[];
  isNavigating: boolean;
  cursorOnRoad: boolean;
  rerouteCount: number;
  voiceEnabled: boolean;
}

export interface TestChecklistItem {
  id: string;
  label: string;
  description: string;
  status: 'pending' | 'pass' | 'fail';
  testedAt: number | null;
  errorLog?: string;
}

export interface RoadTestContextValue {
  // Mode
  isRoadTestMode: boolean;
  setRoadTestMode: (enabled: boolean) => void;
  
  // Diagnostics
  diagnostics: RoadTestDiagnostics;
  updateGpsDiagnostics: (gps: Partial<GpsDiagnostics>) => void;
  updateMapMatchingDiagnostics: (mm: Partial<MapMatchingDiagnostics>) => void;
  logApiCall: (api: ApiDiagnostics) => void;
  logLocationUpdate: (loc: GpsDiagnostics) => void;
  setNavigationState: (state: Partial<Pick<RoadTestDiagnostics, 'isNavigating' | 'cursorOnRoad' | 'rerouteCount' | 'voiceEnabled'>>) => void;
  
  // Checklist
  checklist: TestChecklistItem[];
  updateChecklistItem: (id: string, status: 'pass' | 'fail', errorLog?: string) => void;
  resetChecklist: () => void;
  
  // Export
  exportDiagnosticReport: () => string;
  
  // Panel visibility
  showDiagnosticsPanel: boolean;
  setShowDiagnosticsPanel: (show: boolean) => void;
}

const defaultChecklist: TestChecklistItem[] = [
  { id: 'gps_fixed', label: 'GPS Fixado', description: 'GPS real do dispositivo funcionando', status: 'pending', testedAt: null },
  { id: 'cursor_on_road', label: 'Cursor na Estrada', description: 'Cursor alinhado com a via', status: 'pending', testedAt: null },
  { id: 'reroute_working', label: 'Re-roteamento', description: 'Re-roteamento automático funcionando', status: 'pending', testedAt: null },
  { id: 'voice_working', label: 'Voz Funcionando', description: 'Instruções de voz ativas', status: 'pending', testedAt: null },
  { id: 'weigh_station_detected', label: 'Balança Detectada', description: 'Balanças identificadas na rota', status: 'pending', testedAt: null },
  { id: 'weigh_status_sync', label: 'Status Balança Sync', description: 'Status de balança enviado/recebido', status: 'pending', testedAt: null },
  { id: 'truck_stop_identified', label: 'Truck Stop Identificado', description: 'POIs de truck stop na rota', status: 'pending', testedAt: null },
  { id: 'food_suggestion', label: 'Sugestão Alimentar', description: 'Recomendação de alimentação gerada', status: 'pending', testedAt: null },
  { id: 'no_api_errors', label: 'Sem Erros de API', description: 'Nenhum erro 4xx/5xx crítico', status: 'pending', testedAt: null },
];

const defaultDiagnostics: RoadTestDiagnostics = {
  gps: null,
  mapMatching: {
    enabled: true,
    lastMatchedLat: null,
    lastMatchedLng: null,
    confidence: 0,
    distanceFromRaw: 0,
  },
  routeProvider: 'HERE',
  renderProvider: 'Mapbox',
  lastApiError: null,
  apiCalls: [],
  locationUpdates: [],
  isNavigating: false,
  cursorOnRoad: true,
  rerouteCount: 0,
  voiceEnabled: true,
};

const RoadTestContext = createContext<RoadTestContextValue | null>(null);

const STORAGE_KEY = 'roadTestMode';
const MAX_LOG_ENTRIES = 500;

export const RoadTestProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isRoadTestMode, setIsRoadTestMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  
  const [showDiagnosticsPanel, setShowDiagnosticsPanel] = useState(false);
  const [diagnostics, setDiagnostics] = useState<RoadTestDiagnostics>(defaultDiagnostics);
  const [checklist, setChecklist] = useState<TestChecklistItem[]>(defaultChecklist);
  
  const updateCountRef = useRef(0);
  const lastUpdateTimeRef = useRef(Date.now());

  // Persist mode
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(isRoadTestMode));
    } catch (e) {
      console.error('Failed to persist road test mode:', e);
    }
    
    // When enabled, show diagnostics panel
    if (isRoadTestMode) {
      setShowDiagnosticsPanel(true);
    }
  }, [isRoadTestMode]);

  const setRoadTestMode = useCallback((enabled: boolean) => {
    console.log('[ROAD_TEST]', enabled ? 'ENABLED' : 'DISABLED');
    setIsRoadTestMode(enabled);
    
    if (enabled) {
      // Reset diagnostics when enabling
      setDiagnostics(defaultDiagnostics);
      setChecklist(defaultChecklist);
    }
  }, []);

  const updateGpsDiagnostics = useCallback((gps: Partial<GpsDiagnostics>) => {
    const now = Date.now();
    updateCountRef.current++;
    
    // Calculate updates per second
    const elapsed = (now - lastUpdateTimeRef.current) / 1000;
    const ups = elapsed > 0 ? updateCountRef.current / elapsed : 0;
    
    // Reset counter every 5 seconds
    if (elapsed > 5) {
      updateCountRef.current = 0;
      lastUpdateTimeRef.current = now;
    }

    setDiagnostics(prev => ({
      ...prev,
      gps: {
        lat: gps.lat ?? prev.gps?.lat ?? 0,
        lng: gps.lng ?? prev.gps?.lng ?? 0,
        accuracy: gps.accuracy ?? prev.gps?.accuracy ?? 0,
        speed: gps.speed ?? prev.gps?.speed ?? null,
        heading: gps.heading ?? prev.gps?.heading ?? null,
        timestamp: gps.timestamp ?? Date.now(),
        updatesPerSecond: Math.round(ups * 10) / 10,
        source: gps.source ?? prev.gps?.source ?? 'unknown',
        appState: gps.appState ?? prev.gps?.appState ?? 'foreground',
      },
    }));
  }, []);

  const updateMapMatchingDiagnostics = useCallback((mm: Partial<MapMatchingDiagnostics>) => {
    setDiagnostics(prev => ({
      ...prev,
      mapMatching: { ...prev.mapMatching, ...mm },
    }));
  }, []);

  const logApiCall = useCallback((api: ApiDiagnostics) => {
    setDiagnostics(prev => {
      const newCalls = [api, ...prev.apiCalls].slice(0, MAX_LOG_ENTRIES);
      const isError = typeof api.status === 'number' && api.status >= 400;
      
      return {
        ...prev,
        apiCalls: newCalls,
        lastApiError: isError ? api : prev.lastApiError,
      };
    });
  }, []);

  const logLocationUpdate = useCallback((loc: GpsDiagnostics) => {
    setDiagnostics(prev => ({
      ...prev,
      locationUpdates: [loc, ...prev.locationUpdates].slice(0, MAX_LOG_ENTRIES),
    }));
  }, []);

  const setNavigationState = useCallback((state: Partial<Pick<RoadTestDiagnostics, 'isNavigating' | 'cursorOnRoad' | 'rerouteCount' | 'voiceEnabled'>>) => {
    setDiagnostics(prev => ({ ...prev, ...state }));
  }, []);

  const updateChecklistItem = useCallback((id: string, status: 'pass' | 'fail', errorLog?: string) => {
    setChecklist(prev => prev.map(item => 
      item.id === id 
        ? { ...item, status, testedAt: Date.now(), errorLog } 
        : item
    ));
  }, []);

  const resetChecklist = useCallback(() => {
    setChecklist(defaultChecklist);
  }, []);

  const exportDiagnosticReport = useCallback(() => {
    const report = {
      exportedAt: new Date().toISOString(),
      mode: 'Road Test Mode',
      diagnostics: {
        gps: diagnostics.gps,
        mapMatching: diagnostics.mapMatching,
        routeProvider: diagnostics.routeProvider,
        renderProvider: diagnostics.renderProvider,
        isNavigating: diagnostics.isNavigating,
        cursorOnRoad: diagnostics.cursorOnRoad,
        rerouteCount: diagnostics.rerouteCount,
        voiceEnabled: diagnostics.voiceEnabled,
      },
      checklist: checklist.map(item => ({
        id: item.id,
        label: item.label,
        status: item.status,
        testedAt: item.testedAt ? new Date(item.testedAt).toISOString() : null,
        errorLog: item.errorLog,
      })),
      apiCalls: diagnostics.apiCalls.slice(0, 100).map(api => ({
        endpoint: api.endpoint,
        status: api.status,
        latencyMs: api.latencyMs,
        timestamp: new Date(api.timestamp).toISOString(),
        error: api.errorMessage,
      })),
      locationUpdates: diagnostics.locationUpdates.slice(0, 100).map(loc => ({
        lat: loc.lat.toFixed(6),
        lng: loc.lng.toFixed(6),
        accuracy: loc.accuracy,
        speed: loc.speed,
        heading: loc.heading,
        timestamp: new Date(loc.timestamp).toISOString(),
      })),
      lastApiError: diagnostics.lastApiError,
    };

    return JSON.stringify(report, null, 2);
  }, [diagnostics, checklist]);

  const value: RoadTestContextValue = {
    isRoadTestMode,
    setRoadTestMode,
    diagnostics,
    updateGpsDiagnostics,
    updateMapMatchingDiagnostics,
    logApiCall,
    logLocationUpdate,
    setNavigationState,
    checklist,
    updateChecklistItem,
    resetChecklist,
    exportDiagnosticReport,
    showDiagnosticsPanel,
    setShowDiagnosticsPanel,
  };

  return (
    <RoadTestContext.Provider value={value}>
      {children}
    </RoadTestContext.Provider>
  );
};

export const useRoadTest = (): RoadTestContextValue => {
  const context = useContext(RoadTestContext);
  if (!context) {
    throw new Error('useRoadTest must be used within RoadTestProvider');
  }
  return context;
};

// Safe version that returns defaults when outside provider
export const useRoadTestSafe = (): RoadTestContextValue | null => {
  return useContext(RoadTestContext);
};
