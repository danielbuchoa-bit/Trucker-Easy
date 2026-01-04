import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { decodeHereFlexiblePolyline, type LngLat } from '@/lib/hereFlexiblePolyline';
import { calculateNavigationProgress, haversineDistance, type NavigationProgress } from '@/lib/navigationUtils';
import { useWakeLock } from '@/hooks/useWakeLock';
import { HereService, type RouteResponse, type GeocodeResult, DEFAULT_TRUCK_PROFILE, type TruckProfile } from '@/services/HereService';

const NAVIGATION_STATE_KEY = 'activeNavigation';
const OFF_ROUTE_THRESHOLD = 50; // meters - trigger reroute if user is this far from route
const OFF_ROUTE_CONSECUTIVE_THRESHOLD = 5; // Must be off-route for ~5 seconds (with 1s updates)
const OFF_ROUTE_PERSIST_TIME_MS = 4000; // Must stay off-route for this duration
const REROUTE_COOLDOWN_MS = 45000; // 45 seconds minimum between reroutes

interface NavigationState {
  route: RouteResponse;
  origin: GeocodeResult;
  destination: GeocodeResult;
  startedAt: number;
  truckProfile: TruckProfile;
}

export interface UserPosition {
  lat: number;
  lng: number;
  heading: number | null; // GPS course/bearing in degrees (0-360, 0 = North)
  speed: number | null; // Speed in m/s
  accuracy: number | null;
}

interface ActiveNavigationContextValue {
  isNavigating: boolean;
  route: RouteResponse | null;
  routeCoords: LngLat[];
  origin: GeocodeResult | null;
  destination: GeocodeResult | null;
  userPosition: UserPosition | null;
  progress: NavigationProgress | null;
  truckProfile: TruckProfile;
  isRerouting: boolean;
  isOffRoute: boolean;
  isSimulating: boolean;
  startNavigation: (route: RouteResponse, origin: GeocodeResult, destination: GeocodeResult, profile?: TruckProfile) => void;
  endNavigation: () => void;
  setSimulatedPosition: (position: UserPosition | null) => void;
  setIsSimulating: (simulating: boolean) => void;
  positionError: string | null;
}

const ActiveNavigationContext = createContext<ActiveNavigationContextValue | undefined>(undefined);

export function ActiveNavigationProvider({ children }: { children: React.ReactNode }) {
  const [route, setRoute] = useState<RouteResponse | null>(null);
  const [routeCoords, setRouteCoords] = useState<LngLat[]>([]);
  const [origin, setOrigin] = useState<GeocodeResult | null>(null);
  const [destination, setDestination] = useState<GeocodeResult | null>(null);
  const [userPosition, setUserPosition] = useState<UserPosition | null>(null);
  const [simulatedPosition, setSimulatedPosition] = useState<UserPosition | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const lastPositionRef = useRef<{ lat: number; lng: number; time: number } | null>(null);
  const [progress, setProgress] = useState<NavigationProgress | null>(null);
  const [positionError, setPositionError] = useState<string | null>(null);
  const [truckProfile, setTruckProfile] = useState<TruckProfile>(DEFAULT_TRUCK_PROFILE);
  const [isRerouting, setIsRerouting] = useState(false);
  const [isOffRoute, setIsOffRoute] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const lastRerouteTime = useRef<number>(0);
  const offRouteCountRef = useRef<number>(0); // Consecutive off-route detections
  const offRouteStartTimeRef = useRef<number | null>(null); // When off-route started
  const isReroutingRef = useRef<boolean>(false); // Prevent concurrent reroutes
  const isNavigating = route !== null;

  // Use simulated position if simulating, otherwise real position
  const effectivePosition = isSimulating ? simulatedPosition : userPosition;

  // Keep screen on during navigation
  useWakeLock(isNavigating);

  // Restore navigation state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(NAVIGATION_STATE_KEY);
      if (saved) {
        const state: NavigationState = JSON.parse(saved);
        // Only restore if less than 8 hours old
        if (Date.now() - state.startedAt < 8 * 60 * 60 * 1000) {
          setRoute(state.route);
          setRouteCoords(decodeHereFlexiblePolyline(state.route.polyline));
          setOrigin(state.origin);
          setDestination(state.destination);
          setTruckProfile(state.truckProfile || DEFAULT_TRUCK_PROFILE);
        } else {
          localStorage.removeItem(NAVIGATION_STATE_KEY);
        }
      }
    } catch {
      localStorage.removeItem(NAVIGATION_STATE_KEY);
    }
  }, []);

  // Start watching position when navigating (only if not simulating)
  useEffect(() => {
    if (!isNavigating || isSimulating) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (!('geolocation' in navigator)) {
      setPositionError('Geolocation not supported');
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, heading: gpsHeading, speed: gpsSpeed, accuracy } = pos.coords;
        
        // Calculate heading from movement if GPS heading is not available
        let calculatedHeading = gpsHeading;
        const now = Date.now();
        
        if (lastPositionRef.current && (gpsHeading === null || gpsHeading === undefined)) {
          const timeDelta = (now - lastPositionRef.current.time) / 1000; // seconds
          if (timeDelta > 0 && timeDelta < 5) { // Only calculate if reasonable time gap
            const deltaLat = latitude - lastPositionRef.current.lat;
            const deltaLng = longitude - lastPositionRef.current.lng;
            
            // Only calculate if there's meaningful movement
            const distance = Math.sqrt(deltaLat * deltaLat + deltaLng * deltaLng) * 111000; // rough meters
            if (distance > 2) { // Moved at least 2 meters
              // Calculate bearing from movement
              const y = Math.sin((deltaLng * Math.PI) / 180) * Math.cos((latitude * Math.PI) / 180);
              const x = Math.cos((lastPositionRef.current.lat * Math.PI) / 180) * Math.sin((latitude * Math.PI) / 180) -
                Math.sin((lastPositionRef.current.lat * Math.PI) / 180) * Math.cos((latitude * Math.PI) / 180) * Math.cos((deltaLng * Math.PI) / 180);
              calculatedHeading = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
            }
          }
        }
        
        lastPositionRef.current = { lat: latitude, lng: longitude, time: now };
        
        setUserPosition({
          lat: latitude,
          lng: longitude,
          heading: calculatedHeading ?? null,
          speed: gpsSpeed ?? null,
          accuracy: accuracy ?? null,
        });
        setPositionError(null);
      },
      (err) => {
        console.error('Geolocation error:', err);
        setPositionError(err.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 500, // Reduced from 2000ms for fresher data
        timeout: 10000,
      }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isNavigating, isSimulating]);

  // Check if off route and trigger reroute (with time-based debounce and cooldown)
  const checkAndReroute = useCallback(async (position: { lat: number; lng: number }) => {
    if (!destination || !route || routeCoords.length === 0) return;
    
    // Prevent concurrent reroutes
    if (isReroutingRef.current || isRerouting) return;
    
    const now = Date.now();
    
    // Don't even check during cooldown period
    if (now - lastRerouteTime.current < REROUTE_COOLDOWN_MS) {
      return;
    }

    // Find closest point on route (sample every 3rd point for performance)
    let minDist = Infinity;
    for (let i = 0; i < routeCoords.length; i += 3) {
      const [lng, lat] = routeCoords[i];
      const dist = haversineDistance(position.lat, position.lng, lat, lng);
      if (dist < minDist) minDist = dist;
    }

    // Check if currently off route
    if (minDist > OFF_ROUTE_THRESHOLD) {
      // Start or continue off-route timer
      if (offRouteStartTimeRef.current === null) {
        offRouteStartTimeRef.current = now;
        offRouteCountRef.current = 1;
      } else {
        offRouteCountRef.current += 1;
      }
      
      const offRouteDuration = now - offRouteStartTimeRef.current;
      
      // Only trigger reroute after sustained off-route (time-based + count-based)
      if (offRouteDuration >= OFF_ROUTE_PERSIST_TIME_MS && 
          offRouteCountRef.current >= OFF_ROUTE_CONSECUTIVE_THRESHOLD) {
        
        // Lock to prevent concurrent calls
        isReroutingRef.current = true;
        setIsOffRoute(true);
        setIsRerouting(true);
        lastRerouteTime.current = now;
        offRouteCountRef.current = 0;
        offRouteStartTimeRef.current = null;

        try {
          console.log(`Off route confirmed (${minDist.toFixed(0)}m, ${offRouteDuration}ms), rerouting...`);
          const newRoute = await HereService.calculateRoute({
            originLat: position.lat,
            originLng: position.lng,
            destLat: destination.lat,
            destLng: destination.lng,
            transportMode: 'truck',
            truckProfile,
          });

          setRoute(newRoute);
          setRouteCoords(decodeHereFlexiblePolyline(newRoute.polyline));
          
          // Update origin to current position
          const newOrigin: GeocodeResult = {
            id: 'reroute-origin',
            title: 'Current Location',
            address: `${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}`,
            lat: position.lat,
            lng: position.lng,
          };
          setOrigin(newOrigin);

          // Save updated state
          const state: NavigationState = {
            route: newRoute,
            origin: newOrigin,
            destination,
            startedAt: Date.now(),
            truckProfile,
          };
          localStorage.setItem(NAVIGATION_STATE_KEY, JSON.stringify(state));

          setIsOffRoute(false);
        } catch (error) {
          console.error('Reroute failed:', error);
        } finally {
          setIsRerouting(false);
          isReroutingRef.current = false;
        }
      } else {
        // Visually show off-route but don't reroute yet
        setIsOffRoute(true);
      }
    } else {
      // Back on route - reset everything
      offRouteCountRef.current = 0;
      offRouteStartTimeRef.current = null;
      setIsOffRoute(false);
    }
  }, [destination, route, routeCoords, isRerouting, truckProfile]);

  // Update progress when position changes (throttled)
  const lastProgressUpdate = useRef<number>(0);
  useEffect(() => {
    if (!effectivePosition || !route || routeCoords.length === 0) {
      setProgress(null);
      return;
    }

    // Throttle updates to max once per second
    const now = Date.now();
    if (now - lastProgressUpdate.current < 1000) return;
    lastProgressUpdate.current = now;

    const newProgress = calculateNavigationProgress(
      effectivePosition.lng,
      effectivePosition.lat,
      routeCoords,
      route.instructions,
      route.distance,
      route.duration
    );

    setProgress(newProgress);

    // Check if off route (only for real navigation, not simulation)
    if (!isSimulating) {
      checkAndReroute(effectivePosition);
    }
  }, [effectivePosition, route, routeCoords, isSimulating, checkAndReroute]);

  const startNavigation = useCallback(
    (newRoute: RouteResponse, newOrigin: GeocodeResult, newDest: GeocodeResult, profile?: TruckProfile) => {
      const usedProfile = profile || DEFAULT_TRUCK_PROFILE;
      
      setRoute(newRoute);
      setRouteCoords(decodeHereFlexiblePolyline(newRoute.polyline));
      setOrigin(newOrigin);
      setDestination(newDest);
      setTruckProfile(usedProfile);
      setIsOffRoute(false);
      setIsRerouting(false);

      const state: NavigationState = {
        route: newRoute,
        origin: newOrigin,
        destination: newDest,
        startedAt: Date.now(),
        truckProfile: usedProfile,
      };
      localStorage.setItem(NAVIGATION_STATE_KEY, JSON.stringify(state));
    },
    []
  );

  const endNavigation = useCallback(() => {
    setRoute(null);
    setRouteCoords([]);
    setOrigin(null);
    setDestination(null);
    setUserPosition(null);
    setSimulatedPosition(null);
    setIsSimulating(false);
    setProgress(null);
    setIsOffRoute(false);
    setIsRerouting(false);
    localStorage.removeItem(NAVIGATION_STATE_KEY);
  }, []);

  return (
    <ActiveNavigationContext.Provider
      value={{
        isNavigating,
        route,
        routeCoords,
        origin,
        destination,
        userPosition: effectivePosition,
        progress,
        truckProfile,
        isRerouting,
        isOffRoute,
        isSimulating,
        startNavigation,
        endNavigation,
        setSimulatedPosition,
        setIsSimulating,
        positionError,
      }}
    >
      {children}
    </ActiveNavigationContext.Provider>
  );
}

export function useActiveNavigation(): ActiveNavigationContextValue {
  const ctx = useContext(ActiveNavigationContext);
  if (ctx === undefined) {
    throw new Error('useActiveNavigation must be used within ActiveNavigationProvider');
  }
  return ctx;
}
