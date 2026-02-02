/**
 * DOT Hours of Service Bar
 * 
 * Minimal visual indicator showing critical remaining time.
 * Designed for instant comprehension (<1 second).
 * 
 * - Green: > 25% remaining
 * - Yellow: 10-25% remaining  
 * - Red: < 10% remaining (flashing)
 */

import React, { memo, useMemo, useEffect, useState } from 'react';
import { useDotHosSafe } from '@/contexts/DotHosContext';
import { Coffee, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DotHosBarProps {
  className?: string;
}

const DotHosBar = memo(function DotHosBar({ className }: DotHosBarProps) {
  const dotHos = useDotHosSafe();
  const [flashVisible, setFlashVisible] = useState(true);
  const [fastFlash, setFastFlash] = useState(false);
  
  const state = dotHos?.state;
  
  // Calculate bar fill percentage (inverted - shows remaining)
  const fillPercentage = state?.criticalPercentage ?? 100;
  
  // Determine urgency level for flash speed
  const urgencyLevel = useMemo(() => {
    if (!state || state.criticalPercentage > 10) return 'none';
    if (state.criticalPercentage > 5) return 'slow';
    if (state.criticalPercentage > 2) return 'medium';
    return 'fast';
  }, [state?.criticalPercentage]);
  
  const statusColor = state?.statusColor ?? 'green';
  
  // Flash animation for red state
  useEffect(() => {
    if (statusColor !== 'red') {
      setFlashVisible(true);
      return;
    }
    
    // Flash interval based on urgency
    const intervals: Record<string, number> = {
      none: 0,
      slow: 1000,
      medium: 500,
      fast: 250,
    };
    
    const interval = intervals[urgencyLevel];
    if (interval === 0) return;
    
    setFastFlash(urgencyLevel === 'fast');
    
    const timer = setInterval(() => {
      setFlashVisible(v => !v);
    }, interval);
    
    return () => clearInterval(timer);
  }, [statusColor, urgencyLevel]);
  
  // Color classes
  const barColorClass = useMemo(() => {
    switch (statusColor) {
      case 'green':
        return 'bg-green-500';
      case 'yellow':
        return 'bg-yellow-500';
      case 'red':
        return flashVisible ? 'bg-red-500' : 'bg-red-300';
    }
  }, [statusColor, flashVisible]);
  
  const bgColorClass = useMemo(() => {
    switch (statusColor) {
      case 'green':
        return 'bg-green-900/40';
      case 'yellow':
        return 'bg-yellow-900/40';
      case 'red':
        return 'bg-red-900/40';
    }
  }, [statusColor]);
  
  // Format time for tooltip/accessibility
  const timeLabel = useMemo(() => {
    if (!state) return '11h 0m';
    const hours = Math.floor(state.criticalRemainingSec / 3600);
    const minutes = Math.floor((state.criticalRemainingSec % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }, [state?.criticalRemainingSec]);
  
  // If not in provider, don't render
  if (!dotHos || !state) return null;
  
  return (
    <div 
      className={cn(
        "flex items-center gap-2 pointer-events-auto",
        className
      )}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(fillPercentage)}
      aria-label={`DOT Hours: ${timeLabel} remaining`}
    >
      {/* Break indicator - only shows when 8h driving reached */}
      {state.needsBreak && (
        <div 
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
            "bg-amber-500/90 text-white animate-pulse",
            "shadow-lg backdrop-blur-sm"
          )}
          title="30 minute break required"
        >
          <Coffee className="h-3 w-3" />
          <span className="hidden sm:inline">30m</span>
        </div>
      )}
      
      {/* Violation warning */}
      {state.isInViolation && (
        <div 
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
            "bg-red-600 text-white",
            fastFlash ? "animate-pulse" : ""
          )}
          title="DOT Violation - Stop driving immediately"
        >
          <AlertTriangle className="h-3 w-3" />
        </div>
      )}
      
      {/* Main DOT bar */}
      <div 
        className={cn(
          "relative w-24 h-3 rounded-full overflow-hidden",
          "shadow-lg backdrop-blur-sm border border-white/20",
          bgColorClass,
          statusColor === 'red' && fastFlash && "ring-2 ring-red-400 ring-opacity-75"
        )}
      >
        {/* Fill bar - decreases as time is consumed */}
        <div 
          className={cn(
            "absolute top-0 left-0 h-full rounded-full transition-all duration-1000",
            barColorClass
          )}
          style={{ width: `${fillPercentage}%` }}
        />
        
        {/* Subtle gradient overlay for depth */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
      </div>
      
      {/* Small DOT label */}
      <span 
        className={cn(
          "text-[10px] font-bold uppercase tracking-wide",
          "text-white/80 drop-shadow-md"
        )}
      >
        DOT
      </span>
    </div>
  );
});

export default DotHosBar;
