import React from 'react';

interface SpeedIndicatorProps {
  speedMph: number | null;
  speedLimitMph?: number | null;
}

const SpeedIndicator = ({ speedMph, speedLimitMph = 55 }: SpeedIndicatorProps) => {
  const currentSpeed = speedMph !== null ? Math.round(speedMph) : '--';
  const isOverLimit = speedLimitMph !== null && speedMph !== null && speedMph > speedLimitMph;

  return (
    <div className="flex items-stretch bg-card/95 backdrop-blur-md rounded-xl shadow-lg border border-border/50 overflow-hidden">
      {/* Speed limit box */}
      {speedLimitMph !== null && (
        <div className="flex flex-col items-center justify-center px-3 py-2 bg-card border-r border-border/50">
          <span className="text-[10px] font-bold text-muted-foreground leading-none">
            LIMIT
          </span>
          <span className="text-xl font-black text-foreground leading-none mt-0.5">
            {speedLimitMph}
          </span>
        </div>
      )}
      
      {/* Current speed */}
      <div className="flex flex-col items-center justify-center px-3 py-2 min-w-[56px]">
        <span className={`text-2xl font-black leading-none ${isOverLimit ? 'text-destructive' : 'text-success'}`}>
          {currentSpeed}
        </span>
        <span className="text-[10px] font-bold text-muted-foreground leading-none mt-0.5">
          MPH
        </span>
      </div>
    </div>
  );
};

export default SpeedIndicator;
