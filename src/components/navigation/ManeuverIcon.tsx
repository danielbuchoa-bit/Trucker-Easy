import React from 'react';
import {
  ArrowUp,
  CornerUpLeft,
  CornerUpRight,
  RotateCcw,
  GitMerge,
  LogOut,
  Circle,
  MapPin,
} from 'lucide-react';

interface ManeuverIconProps {
  maneuver: string;
  className?: string;
}

const ManeuverIcon = ({ maneuver, className = 'w-8 h-8' }: ManeuverIconProps) => {
  switch (maneuver) {
    case 'turn-left':
      return <CornerUpLeft className={className} />;
    case 'turn-right':
      return <CornerUpRight className={className} />;
    case 'u-turn':
      return <RotateCcw className={className} />;
    case 'merge':
      return <GitMerge className={className} />;
    case 'exit':
      return <LogOut className={className} />;
    case 'roundabout':
      return <Circle className={className} />;
    case 'destination':
      return <MapPin className={className} />;
    case 'straight':
    default:
      return <ArrowUp className={className} />;
  }
};

export default ManeuverIcon;
