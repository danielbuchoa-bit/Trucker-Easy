import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import { useActiveNavigation } from '@/contexts/ActiveNavigationContext';
import { useVoiceGuidance } from '@/hooks/useVoiceGuidance';
import { useRouteSimulation } from '@/hooks/useRouteSimulation';
import NavigationHUD from './NavigationHUD';
import VoiceControls from './VoiceControls';
import SimulationControls from './SimulationControls';
import { MapPin, Navigation as NavIcon, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n/LanguageContext';

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

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const userMarker = useRef<mapboxgl.Marker | null>(null);
  const destMarker = useRef<mapboxgl.Marker | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followUser, setFollowUser] = useState(true);
  const mapInitialized = useRef(false);
  const lastVoiceInstructionIndex = useRef<number>(-1);

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

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/navigation-night-v1',
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
      voice.stop();
      userMarker.current?.remove();
      destMarker.current?.remove();
      map.current?.remove();
      map.current = null;
      mapInitialized.current = false;
    };
  }, [initializeMap, voice]);

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

  // Update user marker & camera
  useEffect(() => {
    if (!map.current || !mapReady || !userPosition) return;

    if (userMarker.current) {
      userMarker.current.setLngLat([userPosition.lng, userPosition.lat]);
    } else {
      const el = document.createElement('div');
      el.className = 'w-6 h-6 bg-blue-500 rounded-full border-4 border-white shadow-lg flex items-center justify-center';
      el.innerHTML = '<div class="w-2 h-2 bg-white rounded-full"></div>';
      userMarker.current = new mapboxgl.Marker({ element: el, rotationAlignment: 'map' })
        .setLngLat([userPosition.lng, userPosition.lat])
        .addTo(map.current);
    }

    if (followUser) {
      map.current.easeTo({
        center: [userPosition.lng, userPosition.lat],
        duration: 500,
      });
    }
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

      {/* Re-center button */}
      {!followUser && (
        <Button
          className="absolute bottom-32 right-4 z-30 rounded-full shadow-lg"
          size="icon"
          onClick={() => setFollowUser(true)}
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
