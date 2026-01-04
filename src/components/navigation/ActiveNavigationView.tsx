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

// Minimum speed (m/s) to apply heading rotation - ~5 km/h = 1.39 m/s
const MIN_SPEED_FOR_HEADING = 1.39;

// Minimum bearing change to trigger update (degrees)
const MIN_BEARING_CHANGE = 8;

// Debug state for orientation
interface OrientationDebug {
  speed: number;
  gpsAccuracy: number | null;
  calculatedBearing: number | null;
  gpsHeading: number | null;
  appliedCameraBearing: number;
  headingSource: 'calculated' | 'gps' | 'none';
  lastUpdate: number;
}

// Calculate bearing between two GPS points (returns degrees 0-360, 0 = North)
function calculateBearingBetweenPoints(
  lat1: number, 
  lon1: number, 
  lat2: number, 
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  
  const dLon = toRad(lon2 - lon1);
  const lat1Rad = toRad(lat1);
  const lat2Rad = toRad(lat2);
  
  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
            Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  
  const bearing = toDeg(Math.atan2(y, x));
  return ((bearing % 360) + 360) % 360; // Normalize to 0-360
}

// Interpolate between two angles (for smooth rotation)
function interpolateBearing(current: number, target: number, factor: number): number {
  // Normalize angles to 0-360
  current = ((current % 360) + 360) % 360;
  target = ((target % 360) + 360) % 360;
  
  // Find shortest path
  let diff = target - current;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  
  return ((current + diff * factor) + 360) % 360;
}

// Calculate bearing difference (shortest path)
function bearingDifference(a: number, b: number): number {
  let diff = Math.abs(((a - b + 180) % 360) - 180);
  return diff;
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
      const { data, error: tokenError } = await supabase.functions.invoke('get_mapbox_token');

      if (tokenError || !data?.token) {
        setError('Failed to load map');
        setLoading(false);
        return;
      }

      mapboxgl.accessToken = data.token;

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

      map.current.once('load', () => {
        setMapReady(true);
        setLoading(false);
        
        // Draw route immediately after map loads
        if (map.current && routeCoords.length > 0) {
          const geojson: GeoJSON.Feature = {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: routeCoords,
            },
          };

          map.current.addSource('nav-route', { type: 'geojson', data: geojson });
          map.current.addLayer({
            id: 'nav-route',
            type: 'line',
            source: 'nav-route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#3b82f6', 'line-width': 6, 'line-opacity': 0.9 },
          });
        }
      });

      map.current.on('error', () => {
        setError('Map loading error');
        setLoading(false);
      });

      // Disable follow when user drags
      map.current.on('dragstart', () => {
        setFollowUser(false);
      });
    } catch {
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

  // Update user marker & camera with COURSE-UP orientation (using smoothed/predicted position)
  useEffect(() => {
    if (!map.current || !mapReady || !userPosition) return;

    // Use predicted position for smoothest marker movement (dead reckoning)
    // Falls back to interpolated, then raw position
    const displayLat = smoothedPosition?.predictedLat ?? smoothedPosition?.interpolatedLat ?? userPosition.lat;
    const displayLng = smoothedPosition?.predictedLng ?? smoothedPosition?.interpolatedLng ?? userPosition.lng;
    const displayHeading = smoothedPosition?.smoothedHeading ?? userPosition.heading;
    const displaySpeed = smoothedPosition?.smoothedSpeed ?? userPosition.speed ?? 0;

    const now = Date.now();
    const speedKmh = displaySpeed * 3.6;
    
    // Add position to history for bearing calculation (use raw position for accuracy)
    positionHistoryRef.current.push({
      lat: userPosition.lat,
      lng: userPosition.lng,
      time: now,
    });
    
    // Keep only last 5 positions, max 5 seconds old
    positionHistoryRef.current = positionHistoryRef.current.filter(
      p => now - p.time < 5000
    ).slice(-5);
    
    // Calculate bearing from position history (more stable than single GPS heading)
    let calculatedBearing: number | null = null;
    const history = positionHistoryRef.current;
    
    if (history.length >= 2) {
      const oldest = history[0];
      const newest = history[history.length - 1];
      
      // Only calculate if there's meaningful movement (> 3 meters)
      const distanceMoved = Math.sqrt(
        Math.pow((newest.lat - oldest.lat) * 111000, 2) +
        Math.pow((newest.lng - oldest.lng) * 111000 * Math.cos(newest.lat * Math.PI / 180), 2)
      );
      
      if (distanceMoved > 3) {
        calculatedBearing = calculateBearingBetweenPoints(
          oldest.lat, oldest.lng,
          newest.lat, newest.lng
        );
      }
    }
    
    // Decide which heading to use
    let headingToUse: number | null = null;
    let headingSource: 'calculated' | 'gps' | 'none' = 'none';
    
    if (calculatedBearing !== null && displaySpeed > MIN_SPEED_FOR_HEADING) {
      headingToUse = calculatedBearing;
      headingSource = 'calculated';
    } else if (displayHeading !== null && displaySpeed > MIN_SPEED_FOR_HEADING) {
      headingToUse = displayHeading;
      headingSource = 'gps';
    }
    
    // Create or update user marker (use smoothed interpolated position for smooth movement)
    if (userMarker.current) {
      userMarker.current.setLngLat([displayLng, displayLat]);
      userMarker.current.setRotation(0);
    } else {
      const el = createTruckCursorElement(52);
      
      userMarker.current = new mapboxgl.Marker({ 
        element: el, 
        rotationAlignment: 'viewport',
        pitchAlignment: 'viewport'
      })
        .setLngLat([displayLng, displayLat])
        .setRotation(0)
        .addTo(map.current);
    }

    // Update debug info
    setDebugInfo({
      speed: speedKmh,
      gpsAccuracy: userPosition.accuracy,
      calculatedBearing,
      gpsHeading: userPosition.heading,
      appliedCameraBearing: headingToUse ?? lastAppliedBearingRef.current,
      headingSource,
      lastUpdate: now,
    });

    // Apply camera bearing (course-up: map rotates) - use smoothed position
    if (followUser) {
      if (headingToUse !== null) {
        const bearingChange = bearingDifference(lastAppliedBearingRef.current, headingToUse);
        
        if (bearingChange >= MIN_BEARING_CHANGE || bearingAnimationRef.current === null) {
          targetBearingRef.current = headingToUse;
          lastAppliedBearingRef.current = headingToUse;
          
          if (bearingAnimationRef.current) {
            cancelAnimationFrame(bearingAnimationRef.current);
          }
          
          const animateBearing = () => {
            const current = currentBearingRef.current;
            const target = targetBearingRef.current;
            
            const newBearing = interpolateBearing(current, target, 0.12);
            currentBearingRef.current = newBearing;
            
            const diff = bearingDifference(current, target);
            
            if (diff > 1) {
              map.current?.easeTo({
                center: [displayLng, displayLat],
                bearing: newBearing,
                pitch: 60,
                zoom: 17,
                duration: 80,
                easing: (t) => t,
              });
              bearingAnimationRef.current = requestAnimationFrame(animateBearing);
            } else {
              map.current?.easeTo({
                center: [displayLng, displayLat],
                bearing: target,
                pitch: 60,
                zoom: 17,
                duration: 200,
              });
              bearingAnimationRef.current = null;
            }
          };
          
          animateBearing();
        } else {
          map.current.easeTo({
            center: [displayLng, displayLat],
            duration: 300,
          });
        }
      } else {
        map.current.easeTo({
          center: [displayLng, displayLat],
          duration: 500,
        });
      }
    }
    
    return () => {
      if (bearingAnimationRef.current) {
        cancelAnimationFrame(bearingAnimationRef.current);
      }
    };
  }, [userPosition, smoothedPosition, mapReady, followUser]);

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
