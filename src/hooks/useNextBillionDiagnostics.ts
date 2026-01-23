/**
 * Hook to activate NextBillion Diagnostics Panel via 5 rapid taps
 */

import { useRef, useCallback, useState } from 'react';

const TAP_THRESHOLD_MS = 500;
const REQUIRED_TAPS = 5;

export const useNextBillionDiagnostics = () => {
  const [isOpen, setIsOpen] = useState(false);
  const tapTimestamps = useRef<number[]>([]);

  const handleTap = useCallback(() => {
    const now = Date.now();
    
    // Filter out old taps
    tapTimestamps.current = tapTimestamps.current.filter(
      t => now - t < TAP_THRESHOLD_MS * REQUIRED_TAPS
    );
    
    tapTimestamps.current.push(now);

    // Check if we have enough rapid taps
    if (tapTimestamps.current.length >= REQUIRED_TAPS) {
      const firstTap = tapTimestamps.current[tapTimestamps.current.length - REQUIRED_TAPS];
      const timeDiff = now - firstTap;
      
      if (timeDiff < TAP_THRESHOLD_MS * REQUIRED_TAPS) {
        setIsOpen(true);
        tapTimestamps.current = [];
        
        // Haptic feedback if available
        if ('vibrate' in navigator) {
          navigator.vibrate([50, 30, 50]);
        }
      }
    }
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  return {
    isOpen,
    handleTap,
    close,
  };
};

export default useNextBillionDiagnostics;
