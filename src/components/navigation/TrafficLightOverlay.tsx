import React from 'react';
import { SpeedAlertWithDistance } from '@/types/speedAlerts';
import TrafficLightIcon from './TrafficLightIcon';

interface TrafficLightOverlayProps {
  alerts: SpeedAlertWithDistance[];
  maxToShow?: number;
}

// Format distance for display
function formatDistance(miles: number): string {
  if (miles < 0.1) return `${Math.round(miles * 5280)} ft`;
  return `${miles.toFixed(1)} mi`;
}

const TrafficLightOverlay: React.FC<TrafficLightOverlayProps> = ({
  alerts,
  maxToShow = 3,
}) => {
  // Filter only red light cameras that are approaching (in the direction of travel)
  const trafficLightAlerts = alerts
    .filter(alert => 
      alert.type === 'red_light_camera' && 
      alert.isApproaching && // Only show if in heading cone
      alert.distanceMiles <= 2 // Only show within 2 miles
    )
    .slice(0, maxToShow);

  if (trafficLightAlerts.length === 0) {
    return null;
  }

  return (
    <div className="absolute top-40 left-4 z-40 flex flex-col gap-2 safe-top">
      {trafficLightAlerts.map((alert, index) => {
        const isClose = alert.distanceMiles < 0.25; // Less than 0.25 miles
        const isVeryClose = alert.distanceMiles < 0.1; // Less than 0.1 miles
        
        return (
          <div
            key={alert.id}
            className={`
              rounded-xl shadow-lg overflow-hidden
              animate-in slide-in-from-left-4 duration-300
              ${isVeryClose ? 'ring-2 ring-white animate-pulse' : ''}
            `}
            style={{ 
              animationDelay: `${index * 100}ms`,
              background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)'
            }}
          >
            <div className="p-3 flex items-center gap-3">
              {/* Traffic Light Icon */}
              <div className={`
                bg-white/20 rounded-lg p-2
                ${isVeryClose ? 'animate-bounce' : ''}
              `}>
                <TrafficLightIcon className="w-6 h-6 text-white" />
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-white/90 text-xs font-medium">
                  {isVeryClose ? '⚠️ Red Light Ahead!' : 'Traffic Light'}
                </p>
                <p className="text-white font-bold text-lg leading-tight">
                  {formatDistance(alert.distanceMiles)}
                </p>
                {alert.eta && alert.eta < 60 && (
                  <p className="text-white/70 text-xs">
                    ~{Math.round(alert.eta)}s away
                  </p>
                )}
              </div>

              {/* Visual indicator */}
              <div className="flex flex-col items-center gap-1">
                <div className={`w-3 h-3 rounded-full ${isVeryClose ? 'bg-red-400 animate-pulse' : 'bg-red-400/50'}`} />
                <div className={`w-3 h-3 rounded-full ${isClose && !isVeryClose ? 'bg-yellow-400 animate-pulse' : 'bg-yellow-400/50'}`} />
                <div className={`w-3 h-3 rounded-full ${!isClose ? 'bg-green-400' : 'bg-green-400/50'}`} />
              </div>
            </div>

            {/* Distance bar */}
            <div className="h-1 bg-black/20">
              <div 
                className="h-full bg-white/60 transition-all duration-500"
                style={{ 
                  width: `${Math.max(5, 100 - (alert.distanceMiles * 100))}%` 
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TrafficLightOverlay;
