import React, { useState } from 'react';
import { 
  Camera, 
  Car, 
  Construction, 
  Shield, 
  Scale,
  GraduationCap,
  Gauge,
  AlertTriangle,
  ThumbsUp, 
  ThumbsDown, 
  Clock, 
  MapPin,
  Users,
  X
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { SpeedAlertWithDistance, SpeedAlertType, ALERT_TYPE_CONFIG } from '@/types/speedAlerts';
import { toast } from 'sonner';

interface SpeedAlertDetailsSheetProps {
  alert: SpeedAlertWithDistance | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (alertId: string) => Promise<void>;
  onDeny: (alertId: string) => Promise<void>;
  userPosition?: { lat: number; lng: number } | null;
}

function getAlertIcon(type: SpeedAlertType) {
  const iconProps = { className: "w-6 h-6" };
  
  switch (type) {
    case 'speed_camera':
      return <Camera {...iconProps} />;
    case 'red_light_camera':
      return <AlertTriangle {...iconProps} />;
    case 'mobile_patrol':
      return <Car {...iconProps} />;
    case 'enforcement_zone':
      return <Shield {...iconProps} />;
    case 'school_zone':
      return <GraduationCap {...iconProps} />;
    case 'construction_zone':
      return <Construction {...iconProps} />;
    case 'average_speed':
      return <Gauge {...iconProps} />;
    case 'weigh_station':
      return <Scale {...iconProps} />;
    default:
      return <AlertTriangle {...iconProps} />;
  }
}

function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  const miles = meters / 1609.34;
  return `${miles.toFixed(1)} mi`;
}

function formatTimeAgo(dateString?: string): string {
  if (!dateString) return 'Unknown';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

const SpeedAlertDetailsSheet: React.FC<SpeedAlertDetailsSheetProps> = ({
  alert,
  open,
  onOpenChange,
  onConfirm,
  onDeny,
}) => {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDenying, setIsDenying] = useState(false);

  if (!alert) return null;

  const config = ALERT_TYPE_CONFIG[alert.type];
  const isUserReported = alert.source === 'user';
  const reliability = alert.confirmations && alert.denials !== undefined
    ? Math.round((alert.confirmations / (alert.confirmations + alert.denials)) * 100)
    : null;

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm(alert.id);
      toast.success('Alert confirmed!', {
        description: 'Thanks for helping other drivers.',
      });
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to confirm alert');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleDeny = async () => {
    setIsDenying(true);
    try {
      await onDeny(alert.id);
      toast.success('Alert reported as gone', {
        description: 'Thanks for the update.',
      });
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to report alert');
    } finally {
      setIsDenying(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-auto max-h-[60vh] rounded-t-xl">
        <SheetHeader className="pb-2">
          <SheetTitle className="flex items-center gap-3">
            <div className={`${config.bgColor} p-2 rounded-full text-white`}>
              {getAlertIcon(alert.type)}
            </div>
            <div className="flex-1 text-left">
              <div className="text-lg font-semibold">{config.label}</div>
              <div className="text-sm text-muted-foreground font-normal flex items-center gap-2">
                <MapPin className="w-3 h-3" />
                {formatDistance(alert.distanceMeters)} ahead
              </div>
            </div>
            {isUserReported && (
              <div className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full flex items-center gap-1">
                <Users className="w-3 h-3" />
                User Report
              </div>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 pt-4">
          {/* Alert Details */}
          <div className="grid grid-cols-2 gap-3">
            {alert.speedLimit && (
              <div className="bg-muted rounded-lg p-3">
                <div className="text-xs text-muted-foreground">Speed Limit</div>
                <div className="text-xl font-bold">{alert.speedLimit} mph</div>
              </div>
            )}
            
            {alert.eta && (
              <div className="bg-muted rounded-lg p-3">
                <div className="text-xs text-muted-foreground">ETA</div>
                <div className="text-xl font-bold">
                  {alert.eta < 60 ? `${Math.round(alert.eta)}s` : `${Math.round(alert.eta / 60)}m`}
                </div>
              </div>
            )}

            {alert.reportedAt && (
              <div className="bg-muted rounded-lg p-3">
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Reported
                </div>
                <div className="text-lg font-semibold">{formatTimeAgo(alert.reportedAt)}</div>
              </div>
            )}

            {reliability !== null && (
              <div className="bg-muted rounded-lg p-3">
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  Reliability
                </div>
                <div className="text-lg font-semibold">
                  {reliability}%
                  <span className="text-xs text-muted-foreground ml-1">
                    ({alert.confirmations} confirms)
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Description if available */}
          {alert.description && (
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm text-muted-foreground">{alert.description}</p>
            </div>
          )}

          {/* Action Buttons - Only for user-reported alerts */}
          {isUserReported && (
            <div className="pt-2 space-y-3">
              <p className="text-xs text-center text-muted-foreground">
                Is this alert still accurate?
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 h-12 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={handleDeny}
                  disabled={isDenying || isConfirming}
                >
                  {isDenying ? (
                    <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <ThumbsDown className="w-5 h-5 mr-2" />
                      Not There
                    </>
                  )}
                </Button>
                <Button
                  className="flex-1 h-12 bg-green-600 hover:bg-green-700"
                  onClick={handleConfirm}
                  disabled={isDenying || isConfirming}
                >
                  {isConfirming ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <ThumbsUp className="w-5 h-5 mr-2" />
                      Still There
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Close Button for HERE alerts */}
          {!isUserReported && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => onOpenChange(false)}
            >
              <X className="w-4 h-4 mr-2" />
              Close
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default SpeedAlertDetailsSheet;
