import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import { useActiveNavigation, type UserPosition } from '@/contexts/ActiveNavigationContext';
import { useVoiceGuidance } from '@/hooks/useVoiceGuidance';
import { useRouteSimulation } from '@/hooks/useRouteSimulation';
import NavigationHUD from './NavigationHUD';
import VoiceControls from './VoiceControls';
import SimulationControls from './SimulationControls';
import { MapPin, Navigation as NavIcon, RotateCcw, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n/LanguageContext';

// Minimum speed (m/s) to apply heading rotation - ~5 km/h = 1.39 m/s
const MIN_SPEED_FOR_HEADING = 1.39;

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
  
  // Heading interpolation refs
  const currentBearingRef = useRef<number>(0);
  const targetBearingRef = useRef<number>(0);
  const bearingAnimationRef = useRef<number | null>(null);

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

  // Voice guidance for instructions
  useEffect(() => {
    if (!currentInstruction || !progress || !voice.settings.enabled) return;
    
    // Speak instruction at key distances
    const dist = progress.distanceToNextManeuver;
    const idx = progress.currentInstructionIndex;

    // Speak when instruction changes or at approach distances
    if (idx !== lastVoiceInstructionIndex.current) {
      lastVoiceInstructionIndex.current = idx;
      voice.speakInstruction(currentInstruction, dist, idx);
    } else if (dist < 150 && dist > 100) {
      // Approaching (~500ft)
      voice.speakInstruction(currentInstruction, dist, idx);
    } else if (dist < 50) {
      // Imminent (~150ft)
      voice.speakInstruction(currentInstruction, dist, idx);
    }
  }, [currentInstruction, progress, voice]);

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

  // Update user marker & camera with course-up orientation
  useEffect(() => {
    if (!map.current || !mapReady || !userPosition) return;

    // Create or update user marker with direction indicator
    if (userMarker.current) {
      userMarker.current.setLngLat([userPosition.lng, userPosition.lat]);
    } else {
      // Create a direction arrow marker (pointing up)
      const el = document.createElement('div');
      el.className = 'relative';
      el.innerHTML = `
        <div class="w-8 h-8 flex items-center justify-center">
          <svg viewBox="0 0 24 24" class="w-8 h-8 text-blue-500 drop-shadow-lg" fill="currentColor">
            <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
          </svg>
        </div>
        <div class="absolute inset-0 flex items-center justify-center">
          <div class="w-3 h-3 bg-white rounded-full border-2 border-blue-500 shadow-sm"></div>
        </div>
      `;
      userMarker.current = new mapboxgl.Marker({ 
        element: el, 
        rotationAlignment: 'map',
        pitchAlignment: 'map'
      })
        .setLngLat([userPosition.lng, userPosition.lat])
        .addTo(map.current);
    }

    // Check if we should apply heading rotation (only when moving above threshold)
    const speed = userPosition.speed ?? 0;
    const heading = userPosition.heading;
    const shouldRotate = speed > MIN_SPEED_FOR_HEADING && heading !== null;

    if (followUser) {
      if (shouldRotate && heading !== null) {
        // Set target bearing for smooth animation
        targetBearingRef.current = heading;
        
        // Cancel any existing animation
        if (bearingAnimationRef.current) {
          cancelAnimationFrame(bearingAnimationRef.current);
        }
        
        // Animate bearing smoothly
        const animateBearing = () => {
          const current = currentBearingRef.current;
          const target = targetBearingRef.current;
          
          // Interpolate towards target
          const newBearing = interpolateBearing(current, target, 0.15);
          currentBearingRef.current = newBearing;
          
          // Only update map if difference is noticeable
          const diff = Math.abs(target - newBearing);
          if (diff > 0.5 || diff < 0.5) {
            map.current?.easeTo({
              center: [userPosition.lng, userPosition.lat],
              bearing: newBearing,
              pitch: 60, // Higher pitch for better forward view
              zoom: 17, // Closer zoom for navigation
              duration: 100,
              easing: (t) => t, // Linear for smooth continuous updates
            });
          }
          
          // Continue animation if not close enough
          if (diff > 1) {
            bearingAnimationRef.current = requestAnimationFrame(animateBearing);
          }
        };
        
        animateBearing();
      } else {
        // When stationary or no heading, just center without rotation
        map.current.easeTo({
          center: [userPosition.lng, userPosition.lat],
          duration: 500,
        });
      }
    }
    
    // Cleanup animation on unmount or when followUser changes
    return () => {
      if (bearingAnimationRef.current) {
        cancelAnimationFrame(bearingAnimationRef.current);
      }
    };
  }, [userPosition, mapReady, followUser]);

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

      {/* Rerouting indicator */}
      {isRerouting && (
        <div className="absolute top-20 inset-x-4 z-40 bg-orange-500 text-white p-3 rounded-lg text-center flex items-center justify-center gap-2">
          <RotateCcw className="w-5 h-5 animate-spin" />
          <span className="font-medium">Rerouting...</span>
        </div>
      )}

      {/* HUD */}
      {route && progress && (
        <NavigationHUD
          currentInstruction={currentInstruction}
          distanceToNextManeuver={progress.distanceToNextManeuver}
          remainingDistance={progress.remainingDistance}
          remainingDuration={progress.remainingDuration}
          onEndNavigation={endNavigation}
          onRepeat={voice.repeatLastInstruction}
        />
      )}

      {/* Voice Controls */}
      <VoiceControls
        settings={voice.settings}
        onToggle={voice.toggleVoice}
        onUpdateSettings={voice.updateSettings}
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

      {/* Map style toggle */}
      <div className="absolute top-36 right-4 z-30 flex flex-col gap-2">
        <Button
          variant="secondary"
          size="icon"
          className="rounded-full shadow-lg"
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
              // Re-add route layer after style change
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
      </div>

      {/* Re-center button - restores course-up following */}
      {!followUser && (
        <Button
          className="absolute bottom-32 right-4 z-30 rounded-full shadow-lg bg-primary"
          size="icon"
          onClick={() => {
            setFollowUser(true);
            // Reset bearing to current heading when re-centering
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
