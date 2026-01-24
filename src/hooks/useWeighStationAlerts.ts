import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { WeighStation } from '@/types/bypass';
import { LngLat } from '@/lib/hereFlexiblePolyline';
import { haversineDistance, matchPositionToRoute } from '@/lib/navigationUtils';

// Constants
const MILES_TO_METERS = 1609.34;
const ALERT_DISTANCE_MILES = 30; // Alert at 30 miles as requested
const ALERT_DISTANCE_M = ALERT_DISTANCE_MILES * MILES_TO_METERS;
const MAX_CROSS_TRACK_MILES = 2.0; // Increased to catch more stations near route
const MAX_CROSS_TRACK_M = MAX_CROSS_TRACK_MILES * MILES_TO_METERS;
const GEOFENCE_RADIUS_MILES = 0.5; // Larger geofence for detection
const GEOFENCE_RADIUS_M = GEOFENCE_RADIUS_MILES * MILES_TO_METERS;
const REPORTS_CACHE_TIME_MS = 5 * 60 * 1000; // 5 minutes
const STATUS_WINDOW_MINUTES = 90;

export type StationStatus = 'OPEN' | 'CLOSED' | 'UNKNOWN';
export type ReportOutcome = 'BYPASS' | 'WEIGHED' | 'INSPECTED' | 'UNKNOWN';

export interface WeighStationReport {
  id: string;
  station_id: string;
  created_at: string;
  status_reported: StationStatus;
  outcome: ReportOutcome;
}

export interface StationOnRoute {
  station: WeighStation;
  distanceAlongRouteM: number;
  crossTrackDistanceM: number;
  routeSegmentIndex: number;
  status: StationStatus;
  lastUpdatedAt: string | null;
  recentReports: WeighStationReport[];
}

export interface GeofenceState {
  isInside: boolean;
  enteredAt: number | null;
  exitedAt: number | null;
  hasPassedThrough: boolean;
}

interface UseWeighStationAlertsOptions {
  userLat: number | null;
  userLng: number | null;
  routeCoords: LngLat[];
  enabled?: boolean;
}

// Generate a simple hash for the route
function generateRouteHash(coords: LngLat[]): string {
  if (coords.length === 0) return '';
  const start = coords[0];
  const end = coords[coords.length - 1];
  const mid = coords[Math.floor(coords.length / 2)];
  return `${start[0].toFixed(3)},${start[1].toFixed(3)}-${mid[0].toFixed(3)},${mid[1].toFixed(3)}-${end[0].toFixed(3)},${end[1].toFixed(3)}`;
}

// Calculate distance along route between two segment indices
function routeDistanceMeters(routeCoords: LngLat[], fromIdx: number, toIdx: number): number {
  if (routeCoords.length < 2 || toIdx <= fromIdx) return 0;
  
  const from = Math.max(0, Math.min(fromIdx, routeCoords.length - 2));
  const to = Math.max(0, Math.min(toIdx, routeCoords.length - 2));
  
  let dist = 0;
  for (let i = from; i <= to; i++) {
    const a = routeCoords[i];
    const b = routeCoords[i + 1];
    if (!a || !b) break;
    dist += haversineDistance(a[1], a[0], b[1], b[0]);
  }
  return dist;
}

export function useWeighStationAlerts({
  userLat,
  userLng,
  routeCoords,
  enabled = true,
}: UseWeighStationAlertsOptions) {
  const [stations, setStations] = useState<WeighStation[]>([]);
  const [stationsOnRoute, setStationsOnRoute] = useState<StationOnRoute[]>([]);
  const [alertedStationIds, setAlertedStationIds] = useState<Set<string>>(new Set());
  const [pendingAlert, setPendingAlert] = useState<StationOnRoute | null>(null);
  const [geofenceStates, setGeofenceStates] = useState<Map<string, GeofenceState>>(new Map());
  const [stationToReport, setStationToReport] = useState<StationOnRoute | null>(null);
  const [selectedStation, setSelectedStation] = useState<StationOnRoute | null>(null);
  
  const routeHashRef = useRef<string>('');
  const reportsCache = useRef<Map<string, { data: WeighStationReport[]; timestamp: number }>>(new Map());
  const stationsCache = useRef<{ data: WeighStation[]; timestamp: number } | null>(null);

  // Calculate current route hash
  const currentRouteHash = useMemo(() => generateRouteHash(routeCoords), [routeCoords]);

  // Reset alerts when route changes
  useEffect(() => {
    if (currentRouteHash !== routeHashRef.current) {
      console.log('[WEIGH_ALERT] Route changed, resetting alerts');
      routeHashRef.current = currentRouteHash;
      setAlertedStationIds(new Set());
      setGeofenceStates(new Map());
      setStationToReport(null);
      setPendingAlert(null);
    }
  }, [currentRouteHash]);

  // Fetch all active weigh stations
  const fetchStations = useCallback(async (): Promise<WeighStation[]> => {
    const now = Date.now();
    const cache = stationsCache.current;
    
    if (cache && now - cache.timestamp < REPORTS_CACHE_TIME_MS) {
      return cache.data;
    }

    try {
      const { data, error } = await supabase
        .from('weigh_stations')
        .select('*')
        .eq('active', true);

      if (error) throw error;

      const fetchedStations = (data || []) as WeighStation[];
      stationsCache.current = { data: fetchedStations, timestamp: now };
      return fetchedStations;
    } catch (error) {
      console.error('[WEIGH_ALERT] Error fetching stations:', error);
      return cache?.data || [];
    }
  }, []);

  // Fetch recent reports for a station
  const fetchReportsForStation = useCallback(async (stationId: string): Promise<WeighStationReport[]> => {
    const now = Date.now();
    const cached = reportsCache.current.get(stationId);
    
    if (cached && now - cached.timestamp < REPORTS_CACHE_TIME_MS) {
      return cached.data;
    }

    try {
      const cutoffTime = new Date(now - STATUS_WINDOW_MINUTES * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from('weigh_station_reports')
        .select('id, station_id, created_at, status_reported, outcome')
        .eq('station_id', stationId)
        .gte('created_at', cutoffTime)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      const reports = (data || []) as WeighStationReport[];
      reportsCache.current.set(stationId, { data: reports, timestamp: now });
      return reports;
    } catch (error) {
      console.error('[WEIGH_ALERT] Error fetching reports:', error);
      return cached?.data || [];
    }
  }, []);

  // Calculate station status from recent reports
  const calculateStatus = useCallback((reports: WeighStationReport[]): { status: StationStatus; lastUpdatedAt: string | null } => {
    if (reports.length === 0) {
      return { status: 'UNKNOWN', lastUpdatedAt: null };
    }

    let openCount = 0;
    let closedCount = 0;

    for (const report of reports) {
      if (report.status_reported === 'OPEN') openCount++;
      else if (report.status_reported === 'CLOSED') closedCount++;
    }

    const status: StationStatus = openCount > closedCount ? 'OPEN' : 
                                   closedCount > openCount ? 'CLOSED' : 'UNKNOWN';
    
    return { status, lastUpdatedAt: reports[0]?.created_at || null };
  }, []);

  // Find user position index on route
  const userRouteIndex = useMemo(() => {
    if (!userLat || !userLng || routeCoords.length < 2) return 0;
    return matchPositionToRoute(userLng, userLat, routeCoords).closestSegmentIndex;
  }, [userLat, userLng, routeCoords]);

  // Process stations on route
  useEffect(() => {
    if (!enabled || routeCoords.length < 2) return;

    const processStations = async () => {
      const allStations = await fetchStations();
      setStations(allStations);

      const onRoute: StationOnRoute[] = [];

      for (const station of allStations) {
        // Find closest point on route to station
        const match = matchPositionToRoute(station.lng, station.lat, routeCoords);
        const crossTrackDistanceM = match.distanceToRouteM;

        // Skip if too far from route (cross-track distance)
        if (crossTrackDistanceM > MAX_CROSS_TRACK_M) continue;

        // Skip if behind user on route
        if (match.closestSegmentIndex <= userRouteIndex) continue;

        // Calculate distance along route from user to station
        const distanceAlongRouteM = routeDistanceMeters(
          routeCoords,
          userRouteIndex,
          match.closestSegmentIndex
        );

        // Fetch reports and calculate status
        const reports = await fetchReportsForStation(station.id);
        const { status, lastUpdatedAt } = calculateStatus(reports);

        onRoute.push({
          station,
          distanceAlongRouteM,
          crossTrackDistanceM,
          routeSegmentIndex: match.closestSegmentIndex,
          status,
          lastUpdatedAt,
          recentReports: reports,
        });
      }

      // Sort by distance
      onRoute.sort((a, b) => a.distanceAlongRouteM - b.distanceAlongRouteM);
      setStationsOnRoute(onRoute);
    };

    processStations();
    
    // Update every 2 seconds
    const interval = setInterval(processStations, 2000);
    return () => clearInterval(interval);
  }, [enabled, routeCoords, userRouteIndex, fetchStations, fetchReportsForStation, calculateStatus]);

  // Check for 30-mile alerts
  useEffect(() => {
    if (!enabled || stationsOnRoute.length === 0) return;

    console.log('[WEIGH_ALERT] Checking', stationsOnRoute.length, 'stations on route');
    
    for (const stationOnRoute of stationsOnRoute) {
      const distanceMiles = stationOnRoute.distanceAlongRouteM / MILES_TO_METERS;
      
      console.log('[WEIGH_ALERT] Station:', stationOnRoute.station.name, 
        'at', distanceMiles.toFixed(1), 'miles,',
        'status:', stationOnRoute.status,
        'alerted:', alertedStationIds.has(stationOnRoute.station.id));
      
      // Check if within 30 miles and not yet alerted
      if (distanceMiles <= ALERT_DISTANCE_MILES && !alertedStationIds.has(stationOnRoute.station.id)) {
        console.log('[WEIGH_ALERT] Triggering 30-mile alert for:', stationOnRoute.station.name);
        setPendingAlert(stationOnRoute);
        setAlertedStationIds(prev => new Set([...prev, stationOnRoute.station.id]));
        break; // Only one alert at a time
      }
    }
  }, [enabled, stationsOnRoute, alertedStationIds]);

  // Geofence monitoring for passage detection
  useEffect(() => {
    if (!enabled || !userLat || !userLng || stationsOnRoute.length === 0) return;

    const newGeofenceStates = new Map(geofenceStates);

    for (const stationOnRoute of stationsOnRoute) {
      const distance = haversineDistance(
        userLat,
        userLng,
        stationOnRoute.station.lat,
        stationOnRoute.station.lng
      );

      const stationId = stationOnRoute.station.id;
      const currentState = newGeofenceStates.get(stationId) || {
        isInside: false,
        enteredAt: null,
        exitedAt: null,
        hasPassedThrough: false,
      };

      const isInsideNow = distance <= GEOFENCE_RADIUS_M;

      if (isInsideNow && !currentState.isInside) {
        // Just entered
        console.log('[WEIGH_ALERT] Entered geofence:', stationOnRoute.station.name);
        newGeofenceStates.set(stationId, {
          ...currentState,
          isInside: true,
          enteredAt: Date.now(),
        });
      } else if (!isInsideNow && currentState.isInside && currentState.enteredAt) {
        // Just exited after being inside
        console.log('[WEIGH_ALERT] Exited geofence:', stationOnRoute.station.name);
        
        if (!currentState.hasPassedThrough) {
          // Trigger questionnaire
          setStationToReport(stationOnRoute);
        }

        newGeofenceStates.set(stationId, {
          ...currentState,
          isInside: false,
          exitedAt: Date.now(),
          hasPassedThrough: true,
        });
      }
    }

    setGeofenceStates(newGeofenceStates);
  }, [enabled, userLat, userLng, stationsOnRoute]);

  // Clear pending alert
  const dismissAlert = useCallback(() => {
    setPendingAlert(null);
  }, []);

  // Clear station to report (after questionnaire)
  const dismissReportPrompt = useCallback(() => {
    setStationToReport(null);
  }, []);

  // Get next station on route
  const nextStation = useMemo(() => {
    return stationsOnRoute.length > 0 ? stationsOnRoute[0] : null;
  }, [stationsOnRoute]);

  // Open station details
  const openStationDetails = useCallback((station: StationOnRoute | null) => {
    setSelectedStation(station);
  }, []);

  // Close station details
  const closeStationDetails = useCallback(() => {
    setSelectedStation(null);
  }, []);

  // Refresh reports for a station
  const refreshStationReports = useCallback(async (stationId: string) => {
    // Clear cache to force refresh
    reportsCache.current.delete(stationId);
    const reports = await fetchReportsForStation(stationId);
    
    // Update the station in the list
    setStationsOnRoute(prev => prev.map(s => {
      if (s.station.id === stationId) {
        const { status, lastUpdatedAt } = calculateStatus(reports);
        return { ...s, recentReports: reports, status, lastUpdatedAt };
      }
      return s;
    }));

    // Update selected station if it's the same
    if (selectedStation?.station.id === stationId) {
      const { status, lastUpdatedAt } = calculateStatus(reports);
      setSelectedStation(prev => prev ? { ...prev, recentReports: reports, status, lastUpdatedAt } : null);
    }
  }, [fetchReportsForStation, calculateStatus, selectedStation]);

  return {
    stations,
    stationsOnRoute,
    nextStation,
    pendingAlert,
    dismissAlert,
    stationToReport,
    dismissReportPrompt,
    selectedStation,
    openStationDetails,
    closeStationDetails,
    refreshStationReports,
    routeHash: currentRouteHash,
  };
}
