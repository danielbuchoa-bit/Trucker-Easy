import React from 'react';
import { Clock, MapPin, X, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ManeuverIcon from './ManeuverIcon';
import { getManeuverIcon } from '@/lib/navigationUtils';
import { HereService, type RouteInstruction } from '@/services/HereService';
import { useLanguage } from '@/i18n/LanguageContext';

interface NavigationHUDProps {
  currentInstruction: RouteInstruction | null;
  distanceToNextManeuver: number;
  remainingDistance: number;
  remainingDuration: number;
  onEndNavigation: () => void;
  onRepeat?: () => void;
}

const NavigationHUD = ({
  currentInstruction,
  distanceToNextManeuver,
  remainingDistance,
  remainingDuration,
  onEndNavigation,
  onRepeat,
}: NavigationHUDProps) => {
  const { t } = useLanguage();
  const maneuverType = currentInstruction
    ? getManeuverIcon(currentInstruction.instruction)
    : 'straight';

  // Get road name for display
  const roadName = currentInstruction?.roadName || '';
  const displayInstruction = currentInstruction?.instruction || t.navigation?.continueOn || 'Continue';

  return (
    <div className="absolute inset-x-0 top-0 z-30 safe-top">
      {/* Instruction panel */}
      <div className="bg-primary text-primary-foreground p-4 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-primary-foreground/20 rounded-xl flex items-center justify-center shrink-0">
            <ManeuverIcon maneuver={maneuverType} className="w-10 h-10" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-3xl font-bold">
              {HereService.formatDistance(distanceToNextManeuver)}
            </p>
            <p className="text-sm opacity-90 truncate">
              {displayInstruction}
            </p>
            {roadName && (
              <p className="text-xs opacity-75 truncate">
                {roadName}
              </p>
            )}
          </div>
          {onRepeat && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onRepeat}
              className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/20"
            >
              <Volume2 className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="bg-card/95 backdrop-blur-sm border-b border-border p-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium">{HereService.formatDuration(remainingDuration)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium">{HereService.formatDistance(remainingDistance)}</span>
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={onEndNavigation}
          className="h-8"
        >
          <X className="w-4 h-4 mr-1" />
          {t.navigation?.endNavigation || 'End'}
        </Button>
      </div>
    </div>
  );
};

export default NavigationHUD;
