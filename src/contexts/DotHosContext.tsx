/**
 * DOT Hours of Service (HOS) Context
 * 
 * Tracks FMCSA driving regulations:
 * - 11 hours of driving max
 * - 14 hour duty window
 * - 30 minute break required after 8 hours driving
 * - 10 hour reset for all counters
 * 
 * Automatic state detection based on vehicle speed.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

// === Types ===
export type DotDutyStatus = 'OFF_DUTY' | 'SLEEPER' | 'DRIVING' | 'ON_DUTY_NOT_DRIVING';

export interface DotHosState {
  // Current status
  currentStatus: DotDutyStatus;
  
  // Counters (in seconds)
  drivingTodaySec: number;          // Total driving today (max 11h = 39600s)
  dutyWindowSec: number;            // Time since duty started (max 14h = 50400s)
  breakDrivingSinceLastBreakSec: number; // Driving since last valid break (max 8h = 28800s)
  restContinuousSec: number;        // Continuous rest time
  
  // Calculated values
  drivingRemainingSec: number;      // 11h - drivingTodaySec
  dutyRemainingSec: number;         // 14h - dutyWindowSec
  criticalRemainingSec: number;     // min(drivingRemaining, dutyRemaining)
  criticalPercentage: number;       // 0-100, based on which limit is critical
  
  // Flags
  needsBreak: boolean;              // breakDrivingSinceLastBreakSec >= 8h
  isInViolation: boolean;           // Any counter exceeded
  isResting: boolean;               // Currently accumulating rest
  
  // Status color
  statusColor: 'green' | 'yellow' | 'red';
}

interface DotHosContextValue {
  state: DotHosState;
  
  // Manual status changes (for when user explicitly changes)
  setStatus: (status: DotDutyStatus) => void;
  
  // Current speed input for auto-detection
  updateSpeed: (speedMph: number) => void;
  
  // Reset after 10h rest (called automatically or manually)
  performFullReset: () => void;
  
  // For debug/testing
  simulateTime: (seconds: number) => void;
}

// === Constants ===
const MAX_DRIVING_SEC = 11 * 60 * 60;      // 11 hours
const MAX_DUTY_WINDOW_SEC = 14 * 60 * 60;  // 14 hours
const MAX_DRIVING_BEFORE_BREAK_SEC = 8 * 60 * 60; // 8 hours
const REQUIRED_BREAK_SEC = 30 * 60;        // 30 minutes
const REQUIRED_REST_RESET_SEC = 10 * 60 * 60; // 10 hours

// Speed thresholds (mph)
const DRIVING_SPEED_THRESHOLD = 5;  // ≥5 mph = driving
const STOPPED_SPEED_THRESHOLD = 1;  // <1 mph = stopped

// Detection timeouts (ms)
const DRIVING_DETECTION_TIMEOUT = 60 * 1000;   // 60 seconds at speed
const STOPPED_DETECTION_TIMEOUT = 120 * 1000;  // 120 seconds stopped

// Persist key
const STORAGE_KEY = 'dot_hos_state';

// === Context ===
const DotHosContext = createContext<DotHosContextValue | null>(null);

// === Helper Functions ===
function calculateRemainingTime(drivingSec: number, dutySec: number): {
  drivingRemaining: number;
  dutyRemaining: number;
  critical: number;
  criticalSource: 'driving' | 'duty';
} {
  const drivingRemaining = Math.max(0, MAX_DRIVING_SEC - drivingSec);
  const dutyRemaining = Math.max(0, MAX_DUTY_WINDOW_SEC - dutySec);
  const critical = Math.min(drivingRemaining, dutyRemaining);
  const criticalSource = drivingRemaining <= dutyRemaining ? 'driving' : 'duty';
  
  return { drivingRemaining, dutyRemaining, critical, criticalSource };
}

function calculateStatusColor(criticalRemainingSec: number, criticalSource: 'driving' | 'duty'): 'green' | 'yellow' | 'red' {
  const maxSec = criticalSource === 'driving' ? MAX_DRIVING_SEC : MAX_DUTY_WINDOW_SEC;
  const percentage = (criticalRemainingSec / maxSec) * 100;
  
  if (percentage > 25) return 'green';
  if (percentage > 10) return 'yellow';
  return 'red';
}

function loadPersistedState(): Partial<DotHosState> | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Check if data is from today
      const storedDate = new Date(parsed.lastUpdate).toDateString();
      const today = new Date().toDateString();
      if (storedDate === today) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('[DotHOS] Failed to load persisted state:', e);
  }
  return null;
}

function persistState(state: DotHosState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...state,
      lastUpdate: Date.now(),
    }));
  } catch (e) {
    console.warn('[DotHOS] Failed to persist state:', e);
  }
}

// === Provider ===
export function DotHosProvider({ children }: { children: React.ReactNode }) {
  // Speed tracking for auto-detection
  const speedHistoryRef = useRef<{ speed: number; timestamp: number }[]>([]);
  const lastSpeedUpdateRef = useRef<number>(Date.now());
  const currentSpeedRef = useRef<number>(0);
  
  // Timer refs
  const tickIntervalRef = useRef<number | null>(null);
  const autoDetectTimeoutRef = useRef<number | null>(null);
  
  // Initialize state
  const [state, setState] = useState<DotHosState>(() => {
    const persisted = loadPersistedState();
    
    const defaults: DotHosState = {
      currentStatus: 'OFF_DUTY',
      drivingTodaySec: 0,
      dutyWindowSec: 0,
      breakDrivingSinceLastBreakSec: 0,
      restContinuousSec: 0,
      drivingRemainingSec: MAX_DRIVING_SEC,
      dutyRemainingSec: MAX_DUTY_WINDOW_SEC,
      criticalRemainingSec: MAX_DRIVING_SEC,
      criticalPercentage: 100,
      needsBreak: false,
      isInViolation: false,
      isResting: false,
      statusColor: 'green',
    };
    
    if (persisted) {
      return { ...defaults, ...persisted };
    }
    
    return defaults;
  });
  
  // Update derived values whenever counters change
  const updateDerivedState = useCallback((currentState: DotHosState): DotHosState => {
    const { drivingRemaining, dutyRemaining, critical, criticalSource } = 
      calculateRemainingTime(currentState.drivingTodaySec, currentState.dutyWindowSec);
    
    const maxForPercentage = criticalSource === 'driving' ? MAX_DRIVING_SEC : MAX_DUTY_WINDOW_SEC;
    const criticalPercentage = Math.max(0, Math.min(100, (critical / maxForPercentage) * 100));
    
    const needsBreak = currentState.breakDrivingSinceLastBreakSec >= MAX_DRIVING_BEFORE_BREAK_SEC;
    const isInViolation = drivingRemaining <= 0 || dutyRemaining <= 0;
    const isResting = currentState.currentStatus === 'OFF_DUTY' || currentState.currentStatus === 'SLEEPER';
    const statusColor = calculateStatusColor(critical, criticalSource);
    
    return {
      ...currentState,
      drivingRemainingSec: drivingRemaining,
      dutyRemainingSec: dutyRemaining,
      criticalRemainingSec: critical,
      criticalPercentage,
      needsBreak,
      isInViolation,
      isResting,
      statusColor,
    };
  }, []);
  
  // Tick function - called every second
  const tick = useCallback(() => {
    setState(prev => {
      const newState = { ...prev };
      
      switch (prev.currentStatus) {
        case 'DRIVING':
          newState.drivingTodaySec = prev.drivingTodaySec + 1;
          newState.dutyWindowSec = prev.dutyWindowSec + 1;
          newState.breakDrivingSinceLastBreakSec = prev.breakDrivingSinceLastBreakSec + 1;
          newState.restContinuousSec = 0; // Reset rest counter
          break;
          
        case 'ON_DUTY_NOT_DRIVING':
          newState.dutyWindowSec = prev.dutyWindowSec + 1;
          newState.restContinuousSec = 0;
          // Check if this is a valid break (30min pause)
          // This is simplified - in reality we track pause start time
          break;
          
        case 'OFF_DUTY':
        case 'SLEEPER':
          newState.restContinuousSec = prev.restContinuousSec + 1;
          
          // Check for 10-hour reset
          if (newState.restContinuousSec >= REQUIRED_REST_RESET_SEC) {
            // Full reset
            newState.drivingTodaySec = 0;
            newState.dutyWindowSec = 0;
            newState.breakDrivingSinceLastBreakSec = 0;
          }
          
          // Check for 30-min break reset (only for break counter)
          if (newState.restContinuousSec >= REQUIRED_BREAK_SEC) {
            newState.breakDrivingSinceLastBreakSec = 0;
          }
          break;
      }
      
      const updated = updateDerivedState(newState);
      persistState(updated);
      return updated;
    });
  }, [updateDerivedState]);
  
  // Start timer on mount
  useEffect(() => {
    tickIntervalRef.current = window.setInterval(tick, 1000);
    
    return () => {
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
      }
    };
  }, [tick]);
  
  // Speed-based auto-detection
  const updateSpeed = useCallback((speedMph: number) => {
    const now = Date.now();
    currentSpeedRef.current = speedMph;
    
    // Add to history
    speedHistoryRef.current.push({ speed: speedMph, timestamp: now });
    
    // Keep only last 3 minutes of history
    const cutoff = now - 180000;
    speedHistoryRef.current = speedHistoryRef.current.filter(s => s.timestamp > cutoff);
    
    lastSpeedUpdateRef.current = now;
    
    // Auto-detect status changes
    setState(prev => {
      // Check for driving condition (≥5 mph for 60s)
      if (speedMph >= DRIVING_SPEED_THRESHOLD) {
        const drivingHistory = speedHistoryRef.current.filter(
          s => s.speed >= DRIVING_SPEED_THRESHOLD && s.timestamp > now - DRIVING_DETECTION_TIMEOUT
        );
        
        // If we've been at driving speed for 60 seconds, switch to DRIVING
        if (drivingHistory.length > 0) {
          const earliestDriving = drivingHistory[0].timestamp;
          if (now - earliestDriving >= DRIVING_DETECTION_TIMEOUT) {
            if (prev.currentStatus !== 'DRIVING') {
              console.log('[DotHOS] Auto-detected DRIVING state');
              const newState = { ...prev, currentStatus: 'DRIVING' as DotDutyStatus };
              return updateDerivedState(newState);
            }
          }
        }
      }
      
      // Check for stopped condition (<1 mph for 120s)
      if (speedMph < STOPPED_SPEED_THRESHOLD) {
        const stoppedHistory = speedHistoryRef.current.filter(
          s => s.speed < STOPPED_SPEED_THRESHOLD && s.timestamp > now - STOPPED_DETECTION_TIMEOUT
        );
        
        if (stoppedHistory.length > 0) {
          const earliestStopped = stoppedHistory[0].timestamp;
          if (now - earliestStopped >= STOPPED_DETECTION_TIMEOUT) {
            if (prev.currentStatus === 'DRIVING') {
              console.log('[DotHOS] Auto-detected ON_DUTY_NOT_DRIVING state (stopped)');
              const newState = { ...prev, currentStatus: 'ON_DUTY_NOT_DRIVING' as DotDutyStatus };
              return updateDerivedState(newState);
            }
          }
        }
      }
      
      return prev;
    });
  }, [updateDerivedState]);
  
  // Manual status change
  const setStatus = useCallback((status: DotDutyStatus) => {
    console.log('[DotHOS] Manual status change to:', status);
    setState(prev => {
      const newState = { ...prev, currentStatus: status };
      
      // If switching to rest status, reset rest counter
      if (status === 'OFF_DUTY' || status === 'SLEEPER') {
        newState.restContinuousSec = 0;
      }
      
      return updateDerivedState(newState);
    });
  }, [updateDerivedState]);
  
  // Full reset (after 10h rest)
  const performFullReset = useCallback(() => {
    console.log('[DotHOS] Performing full reset');
    setState(prev => {
      const newState: DotHosState = {
        ...prev,
        drivingTodaySec: 0,
        dutyWindowSec: 0,
        breakDrivingSinceLastBreakSec: 0,
        restContinuousSec: 0,
        currentStatus: 'OFF_DUTY',
      };
      return updateDerivedState(newState);
    });
  }, [updateDerivedState]);
  
  // Simulate time passage (for testing)
  const simulateTime = useCallback((seconds: number) => {
    for (let i = 0; i < seconds; i++) {
      tick();
    }
  }, [tick]);
  
  const value: DotHosContextValue = {
    state,
    setStatus,
    updateSpeed,
    performFullReset,
    simulateTime,
  };
  
  return (
    <DotHosContext.Provider value={value}>
      {children}
    </DotHosContext.Provider>
  );
}

// === Hook ===
export function useDotHos(): DotHosContextValue {
  const context = useContext(DotHosContext);
  if (!context) {
    throw new Error('useDotHos must be used within a DotHosProvider');
  }
  return context;
}

// Optional safe hook that returns null if not in provider
export function useDotHosSafe(): DotHosContextValue | null {
  return useContext(DotHosContext);
}

// === Utility Functions ===
export function formatHosTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

export function formatHosTimeShort(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  }
  return `${minutes}m`;
}
