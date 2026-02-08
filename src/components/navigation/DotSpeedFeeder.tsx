/**
 * DotSpeedFeeder - Global GPS speed observer for DOT HOS tracking.
 * 
 * This component runs a continuous GPS watch and feeds speed data
 * to the DotHosContext, enabling automatic DRIVING/STOPPED detection
 * even when no active navigation route is running.
 * 
 * Renders nothing - purely a side-effect component.
 */

import { useEffect, useRef } from 'react';
import { useDotHosSafe } from '@/contexts/DotHosContext';

const UPDATE_INTERVAL_MS = 3000; // Feed speed every 3 seconds

export default function DotSpeedFeeder() {
  const dotHos = useDotHosSafe();
  const watchIdRef = useRef<number | null>(null);
  const lastSpeedRef = useRef<number>(0);
  const lastFeedRef = useRef<number>(0);

  useEffect(() => {
    if (!dotHos || !navigator.geolocation) return;

    const handlePosition = (position: GeolocationPosition) => {
      const now = Date.now();
      
      // Throttle feeds to avoid excessive updates
      if (now - lastFeedRef.current < UPDATE_INTERVAL_MS) return;
      lastFeedRef.current = now;

      // speed is in m/s, convert to mph
      const speedMs = position.coords.speed;
      const speedMph = speedMs != null && speedMs >= 0 ? speedMs * 2.237 : 0;
      
      lastSpeedRef.current = speedMph;
      dotHos.updateSpeed(speedMph);
    };

    const handleError = (err: GeolocationPositionError) => {
      // Feed 0 speed on error so the system knows we're stopped
      if (Date.now() - lastFeedRef.current > UPDATE_INTERVAL_MS) {
        dotHos.updateSpeed(0);
        lastFeedRef.current = Date.now();
      }
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      handleError,
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      }
    );

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [dotHos]);

  return null; // Render nothing
}
