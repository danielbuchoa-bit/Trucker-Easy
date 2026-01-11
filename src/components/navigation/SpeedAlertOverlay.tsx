import React, { useEffect, useRef } from 'react';
import { Camera, AlertTriangle, Shield, Car, Construction, GraduationCap, Scale, Gauge, X, ThumbsUp, ThumbsDown } from 'lucide-react';
import { SpeedAlertWithDistance, ALERT_TYPE_CONFIG, SpeedAlertType } from '@/types/speedAlerts';
import { Button } from '@/components/ui/button';

interface SpeedAlertOverlayProps {
  criticalAlert: SpeedAlertWithDistance | null;
  warningAlerts: SpeedAlertWithDistance[];
  currentSpeedMph: number;
  onDismiss: (id: string) => void;
  onConfirm?: (id: string) => void;
  onDeny?: (id: string) => void;
}

// Get icon for alert type
function getAlertIcon(type: SpeedAlertType, className: string) {
  switch (type) {
    case 'speed_camera':
      return <Camera className={className} />;
    case 'red_light_camera':
      return <AlertTriangle className={className} />;
    case 'average_speed':
      return <Gauge className={className} />;
    case 'mobile_patrol':
      return <Car className={className} />;
    case 'enforcement_zone':
      return <Shield className={className} />;
    case 'school_zone':
      return <GraduationCap className={className} />;
    case 'construction_zone':
      return <Construction className={className} />;
    case 'weigh_station':
      return <Scale className={className} />;
    default:
      return <AlertTriangle className={className} />;
  }
}

// Format distance for display
function formatDistance(miles: number): string {
  if (miles < 0.1) return `${Math.round(miles * 5280)} ft`;
  return `${miles.toFixed(1)} mi`;
}

const SpeedAlertOverlay: React.FC<SpeedAlertOverlayProps> = ({
  criticalAlert,
  warningAlerts,
  currentSpeedMph,
  onDismiss,
  onConfirm,
  onDeny,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastPlayedRef = useRef<string | null>(null);

  // Play alert sound for critical alerts
  useEffect(() => {
    if (criticalAlert && criticalAlert.id !== lastPlayedRef.current) {
      const config = ALERT_TYPE_CONFIG[criticalAlert.type];
      if (config.soundAlert) {
        // Create a simple beep sound using Web Audio API
        try {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          oscillator.frequency.value = 880; // A5 note
          oscillator.type = 'sine';
          gainNode.gain.value = 0.3;
          
          oscillator.start();
          
          // Two short beeps
          setTimeout(() => {
            gainNode.gain.value = 0;
          }, 150);
          setTimeout(() => {
            gainNode.gain.value = 0.3;
          }, 200);
          setTimeout(() => {
            oscillator.stop();
            audioContext.close();
          }, 350);
          
          lastPlayedRef.current = criticalAlert.id;
        } catch (e) {
          console.log('[SPEED_ALERT] Audio not available');
        }
      }
    }
  }, [criticalAlert]);

  // Check if speeding
  const isSpeeding = criticalAlert?.speedLimitMph && currentSpeedMph > criticalAlert.speedLimitMph;

  return (
    <>
      {/* Critical Alert - Full width banner at top */}
      {criticalAlert && (
        <div 
          className={`
            absolute top-20 left-4 right-4 z-50 safe-top
            animate-in slide-in-from-top-4 duration-300
          `}
        >
          <div 
            className={`
              rounded-2xl shadow-2xl overflow-hidden
              ${isSpeeding ? 'bg-red-600 animate-pulse' : ALERT_TYPE_CONFIG[criticalAlert.type].bgColor}
            `}
          >
            <div className="p-4">
              <div className="flex items-center gap-4">
                {/* Icon */}
                <div className="bg-white/20 rounded-xl p-3">
                  {getAlertIcon(criticalAlert.type, 'w-8 h-8 text-white')}
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold text-lg">
                      {ALERT_TYPE_CONFIG[criticalAlert.type].label}
                    </span>
                    {criticalAlert.speedLimitMph && (
                      <div className="bg-white text-black px-2 py-0.5 rounded-lg font-black text-lg">
                        {criticalAlert.speedLimitMph}
                      </div>
                    )}
                  </div>
                  <p className="text-white/80 text-sm truncate">
                    {criticalAlert.name || formatDistance(criticalAlert.distanceMiles)}
                  </p>
                </div>
                
                {/* Distance */}
                <div className="text-right">
                  <p className="text-2xl font-black text-white">
                    {formatDistance(criticalAlert.distanceMiles)}
                  </p>
                  {criticalAlert.eta && criticalAlert.eta < 60 && (
                    <p className="text-white/70 text-xs">
                      {Math.round(criticalAlert.eta)}s
                    </p>
                  )}
                </div>
                
                {/* Dismiss button */}
                <button
                  onClick={() => onDismiss(criticalAlert.id)}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
              
              {/* Speed warning */}
              {isSpeeding && (
                <div className="mt-3 bg-white/20 rounded-lg p-2 flex items-center justify-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-white" />
                  <span className="text-white font-bold">
                    SLOW DOWN - {currentSpeedMph} mph in {criticalAlert.speedLimitMph} zone
                  </span>
                </div>
              )}
              
              {/* Confirmation buttons for user-reported alerts */}
              {criticalAlert.reportedAt && onConfirm && onDeny && (
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1 bg-white/20 hover:bg-white/30 text-white"
                    onClick={() => onConfirm(criticalAlert.id)}
                  >
                    <ThumbsUp className="w-4 h-4 mr-1" />
                    Still there
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1 bg-white/20 hover:bg-white/30 text-white"
                    onClick={() => onDeny(criticalAlert.id)}
                  >
                    <ThumbsDown className="w-4 h-4 mr-1" />
                    Not there
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Warning Alerts - Stack on the right side */}
      {warningAlerts.length > 0 && !criticalAlert && (
        <div className="absolute top-56 right-4 z-40 flex flex-col gap-2">
          {warningAlerts.slice(0, 3).map((alert) => (
            <div
              key={alert.id}
              className={`
                ${ALERT_TYPE_CONFIG[alert.type].bgColor}
                rounded-xl shadow-lg p-2.5 min-w-[140px]
                animate-in slide-in-from-right-4 duration-300
              `}
            >
              <div className="flex items-center gap-2">
                {getAlertIcon(alert.type, 'w-5 h-5 text-white')}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-medium truncate">
                    {ALERT_TYPE_CONFIG[alert.type].shortLabel}
                  </p>
                  <p className="text-white font-bold text-sm">
                    {formatDistance(alert.distanceMiles)}
                  </p>
                </div>
                {alert.speedLimitMph && (
                  <div className="bg-white text-black px-1.5 py-0.5 rounded text-xs font-bold">
                    {alert.speedLimitMph}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default SpeedAlertOverlay;
