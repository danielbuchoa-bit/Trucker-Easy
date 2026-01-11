import React, { useMemo } from 'react';
import { X, ChevronUp, MessageSquare } from 'lucide-react';
import { HereService } from '@/services/HereService';
import { addSeconds, format } from 'date-fns';

interface BottomETABarProps {
  remainingDistance: number; // meters
  remainingDuration: number; // seconds
  roadName?: string;
  cityState?: string;
  onEndNavigation: () => void;
  onMore?: () => void;
}

const BottomETABar = ({
  remainingDistance,
  remainingDuration,
  roadName,
  cityState,
  onEndNavigation,
  onMore,
}: BottomETABarProps) => {
  // Calculate ETA - handle NaN and invalid values
  const eta = useMemo(() => {
    if (typeof remainingDuration !== 'number' || !Number.isFinite(remainingDuration) || remainingDuration <= 0) {
      return null;
    }
    return addSeconds(new Date(), remainingDuration);
  }, [remainingDuration]);

  // Safe formatting - only format if eta is valid
  const etaFormatted = eta ? format(eta, 'hh:mm a') : '--:--';
  const timeZone = eta ? format(eta, 'zzz').replace(/[a-z]/g, '') : '';
  
  // Format distance (convert to miles) - handle NaN
  const distanceMiles = Number.isFinite(remainingDistance) && remainingDistance > 0 
    ? (remainingDistance / 1609.34).toFixed(0) 
    : '--';
  
  // Format duration - handle NaN
  const durationMins = Number.isFinite(remainingDuration) && remainingDuration > 0 
    ? Math.round(remainingDuration / 60) 
    : '--';

  return (
    <div className="absolute bottom-0 inset-x-0 z-30 safe-bottom">
      {/* Road info bar */}
      {(roadName || cityState) && (
        <div className="flex justify-center pb-2">
          <div className="bg-card/80 backdrop-blur-sm px-3 py-1.5 rounded-lg">
            <p className="text-xs text-muted-foreground text-center">
              {roadName && <span className="font-medium text-foreground">{roadName}</span>}
              {roadName && cityState && ' • '}
              {cityState}
            </p>
          </div>
        </div>
      )}
      
      {/* Main ETA bar */}
      <div className="bg-card border-t border-border">
        <div className="flex items-center justify-between px-4 py-3">
          {/* Left - Chat/Report button */}
          <button className="flex flex-col items-center justify-center p-2 bg-success rounded-xl text-success-foreground">
            <MessageSquare className="w-6 h-6" />
            <span className="text-[10px] font-semibold mt-0.5">Tap to Chat</span>
          </button>
          
          {/* Center - Distance and ETA time */}
          <div className="flex-1 flex items-center justify-center gap-4">
            <div className="text-center">
              <span className="text-2xl font-black text-foreground">{distanceMiles}</span>
              <span className="text-sm font-medium text-muted-foreground ml-1">mi</span>
            </div>
            <span className="text-muted-foreground">|</span>
            <div className="text-center">
              <span className="text-2xl font-black text-foreground">{etaFormatted}</span>
              {timeZone && <span className="text-sm font-medium text-muted-foreground ml-1">{timeZone}</span>}
            </div>
          </div>
          
          {/* Right - More/End buttons */}
          <div className="flex flex-col gap-1">
            {onMore && (
              <button 
                onClick={onMore}
                className="flex items-center justify-center gap-1 bg-secondary px-3 py-2 rounded-lg"
              >
                <ChevronUp className="w-4 h-4" />
                <span className="text-sm font-medium">More</span>
              </button>
            )}
            <button 
              onClick={onEndNavigation}
              className="flex items-center justify-center gap-1 bg-destructive/20 text-destructive px-3 py-2 rounded-lg"
            >
              <X className="w-4 h-4" />
              <span className="text-sm font-medium">End</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BottomETABar;
