import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import { useActiveNavigation, type UserPosition } from '@/contexts/ActiveNavigationContext';
import { useVoiceGuidance } from '@/hooks/useVoiceGuidance';
import { useRouteSimulation } from '@/hooks/useRouteSimulation';
import { useArrivalDetection, type DetectedPoi } from '@/hooks/useArrivalDetection';
import { useAdvancedMapMatching, type MatchedPosition } from '@/hooks/useAdvancedMapMatching';
import { useSmoothCursor, type CursorPosition } from '@/hooks/useSmoothCursor';
import { useMapPerformance } from '@/hooks/useMapPerformance';
import { useWeighStationAlerts } from '@/hooks/useWeighStationAlerts';
import { useSpeedAlerts } from '@/hooks/useSpeedAlerts';
import { useSpeedLimit } from '@/hooks/useSpeedLimit';
import { useSpeedingAlertSound } from '@/hooks/useSpeedingAlertSound';
import { ALERT_TYPE_CONFIG, SpeedAlertType } from '@/types/speedAlerts';
import NavigationHUD from './NavigationHUD';
import SpeedIndicator from './SpeedIndicator';
import BottomETABar from './BottomETABar';
import VoiceControls from './VoiceControls';
import SimulationControls from './SimulationControls';
import LocationContextBar from './LocationContextBar';
import NearbyPoisOverlay from './NearbyPoisOverlay';
import ArrivalPrompt from './ArrivalPrompt';
import ArrivalDebugPanel from './ArrivalDebugPanel';
import LaneGuidancePanel from './LaneGuidancePanel';
import SpeedAlertOverlay from './SpeedAlertOverlay';
import SpeedAlertDetailsSheet from './SpeedAlertDetailsSheet';
import ReportAlertButton from './ReportAlertButton';
import TrafficLightOverlay from './TrafficLightOverlay';
import { createTruckCursorElement } from './TruckCursor';
import EngineIndicator from './EngineIndicator';
import { MapPin, Navigation as NavIcon, RotateCcw, Layers, Bug, Plus, Route, Utensils } from 'lucide-react';
import WeighStationOverlay from '@/components/weighstation/WeighStationOverlay';
import WeighStationAlert from '@/components/weighstation/WeighStationAlert';
import WeighStationBottomSheet from '@/components/weighstation/WeighStationBottomSheet';
import WeighStationQuestionnaire from '@/components/weighstation/WeighStationQuestionnaire';
import { useGeofence } from '@/contexts/GeofenceContext';
import { usePoiFeedback } from '@/contexts/PoiFeedbackContext';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n/LanguageContext';

// === SPEED ALERT ICON HELPER ===
function getSpeedAlertIconSvg(type: SpeedAlertType): string {
  const iconColor = 'white';
  const size = 18;
  
  switch (type) {
    case 'speed_camera':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>`;
    case 'red_light_camera':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="6" height="14" x="9" y="7" rx="1"/><circle cx="12" cy="10" r="1" fill="${iconColor}"/><circle cx="12" cy="14" r="1" fill="${iconColor}"/><circle cx="12" cy="18" r="1" fill="${iconColor}"/><path d="M4 11h5"/><path d="M15 11h5"/><path d="M12 2v5"/></svg>`;
    case 'mobile_patrol':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>`;
    case 'enforcement_zone':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>`;
    case 'school_zone':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"/></svg>`;
    case 'construction_zone':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="8" rx="1"/><path d="M17 14v7"/><path d="M7 14v7"/><path d="M17 3v3"/><path d="M7 3v3"/><path d="M10 14L2.3 6.3"/><path d="M14 6l7.7 7.7"/><path d="M8 6l8 8"/></svg>`;
    case 'average_speed':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg>`;
    case 'weigh_station':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>`;
    default:
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>`;
  }
}

// === PERFORMANCE CONSTANTS ===
// Minimum speed (m/s) to apply heading rotation - ~2 km/h
const MIN_SPEED_FOR_HEADING = 0.5;

// Minimum bearing change to trigger update (degrees)
const MIN_BEARING_CHANGE = 2;

// Heading smoothing factor (0-1, lower = smoother but more latency)
const HEADING_SMOOTH_FACTOR = 0.15;

// Maximum allowed heading change per second (degrees) to filter outliers
const MAX_HEADING_CHANGE_PER_SEC = 90;

// Debug state for orientation
interface OrientationDebug {
  speed: number;
  gpsAccuracy: number | null;
  calculatedBearing: number | null;
  routeBearing: number | null;
  gpsHeading: number | null;
  appliedCameraBearing: number;
  headingSource: 'calculated' | 'route' | 'gps' | 'simulation' | 'none';
  lastUpdate: number;
}

// Calculate bearing between two GPS points (returns degrees 0-360, 0 = North, clockwise)
// Standard formula: https://www.movable-type.co.uk/scripts/latlong.html
function calculateBearingBetweenPoints(
  lat1: number, 
  lon1: number, 
  lat2: number, 
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const λ1 = toRad(lon1);
  const λ2 = toRad(lon2);
  const Δλ = λ2 - λ1;
  
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  
  const θ = Math.atan2(y, x);
  let bearing = toDeg(θ);
  
  // Normalize to 0-360 (North = 0, East = 90, South = 180, West = 270)
  bearing = ((bearing % 360) + 360) % 360;
  
  return bearing;
}

// Calculate shortest angular difference (handles wraparound)
function angularDifference(a: number, b: number): number {
  let diff = b - a;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return diff;
}

// Smooth interpolation between angles with circular wraparound
function smoothAngle(current: number, target: number, factor: number): number {
  const diff = angularDifference(current, target);
  const newAngle = current + diff * factor;
  return ((newAngle % 360) + 360) % 360;
}

// Calculate bearing difference (absolute, shortest path)
function bearingDifference(a: number, b: number): number {
  return Math.abs(angularDifference(a, b));
}

const ActiveNavigationView = () => {
  const { t } = useLanguage();
  const {
    route,
    routeCoords,
    destination,
    userPosition,
    progress,
    endNavigation,
    navigateToPoi,
    addDetourStop,
    hasActiveTrip,
    isOnDetour,
    detourStop,
    positionError,
    isRerouting,
    isOffRoute,
    isSimulating,
    setSimulatedPosition,
    setIsSimulating,
  } = useActiveNavigation();

  const voice = useVoiceGuidance();
  const voiceRef = useRef(voice);
  
  // Food suggestion context
  const { currentVisitedPoi, isShowingFoodSuggestion } = usePoiFeedback();

  useEffect(() => {
    voiceRef.current = voice;
  }, [voice]);

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const userMarker = useRef<mapboxgl.Marker | null>(null);
  const destMarker = useRef<mapboxgl.Marker | null>(null);
  const speedAlertMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const [mapReady, setMapReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followUser, setFollowUser] = useState(true);
  const [mapStyle, setMapStyle] = useState<'satellite' | 'streets' | 'navigation'>('satellite');
  const mapInitialized = useRef(false);
  const lastVoiceInstructionIndex = useRef<number>(-1);
  
  // Location context state
  const [locationContext, setLocationContext] = useState<{ roadName?: string; cityState?: string }>({});
  
  // Selected speed alert for details sheet
  const [selectedSpeedAlert, setSelectedSpeedAlert] = useState<typeof speedAlerts.alerts[0] | null>(null);
  const [speedAlertDetailsOpen, setSpeedAlertDetailsOpen] = useState(false);
  
  // Heading interpolation refs
  const currentBearingRef = useRef<number>(0);
  const targetBearingRef = useRef<number>(0);
  const bearingAnimationRef = useRef<number | null>(null);
  
  // Position history for bearing calculation
  const positionHistoryRef = useRef<{ lat: number; lng: number; time: number }[]>([]);
  const lastAppliedBearingRef = useRef<number>(0);
  
  // Debug state
  const [showDebug, setShowDebug] = useState(false);
  const [debugInfo, setDebugInfo] = useState<OrientationDebug>({
    speed: 0,
    gpsAccuracy: null,
    calculatedBearing: null,
    routeBearing: null,
    gpsHeading: null,
    appliedCameraBearing: 0,
    headingSource: 'none',
    lastUpdate: Date.now(),
  });

  // Nearby POIs for arrival detection (populated by NearbyPoisOverlay callback)
  const [nearbyPois, setNearbyPois] = useState<DetectedPoi[]>([]);

  // Map performance optimization
  const mapPerf = useMapPerformance();

  // Advanced map matching - snaps GPS position to route
  const mapMatching = useAdvancedMapMatching();
  
  // Process position through map matching
  const matchedPosition = useMemo((): MatchedPosition | null => {
    if (!userPosition || routeCoords.length < 2) return null;
    
    return mapMatching.processPosition({
      lat: userPosition.lat,
      lng: userPosition.lng,
      accuracy: userPosition.accuracy,
      heading: userPosition.heading,
      speed: userPosition.speed,
      timestamp: Date.now(),
    }, routeCoords);
  }, [userPosition, routeCoords, mapMatching]);
  
  // Convert matched position to cursor input
  const cursorInput = useMemo((): CursorPosition | null => {
    if (!matchedPosition) return null;
    return {
      lat: matchedPosition.snappedLat,
      lng: matchedPosition.snappedLng,
      heading: matchedPosition.heading,
      speed: matchedPosition.speed,
      timestamp: matchedPosition.timestamp,
    };
  }, [matchedPosition]);
  
  // 60fps smooth cursor animation
  const renderCursor = useSmoothCursor(cursorInput, true);
  
  // Reset map matching when route changes
  useEffect(() => {
    mapMatching.reset();
  }, [route?.polyline, mapMatching]);

  // Weigh station alerts with route-based detection
  const weighStationAlerts = useWeighStationAlerts({
    userLat: userPosition?.lat ?? null,
    userLng: userPosition?.lng ?? null,
    routeCoords,
    enabled: true,
  });

  // Speed alerts (cameras, enforcement zones, etc.)
  const speedAlerts = useSpeedAlerts({
    lat: userPosition?.lat ?? null,
    lng: userPosition?.lng ?? null,
    heading: debugInfo.calculatedBearing ?? userPosition?.heading ?? null,
    speedMph: userPosition?.speed ? userPosition.speed * 2.237 : 0,
    enabled: true,
  });

  // Current road speed limit
  const currentSpeedLimit = useSpeedLimit({
    lat: userPosition?.lat ?? null,
    lng: userPosition?.lng ?? null,
    heading: debugInfo.calculatedBearing ?? userPosition?.heading ?? null,
    enabled: true,
  });


  // Arrival detection hook
  const arrival = useArrivalDetection({
    lat: userPosition?.lat ?? null,
    lng: userPosition?.lng ?? null,
    speed: userPosition?.speed ?? null,
    accuracy: userPosition?.accuracy ?? null,
    pois: nearbyPois,
    enabled: true,
  });

  // Simulation hook
  const simulation = useRouteSimulation(routeCoords, (pos) => {
    setSimulatedPosition(pos);
  });

  // Handle simulation start/stop
  const handleStartSimulation = useCallback(() => {
    setIsSimulating(true);
    simulation.startSimulation();
  }, [setIsSimulating, simulation]);

  const handleStopSimulation = useCallback(() => {
    setIsSimulating(false);
    simulation.stopSimulation();
    setSimulatedPosition(null);
  }, [setIsSimulating, simulation, setSimulatedPosition]);

  // Current instruction
  const currentInstruction = useMemo(() => {
    return route && progress ? route.instructions[progress.currentInstructionIndex] : null;
  }, [route, progress?.currentInstructionIndex]);

  // Speed in MPH
  const speedMph = useMemo(() => {
    if (!userPosition?.speed) return null;
    return userPosition.speed * 2.237; // m/s to mph
  }, [userPosition?.speed]);

  // Effective speed limit (alert zone takes priority over road limit)
  const effectiveSpeedLimit = speedAlerts.criticalAlert?.speedLimit ?? currentSpeedLimit.speedLimitMph;

  // Speeding alert sounds (alerts once per speeding event, in user's language)
  const { language } = useLanguage();
  const speedingAlert = useSpeedingAlertSound({
    currentSpeedMph: speedMph,
    speedLimitMph: effectiveSpeedLimit ?? null,
    enabled: voice.settings.enabled,
    language,
    toleranceMph: 5,
  });

  // Voice guidance for instructions - with look-ahead based on speed
  useEffect(() => {
    if (!currentInstruction || !progress || !voice.settings.enabled) return;
    
    const dist = progress.distanceToNextManeuver;
    const idx = progress.currentInstructionIndex;
    const speedMs = matchedPosition?.speed ?? userPosition?.speed ?? 0;

    // Let the speakInstruction handle the logic with look-ahead
    voice.speakInstruction(currentInstruction, dist, idx, speedMs);
  }, [currentInstruction, progress, voice, matchedPosition?.speed, userPosition?.speed]);

  // Voice for rerouting
  useEffect(() => {
    if (isRerouting && voice.settings.enabled) {
      voice.speakRerouting();
    }
  }, [isRerouting, voice]);

  // Voice for arrival
  useEffect(() => {
    if (progress?.arrived && voice.settings.enabled) {
      voice.speakArrival();
    }
  }, [progress?.arrived, voice]);

  // Initialize map only once
  const initializeMap = useCallback(async () => {
    if (!mapContainer.current || mapInitialized.current) return;
    mapInitialized.current = true;

    try {
      const { data, error: tokenError } = await supabase.functions.invoke<{ token: string }>(
        'get_mapbox_token'
      );

      const token = data?.token;

      if (tokenError || !token) {
        console.error('[NAV_MAP] token_error', tokenError, data);
        setError('Failed to load map');
        setLoading(false);
        return;
      }

      mapboxgl.accessToken = token;

      const center: [number, number] = userPosition
        ? [userPosition.lng, userPosition.lat]
        : routeCoords.length > 0
        ? routeCoords[0]
        : [-46.6333, -23.5505];

      // Ensure container is empty (prevents Mapbox warnings/flicker if remounted)
      mapContainer.current.innerHTML = '';

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/satellite-streets-v12',
        zoom: 16,
        center,
        pitch: 45,
        bearing: 0,
      });

      const markReady = () => {
        setMapReady(true);
        setLoading(false);
      };

      const drawInitialRoute = () => {
        if (!map.current || routeCoords.length === 0) return;

        const geojson: GeoJSON.Feature = {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: routeCoords,
          },
        };

        if (!map.current.getSource('nav-route')) {
          map.current.addSource('nav-route', { type: 'geojson', data: geojson });
          map.current.addLayer({
            id: 'nav-route',
            type: 'line',
            source: 'nav-route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#3b82f6', 'line-width': 6, 'line-opacity': 0.9 },
          });
        }
      };

      map.current.once('load', () => {
        markReady();
        drawInitialRoute();
      });

      // Some environments emit 'idle' before 'load'
      map.current.once('idle', () => {
        markReady();
        drawInitialRoute();
      });

      map.current.on('error', (e) => {
        console.error('[NAV_MAP] mapbox_error', e);
        setError('Map loading error');
        setLoading(false);
      });

      // Disable follow when user drags
      map.current.on('dragstart', () => {
        setFollowUser(false);
      });
    } catch (e) {
      console.error('[NAV_MAP] init_failed', e);
      setError('Failed to initialize map');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initializeMap();

    return () => {
      voiceRef.current.stop();
      userMarker.current?.remove();
      destMarker.current?.remove();
      map.current?.remove();
      map.current = null;
      mapInitialized.current = false;
      if (mapContainer.current) mapContainer.current.innerHTML = '';
    };
  }, [initializeMap]);

  // Update route source if routeCoords change (e.g., after reroute)
  useEffect(() => {
    if (!map.current || !mapReady || routeCoords.length === 0) return;

    const source = map.current.getSource('nav-route') as mapboxgl.GeoJSONSource | undefined;
    if (source) {
      const geojson: GeoJSON.Feature = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: routeCoords,
        },
      };
      source.setData(geojson);
    }
  }, [routeCoords, mapReady]);

  // Update user marker & camera with smooth cursor animation
  // Use refs to avoid re-render triggers from animation
  const lastCameraUpdateRef = useRef<number>(0);
  const markerUpdateRef = useRef<number>(0);
  const pitchIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const CAMERA_UPDATE_INTERVAL = 50; // 50ms for smooth camera updates (~20fps)
  const MARKER_UPDATE_INTERVAL = 16; // Marker at ~60fps for smooth animation
  const FIXED_PITCH = 20; // Fixed pitch for navigation view
  const FIXED_ZOOM = 15; // Fixed zoom level
  
  // Keep pitch locked with interval
  useEffect(() => {
    if (!map.current || !mapReady || !followUser) {
      if (pitchIntervalRef.current) {
        clearInterval(pitchIntervalRef.current);
        pitchIntervalRef.current = null;
      }
      return;
    }
    
    // Set up interval to keep pitch locked at 20 degrees every 50ms
    pitchIntervalRef.current = setInterval(() => {
      if (map.current && followUser) {
        map.current.setPitch(FIXED_PITCH);
      }
    }, 50);
    
    return () => {
      if (pitchIntervalRef.current) {
        clearInterval(pitchIntervalRef.current);
        pitchIntervalRef.current = null;
      }
    };
  }, [mapReady, followUser]);
  
  useEffect(() => {
    if (!map.current || !mapReady) return;
    
    // Prefer smooth cursor, fallback to matched position, then raw userPosition
    const displayLat = renderCursor?.lat ?? matchedPosition?.snappedLat ?? userPosition?.lat;
    const displayLng = renderCursor?.lng ?? matchedPosition?.snappedLng ?? userPosition?.lng;
    const displayHeading = renderCursor?.heading ?? matchedPosition?.heading ?? userPosition?.heading ?? 0;
    const displaySpeed = matchedPosition?.speed ?? userPosition?.speed ?? 0;
    
    if (displayLat === undefined || displayLng === undefined) return;

    const now = performance.now();
    const speedKmh = displaySpeed * 3.6;

    // Store heading for fallback
    if (displayHeading !== null) {
      lastAppliedBearingRef.current = displayHeading;
    }

    // Update marker position at high frequency for smooth animation
    if (now - markerUpdateRef.current >= MARKER_UPDATE_INTERVAL) {
      markerUpdateRef.current = now;
      
      if (userMarker.current) {
        userMarker.current.setLngLat([displayLng, displayLat]);
      } else if (map.current) {
        const el = createTruckCursorElement(52);
        el.style.pointerEvents = 'none';

        userMarker.current = new mapboxgl.Marker({
          element: el,
          rotationAlignment: 'viewport',
          pitchAlignment: 'viewport',
          anchor: 'center',
        })
          .setLngLat([displayLng, displayLat])
          .addTo(map.current);
      }
    }

    // Update debug info (less frequently, does not affect UI layout)
    if (now - debugInfo.lastUpdate > 500) {
      setDebugInfo({
        speed: speedKmh,
        gpsAccuracy: userPosition?.accuracy ?? null,
        calculatedBearing: displayHeading,
        routeBearing: null,
        gpsHeading: userPosition?.heading ?? null,
        appliedCameraBearing: displayHeading ?? lastAppliedBearingRef.current,
        headingSource: isSimulating ? 'simulation' : displayHeading !== null ? 'calculated' : 'none',
        lastUpdate: now,
      });
    }

    // COURSE-UP camera: jumpTo + easeTo pattern for smooth, seamless camera follow
    // jumpTo for instant center, then easeTo for smooth bearing transition
    if (followUser && now - lastCameraUpdateRef.current >= CAMERA_UPDATE_INTERVAL) {
      lastCameraUpdateRef.current = now;
      
      if (bearingAnimationRef.current) {
        cancelAnimationFrame(bearingAnimationRef.current);
        bearingAnimationRef.current = null;
      }

      const currentCoords: [number, number] = [displayLng, displayLat];
      const targetBearing = displayHeading ?? lastAppliedBearingRef.current;

      // jumpTo for instant center positioning (no animation delay)
      map.current.jumpTo({
        center: currentCoords,
        zoom: FIXED_ZOOM,
      });

      // easeTo for smooth bearing rotation with short duration
      map.current.easeTo({
        center: currentCoords,
        bearing: targetBearing,
        duration: 50, // 50ms for seamless bearing updates
      });
    }

  }, [userPosition, renderCursor, matchedPosition, mapReady, followUser, isSimulating]);

  // Destination marker
  useEffect(() => {
    if (!map.current || !mapReady || !destination) return;

    if (!destMarker.current) {
      const el = document.createElement('div');
      el.className = 'w-5 h-5 bg-red-500 rounded-full border-2 border-white shadow-lg';
      destMarker.current = new mapboxgl.Marker(el)
        .setLngLat([destination.lng, destination.lat])
        .addTo(map.current);
    }
  }, [destination, mapReady]);

  // Speed alert markers on map
  useEffect(() => {
    if (!map.current || !mapReady) return;
    
    const allAlerts = speedAlerts.alerts;
    const currentMarkers = speedAlertMarkersRef.current;
    const currentAlertIds = new Set(allAlerts.map(a => a.id));
    
    // Remove markers for alerts no longer in list
    currentMarkers.forEach((marker, id) => {
      if (!currentAlertIds.has(id)) {
        marker.remove();
        currentMarkers.delete(id);
      }
    });
    
    // Add or update markers for current alerts
    allAlerts.forEach(alert => {
      if (currentMarkers.has(alert.id)) {
        // Update position if needed
        const marker = currentMarkers.get(alert.id)!;
        marker.setLngLat([alert.lng, alert.lat]);
        return;
      }
      
      // Create new marker
      const config = ALERT_TYPE_CONFIG[alert.type];
      const el = document.createElement('div');
      el.className = 'speed-alert-marker flex items-center justify-center';
      el.style.width = '36px';
      el.style.height = '36px';
      
      // Get icon SVG based on type
      const iconSvg = getSpeedAlertIconSvg(alert.type);
      el.innerHTML = `
        <div class="relative">
          <div class="absolute inset-0 ${config.bgColor} rounded-full opacity-40 animate-ping" style="animation-duration: 2s;"></div>
          <div class="${config.bgColor} rounded-full p-1.5 shadow-lg border-2 border-white/80">
            ${iconSvg}
          </div>
          ${alert.speedLimit ? `
            <div class="absolute -bottom-1 -right-1 bg-white text-[10px] font-bold px-1 rounded shadow text-gray-900 border border-gray-300">
              ${alert.speedLimit}
            </div>
          ` : ''}
          ${alert.source === 'user' ? `
            <div class="absolute -top-1 -left-1 bg-green-500 w-3 h-3 rounded-full border border-white"></div>
          ` : ''}
        </div>
      `;
      
      // Add click handler for interaction
      el.style.cursor = 'pointer';
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelectedSpeedAlert(alert);
        setSpeedAlertDetailsOpen(true);
      });
      
      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([alert.lng, alert.lat])
        .addTo(map.current!);
      
      currentMarkers.set(alert.id, marker);
    });
    
    return () => {
      // Cleanup on unmount
      currentMarkers.forEach(marker => marker.remove());
      currentMarkers.clear();
    };
  }, [speedAlerts.alerts, mapReady]);

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Map */}
      <div ref={mapContainer} className="absolute inset-0" />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-40">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Determine if current maneuver is an exit/ramp within lane guidance distance */}
      {(() => {
        const isExitManeuver = currentInstruction?.instruction?.toLowerCase().includes('exit') ||
          currentInstruction?.instruction?.toLowerCase().includes('ramp') ||
          !!currentInstruction?.exitInfo;
        const isWithinLaneGuidanceDistance = progress && progress.distanceToNextManeuver <= 1609; // 1 mile
        const showLaneGuidance = isExitManeuver && isWithinLaneGuidanceDistance;
        
        return (
          <>
            {/* Lane Guidance Panel - shows when approaching exit within 1 mile */}
            {route && progress && showLaneGuidance && (
              <LaneGuidancePanel
                instruction={currentInstruction}
                distanceToManeuver={progress.distanceToNextManeuver}
                instructions={route.instructions}
                currentInstructionIndex={progress.currentInstructionIndex}
                visible={true}
              />
            )}

            {/* HUD - Top Left (Trucker Path style) - shows ALWAYS unless Lane Guidance is showing */}
            {route && progress && !showLaneGuidance && (
              <NavigationHUD
                currentInstruction={currentInstruction}
                distanceToNextManeuver={progress.distanceToNextManeuver}
                instructions={route.instructions}
                currentInstructionIndex={progress.currentInstructionIndex}
                onRepeat={voice.repeatLastInstruction}
              />
            )}
          </>
        );
      })()}

      {/* Nearby POIs Overlay - Left side */}
      <NearbyPoisOverlay
        lat={userPosition?.lat ?? null}
        lng={userPosition?.lng ?? null}
        heading={debugInfo.calculatedBearing ?? userPosition?.heading ?? null}
        hasActiveTrip={hasActiveTrip}
        onPoisUpdate={setNearbyPois}
        onNavigateTo={(poi) => navigateToPoi({
          lat: poi.lat,
          lng: poi.lng,
          name: poi.chainName || poi.name,
          address: poi.address,
        })}
        onAddDetour={(poi) => addDetourStop({
          lat: poi.lat,
          lng: poi.lng,
          name: poi.chainName || poi.name,
          address: poi.address,
        })}
      />

      {/* Camera monitoring removed per user request */}

      {/* Speed Indicator + Engine Indicator - Bottom Left */}
      <div className="absolute bottom-24 left-4 z-30 flex flex-col gap-2">
        <SpeedIndicator 
          speedMph={speedMph} 
          speedLimitMph={
            // Priority: 1) Speed alert zone limit, 2) Current road limit from API, 3) null
            speedAlerts.criticalAlert?.speedLimit ?? 
            currentSpeedLimit.speedLimitMph ?? 
            null
          } 
        />
        <EngineIndicator />
      </div>

      {/* Bottom ETA Bar */}
      {route && progress && (
        <BottomETABar
          remainingDistance={progress.remainingDistance}
          remainingDuration={progress.remainingDuration}
          roadName={currentInstruction?.roadName}
          cityState={locationContext.cityState}
          onEndNavigation={endNavigation}
        />
      )}

      {/* Right side buttons */}
      <div className="absolute top-4 right-4 z-30 flex flex-col gap-2 safe-top">
        {/* Weigh Station Overlay - shows next station on route */}
        <WeighStationOverlay
          nextStation={weighStationAlerts.nextStation}
          onPress={() => weighStationAlerts.openStationDetails(weighStationAlerts.nextStation)}
        />
        
        {/* Map style toggle */}
        <Button
          variant="secondary"
          size="icon"
          className="rounded-full shadow-lg w-12 h-12"
          onClick={() => {
            const styles = {
              satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
              streets: 'mapbox://styles/mapbox/streets-v12',
              navigation: 'mapbox://styles/mapbox/navigation-night-v1',
            };
            const order: Array<'satellite' | 'streets' | 'navigation'> = ['satellite', 'streets', 'navigation'];
            const nextIndex = (order.indexOf(mapStyle) + 1) % order.length;
            const nextStyle = order[nextIndex];
            setMapStyle(nextStyle);
            if (map.current) {
              map.current.setStyle(styles[nextStyle]);
              map.current.once('style.load', () => {
                if (map.current && routeCoords.length > 0) {
                  const geojson: GeoJSON.Feature = {
                    type: 'Feature',
                    properties: {},
                    geometry: { type: 'LineString', coordinates: routeCoords },
                  };
                  if (!map.current.getSource('nav-route')) {
                    map.current.addSource('nav-route', { type: 'geojson', data: geojson });
                    map.current.addLayer({
                      id: 'nav-route',
                      type: 'line',
                      source: 'nav-route',
                      layout: { 'line-join': 'round', 'line-cap': 'round' },
                      paint: { 'line-color': '#3b82f6', 'line-width': 6, 'line-opacity': 0.9 },
                    });
                  }
                }
              });
            }
          }}
        >
          <Layers className="w-5 h-5" />
        </Button>
        
        {/* Add report button */}
        <Button
          variant="secondary"
          size="icon"
          className="rounded-full shadow-lg w-12 h-12"
        >
          <Plus className="w-5 h-5" />
        </Button>
        
        {/* Food suggestions indicator - shows when at a POI */}
        {currentVisitedPoi && !isShowingFoodSuggestion && (
          <Button
            variant="default"
            size="icon"
            className="rounded-full shadow-lg w-12 h-12 bg-green-600 hover:bg-green-700"
            onClick={() => {
              // Force show food suggestions by navigating to stop advisor
              window.location.href = '/stop-advisor';
            }}
          >
            <Utensils className="w-5 h-5" />
          </Button>
        )}
        
        {/* Debug toggle button */}
        <Button
          variant={showDebug ? "default" : "secondary"}
          size="icon"
          className="rounded-full shadow-lg w-12 h-12"
          onClick={() => setShowDebug(!showDebug)}
        >
          <Bug className="w-5 h-5" />
        </Button>
      </div>

      {/* Arrival Prompt */}
      {arrival.arrivalState.isArrived && arrival.arrivalState.poi && (
        <ArrivalPrompt
          poi={arrival.arrivalState.poi}
          onDismiss={() => arrival.dismissArrival(false)}
          onSnooze={() => arrival.dismissArrival(true)}
          onComplete={() => arrival.markHandled()}
        />
      )}

      {/* Arrival Detection Debug */}
      <ArrivalDebugPanel
        debug={arrival.debugInfo}
        visible={showDebug}
      />

      {/* Rerouting indicator */}
      {isRerouting && (
        <div className="absolute top-20 inset-x-4 z-40 bg-orange-500 text-white p-3 rounded-lg text-center flex items-center justify-center gap-2">
          <RotateCcw className="w-5 h-5 animate-spin" />
          <span className="font-medium">Rerouting...</span>
        </div>
      )}

      {/* Voice Controls */}
      <VoiceControls
        settings={voice.settings}
        voiceState={voice.voiceState}
        onToggle={voice.toggleVoice}
        onUpdateSettings={voice.updateSettings}
        onUnlockVoice={voice.unlockVoice}
      />

      {/* Simulation Controls */}
      <SimulationControls
        isSimulating={isSimulating}
        isPaused={simulation.isPaused}
        progress={simulation.progress}
        speed={simulation.speed}
        onStart={handleStartSimulation}
        onStop={handleStopSimulation}
        onPause={simulation.pauseSimulation}
        onResume={simulation.resumeSimulation}
        onSpeedChange={simulation.setSpeed}
      />

      {/* Orientation Debug Overlay */}
      {showDebug && (
        <div className="absolute top-48 left-4 z-40 bg-black/80 text-white text-xs p-3 rounded-lg font-mono space-y-1 max-w-[200px]">
          <div className="font-bold text-yellow-400 mb-2">🧭 Orientation Debug</div>
          <div>Speed: <span className="text-green-400">{debugInfo.speed.toFixed(1)} km/h</span></div>
          <div>GPS Acc: <span className="text-blue-400">{debugInfo.gpsAccuracy?.toFixed(0) ?? 'N/A'} m</span></div>
          <div className="border-t border-gray-600 pt-1 mt-1">
            <div>Calc Bearing: <span className="text-orange-400">{debugInfo.calculatedBearing?.toFixed(1) ?? 'N/A'}°</span></div>
            <div>GPS Heading: <span className="text-purple-400">{debugInfo.gpsHeading?.toFixed(1) ?? 'N/A'}°</span></div>
          </div>
          <div className="border-t border-gray-600 pt-1 mt-1">
            <div>Camera Bearing: <span className="text-cyan-400">{debugInfo.appliedCameraBearing.toFixed(1)}°</span></div>
            <div>Source: <span className={debugInfo.headingSource === 'calculated' ? 'text-green-400' : debugInfo.headingSource === 'gps' ? 'text-yellow-400' : 'text-gray-400'}>{debugInfo.headingSource}</span></div>
          </div>
        </div>
      )}

      {/* Re-center button */}
      {!followUser && (
        <Button
          className="absolute bottom-32 right-4 z-30 rounded-full shadow-lg bg-primary"
          size="icon"
          onClick={() => {
            setFollowUser(true);
            if (userPosition?.heading !== null && userPosition?.heading !== undefined) {
              currentBearingRef.current = userPosition.heading;
              targetBearingRef.current = userPosition.heading;
            }
          }}
        >
          <NavIcon className="w-5 h-5" />
        </Button>
      )}

      {/* Off route warning */}
      {isOffRoute && !isRerouting && (
        <div className="absolute bottom-32 inset-x-4 z-30 bg-orange-500 text-white p-3 rounded-lg text-center text-sm">
          You are off route. Calculating new route...
        </div>
      )}

      {/* Position error */}
      {positionError && !isSimulating && (
        <div className="absolute bottom-8 inset-x-4 z-30 bg-destructive text-destructive-foreground p-3 rounded-lg text-center text-sm">
          {positionError}
        </div>
      )}

      {/* Weigh Station 50-mile Alert */}
      {weighStationAlerts.pendingAlert && (
        <WeighStationAlert
          station={weighStationAlerts.pendingAlert}
          onDismiss={weighStationAlerts.dismissAlert}
        />
      )}

      {/* Weigh Station Bottom Sheet */}
      {weighStationAlerts.selectedStation && (
        <WeighStationBottomSheet
          station={weighStationAlerts.selectedStation}
          onClose={weighStationAlerts.closeStationDetails}
          onRefresh={() => weighStationAlerts.refreshStationReports(weighStationAlerts.selectedStation!.station.id)}
        />
      )}

      {/* Weigh Station Post-Passage Questionnaire */}
      {weighStationAlerts.stationToReport && userPosition && (
        <WeighStationQuestionnaire
          station={weighStationAlerts.stationToReport}
          userLat={userPosition.lat}
          userLng={userPosition.lng}
          routeHash={weighStationAlerts.routeHash}
          onComplete={weighStationAlerts.dismissReportPrompt}
          onSkip={weighStationAlerts.dismissReportPrompt}
        />
      )}

      {/* Arrived overlay */}
      {progress?.arrived && (
        <div className="absolute inset-0 z-40 bg-background/90 flex flex-col items-center justify-center p-6 text-center">
          <MapPin className="w-16 h-16 text-primary mb-4" />
          <h2 className="text-2xl font-bold mb-2">
            {t.navigation?.arrived || 'You have arrived!'}
          </h2>
          <p className="text-muted-foreground mb-6">{destination?.title}</p>
          <Button onClick={endNavigation}>
            {t.navigation?.endNavigation || 'End Navigation'}
          </Button>
        </div>
      )}
    </div>
  );
};

export default ActiveNavigationView;
