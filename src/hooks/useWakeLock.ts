import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Hook to keep the screen on using the Wake Lock API.
 */
export function useWakeLock(enabled: boolean) {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const [isActive, setIsActive] = useState(false);

  const request = useCallback(async () => {
    if (!('wakeLock' in navigator)) {
      console.warn('Wake Lock API not supported');
      return;
    }

    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      setIsActive(true);

      wakeLockRef.current.addEventListener('release', () => {
        setIsActive(false);
      });
    } catch (err) {
      console.error('Failed to acquire wake lock:', err);
    }
  }, []);

  const release = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        setIsActive(false);
      } catch (err) {
        console.error('Failed to release wake lock:', err);
      }
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      request();
    } else {
      release();
    }

    return () => {
      release();
    };
  }, [enabled, request, release]);

  // Re-acquire wake lock when page becomes visible
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && enabled) {
        request();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [enabled, request]);

  return isActive;
}
