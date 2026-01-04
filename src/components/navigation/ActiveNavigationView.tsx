import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import { useActiveNavigation, type UserPosition } from '@/contexts/ActiveNavigationContext';
import { useVoiceGuidance } from '@/hooks/useVoiceGuidance';
import { useRouteSimulation } from '@/hooks/useRouteSimulation';
import { useArrivalDetection, type DetectedPoi } from '@/hooks/useArrivalDetection';
import { useSmoothPosition } from '@/hooks/useSmoothPosition';
import NavigationHUD from './NavigationHUD';
import SpeedIndicator from './SpeedIndicator';
import BottomETABar from './BottomETABar';
import VoiceControls from './VoiceControls';
import SimulationControls from './SimulationControls';
import LocationContextBar from './LocationContextBar';
import NearbyPoisOverlay from './NearbyPoisOverlay';
import ArrivalPrompt from './ArrivalPrompt';
import ArrivalDebugPanel from './ArrivalDebugPanel';
import { createTruckCursorElement } from './TruckCursor';
import { MapPin, Navigation as NavIcon, RotateCcw, Layers, Bug, Plus, Route } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n/LanguageContext';

// Minimum speed (m/s) to apply heading rotation - ~3 km/h = 0.83 m/s (lowered for responsiveness)
const MIN_SPEED_FOR_HEADING = 0.8;

// Minimum bearing change to trigger update (degrees) - lowered for smoother following
const MIN_BEARING_CHANGE = 5;

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
    positionError,
    isRerouting,
    isOffRoute,
    isSimulating,
    setSimulatedPosition,
    setIsSimulating,
  } = useActiveNavigation();

  const voice = useVoiceGuidance();
  const voiceRef = useRef(voice);

  useEffect(() => {
    voiceRef.current = voice;
  }, [voice]);

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const userMarker = useRef<mapboxgl.Marker | null>(null);
  const destMarker = useRef<mapboxgl.Marker | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followUser, setFollowUser] = useState(true);
  const [mapStyle, setMapStyle] = useState<'satellite' | 'streets' | 'navigation'>('satellite');
  const mapInitialized = useRef(false);
  const lastVoiceInstructionIndex = useRef<number>(-1);
  
  // Location context state
  const [locationContext, setLocationContext] = useState<{ roadName?: string; cityState?: string }>({});
  
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

  // Smooth position for marker rendering (eliminates GPS jitter)
  const smoothedPosition = useSmoothPosition(userPosition, {
    alpha: 0.25, // Moderate smoothing
    minDistanceThreshold: 2, // 2 meters minimum movement
    maxAge: 5000,
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

  // Voice guidance for instructions - with look-ahead based on speed
  useEffect(() => {
    if (!currentInstruction || !progress || !voice.settings.enabled) return;
    
    const dist = progress.distanceToNextManeuver;
    const idx = progress.currentInstructionIndex;
    const speedMs = smoothedPosition?.smoothedSpeed ?? userPosition?.speed ?? 0;

    // Let the speakInstruction handle the logic with look-ahead
    voice.speakInstruction(currentInstruction, dist, idx, speedMs);
  }, [currentInstruction, progress, voice, smoothedPosition?.smoothedSpeed, userPosition?.speed]);

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

  // Smoothed heading ref for continuous interpolation
  const smoothedHeadingRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);

  // Update user marker & camera with COURSE-UP orientation (using smoothed/predicted position)
  useEffect(() => {
    if (!map.current || !mapReady || !userPosition) return;

    // Use predicted position for smoothest marker movement (dead reckoning)
    const displayLat = smoothedPosition?.predictedLat ?? smoothedPosition?.interpolatedLat ?? userPosition.lat;
    const displayLng = smoothedPosition?.predictedLng ?? smoothedPosition?.interpolatedLng ?? userPosition.lng;
    const displaySpeed = smoothedPosition?.smoothedSpeed ?? userPosition.speed ?? 0;

    const now = Date.now();
    const deltaTime = now - lastUpdateTimeRef.current;
    lastUpdateTimeRef.current = now;
    const speedKmh = displaySpeed * 3.6;
    
    // Add position to history for bearing calculation
    positionHistoryRef.current.push({
      lat: userPosition.lat,
      lng: userPosition.lng,
      time: now,
    });
    
    // Keep only last 8 positions, max 3 seconds old (shorter window for current direction)
    positionHistoryRef.current = positionHistoryRef.current.filter(
      p => now - p.time < 3000
    ).slice(-8);
    
    // Calculate bearing from RECENT position change (last 2 points with meaningful distance)
    let calculatedBearing: number | null = null;
    let movementSpeedEstimate: number | null = null;
    let movementDistanceM: number | null = null;
    const history = positionHistoryRef.current;

    // Use the two most recent points with sufficient distance apart
    if (history.length >= 2) {
      const newest = history[history.length - 1];

      // Find the oldest point that is at least 2 meters away
      for (let i = history.length - 2; i >= 0; i--) {
        const older = history[i];

        const distanceMoved = Math.sqrt(
          Math.pow((newest.lat - older.lat) * 111000, 2) +
            Math.pow(
              (newest.lng - older.lng) * 111000 * Math.cos((newest.lat * Math.PI) / 180),
              2
            )
        );

        const dtSec = Math.max(0.001, (newest.time - older.time) / 1000);

        if (distanceMoved >= 2) {
          calculatedBearing = calculateBearingBetweenPoints(
            older.lat,
            older.lng,
            newest.lat,
            newest.lng
          );
          movementDistanceM = distanceMoved;
          movementSpeedEstimate = distanceMoved / dtSec;
          break;
        }
      }
    }

    // Calculate bearing from route segment as fallback
    let routeBearing: number | null = null;
    if (routeCoords.length >= 2 && progress) {
      // Find closest point on route
      let minDist = Infinity;
      let closestIdx = 0;

      for (let i = 0; i < routeCoords.length; i++) {
        const [lng, lat] = routeCoords[i];
        const dist = Math.sqrt(
          Math.pow((userPosition.lat - lat) * 111000, 2) +
            Math.pow(
              (userPosition.lng - lng) * 111000 * Math.cos((userPosition.lat * Math.PI) / 180),
              2
            )
        );
        if (dist < minDist) {
          minDist = dist;
          closestIdx = i;
        }
      }

      // Use bearing of next segment on route
      if (closestIdx < routeCoords.length - 1) {
        const [lng1, lat1] = routeCoords[closestIdx];
        const [lng2, lat2] = routeCoords[closestIdx + 1];
        routeBearing = calculateBearingBetweenPoints(lat1, lng1, lat2, lng2);
      }
    }

    // Determine raw heading to use (priority: calculated (COG) > GPS heading > route)
    // IMPORTANT: On iOS Safari, `pos.coords.speed` is often null. So we rely on movement-derived speed.
    const speedForHeading =
      displaySpeed && displaySpeed > 0
        ? displaySpeed
        : movementSpeedEstimate !== null
          ? movementSpeedEstimate
          : 0;

    let rawHeading: number | null = null;
    let headingSource: 'calculated' | 'route' | 'gps' | 'simulation' | 'none' = 'none';

    // SIMULATION MODE: Use heading from simulation hook (already calculated from route segment)
    if (isSimulating && userPosition.heading !== null && userPosition.heading !== undefined) {
      rawHeading = userPosition.heading;
      headingSource = 'simulation';
    }
    // 1) Prefer calculated bearing (course over ground) when we have meaningful real movement
    else if (
      calculatedBearing !== null &&
      !isSimulating &&
      (speedForHeading > MIN_SPEED_FOR_HEADING || (movementDistanceM ?? 0) >= 10)
    ) {
      rawHeading = calculatedBearing;
      headingSource = 'calculated';
    }
    // 2) Fallback to GPS heading when moving (only when speed is available, not simulating)
    else if (userPosition.heading !== null && displaySpeed > MIN_SPEED_FOR_HEADING && !isSimulating) {
      rawHeading = userPosition.heading;
      headingSource = 'gps';
    }
    // 3) Fallback to route bearing
    else if (routeBearing !== null) {
      rawHeading = routeBearing;
      headingSource = 'route';
    }
    
    // Log heading diagnostics (throttled)
    if (now - lastUpdateTimeRef.current > 500 || headingSource === 'simulation') {
      console.log('[NAV_HEADING]', {
        isSimulating,
        speedForHeading: speedForHeading.toFixed(2),
        simHeading: userPosition.heading?.toFixed(1),
        calculatedBearing: calculatedBearing?.toFixed(1),
        routeBearing: routeBearing?.toFixed(1),
        rawHeading: rawHeading?.toFixed(1),
        headingSource,
      });
    }
    
    // Apply heading smoothing with outlier rejection
    let headingToUse: number | null = null;
    
    if (rawHeading !== null) {
      if (smoothedHeadingRef.current === null) {
        // First heading - use directly
        smoothedHeadingRef.current = rawHeading;
        headingToUse = rawHeading;
      } else {
        // Check for outlier (heading jumping too fast)
        const headingChange = Math.abs(angularDifference(smoothedHeadingRef.current, rawHeading));
        const maxChange = deltaTime > 0 ? (MAX_HEADING_CHANGE_PER_SEC * deltaTime / 1000) : MAX_HEADING_CHANGE_PER_SEC;
        
        if (headingChange > maxChange && displaySpeed > 2) {
          // Outlier detected - use stronger smoothing
          smoothedHeadingRef.current = smoothAngle(smoothedHeadingRef.current, rawHeading, HEADING_SMOOTH_FACTOR * 0.3);
        } else {
          // Normal update - apply smoothing
          smoothedHeadingRef.current = smoothAngle(smoothedHeadingRef.current, rawHeading, HEADING_SMOOTH_FACTOR);
        }
        headingToUse = smoothedHeadingRef.current;
      }
    } else if (smoothedHeadingRef.current !== null) {
      // No new heading but we have a previous one - keep using it
      headingToUse = smoothedHeadingRef.current;
    }
    
    // Create or update user marker
    if (userMarker.current) {
      userMarker.current.setLngLat([displayLng, displayLat]);
    } else {
      const el = createTruckCursorElement(52);

      // Ensure element has proper styling
      el.style.pointerEvents = 'none';

      userMarker.current = new mapboxgl.Marker({
        element: el,
        // NORTH-UP mode: map bearing stays at 0; marker rotates to match heading
        rotationAlignment: 'viewport',
        pitchAlignment: 'viewport',
        anchor: 'center',
      })
        .setLngLat([displayLng, displayLat])
        .addTo(map.current!);
    }

    // Apply marker rotation (single source of truth for orientation)
    if (headingToUse !== null) {
      userMarker.current?.setRotation(headingToUse);
    }

    // Update debug info
    setDebugInfo({
      speed: speedKmh,
      gpsAccuracy: userPosition.accuracy,
      calculatedBearing,
      routeBearing,
      gpsHeading: userPosition.heading,
      appliedCameraBearing: headingToUse ?? lastAppliedBearingRef.current,
      headingSource,
      lastUpdate: now,
    });

    // NORTH-UP camera: keep map bearing fixed (0) and only follow the user's position.
    // Orientation is handled exclusively by rotating the marker above.
    if (followUser) {
      // Cancel any leftover animation from previous versions
      if (bearingAnimationRef.current) {
        cancelAnimationFrame(bearingAnimationRef.current);
        bearingAnimationRef.current = null;
      }

      map.current.easeTo({
        center: [displayLng, displayLat],
        bearing: 0,
        pitch: 60,
        zoom: 17,
        duration: 120,
        easing: (t) => t,
      });
    }
    
    return () => {
      if (bearingAnimationRef.current) {
        cancelAnimationFrame(bearingAnimationRef.current);
      }
    };
  }, [userPosition, smoothedPosition, mapReady, followUser, routeCoords, progress]);

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

      {/* HUD - Top Left (Trucker Path style) */}
      {route && progress && (
        <NavigationHUD
          currentInstruction={currentInstruction}
          distanceToNextManeuver={progress.distanceToNextManeuver}
          onRepeat={voice.repeatLastInstruction}
        />
      )}

      {/* Nearby POIs Overlay - Left side */}
      <NearbyPoisOverlay
        lat={userPosition?.lat ?? null}
        lng={userPosition?.lng ?? null}
        heading={debugInfo.calculatedBearing ?? userPosition?.heading ?? null}
        onPoisUpdate={setNearbyPois}
      />

      {/* Speed Indicator - Bottom Left */}
      <div className="absolute bottom-24 left-4 z-30">
        <SpeedIndicator speedMph={speedMph} speedLimitMph={55} />
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
        
        {/* Route overview button */}
        <Button
          variant="secondary"
          size="icon"
          className="rounded-full shadow-lg w-12 h-12"
        >
          <Route className="w-5 h-5" />
        </Button>
        
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
