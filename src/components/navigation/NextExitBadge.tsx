import React from 'react';
import { LogOut } from 'lucide-react';
import { HereService } from '@/services/HereService';

interface NextExitBadgeProps {
  exitNumber: string;
  distanceMeters: number;
  roadName?: string;
  className?: string;
}

/**
 * A highway exit badge displayed in the navigation view
 * Shows exit number and distance in a prominent green badge
 * Styled like Google Maps / Trucker Path exit indicators
 */
const NextExitBadge: React.FC<NextExitBadgeProps> = ({
  exitNumber,
  distanceMeters,
  roadName,
  className = '',
}) => {
  // Format distance - show in miles with 1 decimal
  const formattedDistance = HereService.formatDistance(distanceMeters);
  
  // Clean up exit number - remove "Exit" prefix if present
  const cleanExitNumber = exitNumber.replace(/^exit\s*/i, '').trim();
  
  // Check if it's a numbered exit (like "149") vs a road name
  const isNumberedExit = /^\d+[A-Za-z]?$/.test(cleanExitNumber);
  
  return (
    <div className={`flex flex-col items-end gap-1 ${className}`}>
      {/* Main exit badge - highway green like Google Maps */}
      <div className="flex items-center shadow-lg rounded-lg overflow-hidden">
        {/* Exit arrow icon section */}
        <div className="bg-[hsl(145,63%,35%)] p-2 flex items-center justify-center">
          <LogOut className="w-4 h-4 text-white rotate-[-45deg]" />
        </div>
        
        {/* Exit number in white on green */}
        <div className="bg-[hsl(145,63%,42%)] px-2 py-1.5">
          <span className="font-black text-white text-lg leading-none">
            {isNumberedExit ? cleanExitNumber : 'EXIT'}
          </span>
        </div>
        
        {/* Distance on lighter green background */}
        <div className="bg-[hsl(145,50%,50%)] px-2.5 py-1.5">
          <span className="text-white font-bold text-sm leading-none">
            {formattedDistance}
          </span>
        </div>
      </div>
      
      {/* Road name indicator */}
      {roadName && (
        <span className="text-xs text-white font-medium drop-shadow-lg bg-black/40 px-2 py-0.5 rounded truncate max-w-[150px]">
          → {roadName}
        </span>
      )}
    </div>
  );
};

export default NextExitBadge;
