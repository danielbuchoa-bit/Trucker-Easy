import { useRef, useCallback } from 'react';
import { useDiagnosticsSafe } from '@/contexts/DiagnosticsContext';

/**
 * Hook to detect 5 rapid taps to toggle diagnostics mode
 * Returns an onClick handler to attach to any element
 */
export const useDiagnosticsTap = () => {
  const diagnostics = useDiagnosticsSafe();
  const tapTimestamps = useRef<number[]>([]);
  const TAP_THRESHOLD = 500; // ms between taps
  const REQUIRED_TAPS = 5;

  const handleTap = useCallback(() => {
    if (!diagnostics) return;

    const now = Date.now();
    
    // Filter out old taps
    tapTimestamps.current = tapTimestamps.current.filter(
      t => now - t < TAP_THRESHOLD * REQUIRED_TAPS
    );
    
    tapTimestamps.current.push(now);

    // Check if we have enough rapid taps
    if (tapTimestamps.current.length >= REQUIRED_TAPS) {
      const firstTap = tapTimestamps.current[tapTimestamps.current.length - REQUIRED_TAPS];
      const timeDiff = now - firstTap;
      
      if (timeDiff < TAP_THRESHOLD * REQUIRED_TAPS) {
        diagnostics.toggleDiagnostics();
        tapTimestamps.current = []; // Reset
        
        // Haptic feedback if available
        if ('vibrate' in navigator) {
          navigator.vibrate([50, 30, 50]);
        }
      }
    }
  }, [diagnostics]);

  return handleTap;
};
