import React, { useMemo } from 'react';
import { ArrowUp, Volume2, LogOut } from 'lucide-react';
import ManeuverIcon from './ManeuverIcon';
import { getManeuverIcon } from '@/lib/navigationUtils';
import { HereService, type RouteInstruction } from '@/services/HereService';

interface NavigationHUDProps {
  currentInstruction: RouteInstruction | null;
  distanceToNextManeuver: number;
  instructions?: RouteInstruction[];
  currentInstructionIndex?: number;
  onRepeat?: () => void;
}

// Extract exit number from instruction text
function extractExitNumber(instruction: string): string | null {
  // Match patterns like "exit 126A", "Exit 27", "exit onto 45B"
  const exitMatch = instruction.match(/exit\s*(?:onto\s*)?(\d+[A-Za-z]?)/i);
  return exitMatch ? exitMatch[1] : null;
}

// Find the next exit in the route
function findNextExit(
  instructions: RouteInstruction[],
  currentIndex: number
): { exitNumber: string; distanceToExit: number } | null {
  if (!instructions || currentIndex < 0) return null;

  let accumulatedDistance = 0;

  for (let i = currentIndex; i < instructions.length; i++) {
    const inst = instructions[i];
    
    // Check exitInfo field first (more reliable)
    if (inst.exitInfo) {
      return {
        exitNumber: inst.exitInfo,
        distanceToExit: accumulatedDistance,
      };
    }
    
    // Fallback: check instruction text for exit patterns
    const exitNum = extractExitNumber(inst.instruction || '');
    if (exitNum) {
      return {
        exitNumber: exitNum,
        distanceToExit: accumulatedDistance,
      };
    }

    // Accumulate distance for subsequent instructions
    if (i > currentIndex) {
      accumulatedDistance += inst.length || 0;
    }
  }

  return null;
}

const NavigationHUD = ({
  currentInstruction,
  distanceToNextManeuver,
  instructions,
  currentInstructionIndex,
  onRepeat,
}: NavigationHUDProps) => {
  const maneuverType = currentInstruction
    ? getManeuverIcon(currentInstruction.instruction)
    : 'straight';

  // Get road name for display
  const roadName = currentInstruction?.roadName || '';
  
  // Find next exit info
  const nextExit = useMemo(() => {
    if (!instructions || currentInstructionIndex === undefined) return null;
    return findNextExit(instructions, currentInstructionIndex);
  }, [instructions, currentInstructionIndex]);
  
  // Check if current instruction IS the exit
  const isCurrentExit = currentInstruction?.exitInfo || 
    extractExitNumber(currentInstruction?.instruction || '');
  
  // Format instruction - extract key action
  const instructionText = currentInstruction?.instruction || 'Continue';
  const isStayOn = instructionText.toLowerCase().includes('stay on') || 
                   instructionText.toLowerCase().includes('continue');

  return (
    <div className="absolute top-4 left-4 z-30 safe-top">
      {/* Floating HUD Card - Trucker Path style */}
      <div className="bg-card/95 backdrop-blur-md rounded-2xl shadow-2xl border border-border/50 overflow-hidden min-w-[180px] max-w-[220px]">
        {/* Top section - maneuver icon and action */}
        <div className="p-3 pb-2">
          <div className="flex items-start gap-2">
            {/* Maneuver icon */}
            <div className="shrink-0">
              <ManeuverIcon maneuver={maneuverType} className="w-8 h-8 text-foreground" />
            </div>
            
            {/* Text content */}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground leading-tight truncate">
                {isStayOn ? 'Stay on' : 'Turn onto'}
              </p>
              <p className="text-base font-bold text-foreground leading-tight truncate">
                {roadName || 'Route'}
              </p>
            </div>
          </div>
        </div>
        
        {/* Distance display - large and prominent */}
        <div className="px-3 pb-2">
          <p className="text-3xl font-black text-foreground leading-none">
            {HereService.formatDistance(distanceToNextManeuver)}
          </p>
        </div>
        
        {/* Next Exit badge - always visible if there's an upcoming exit */}
        {nextExit && (
          <div className="px-3 pb-3">
            <div className="inline-flex items-center gap-1.5 bg-success text-success-foreground px-3 py-1.5 rounded-lg">
              <LogOut className="w-4 h-4" />
              <span className="text-sm font-bold">Exit {nextExit.exitNumber}</span>
              {/* Show distance to exit if it's not the current maneuver */}
              {!isCurrentExit && nextExit.distanceToExit > 0 && (
                <span className="text-xs opacity-80 ml-1">
                  • {HereService.formatDistance(distanceToNextManeuver + nextExit.distanceToExit)}
                </span>
              )}
            </div>
          </div>
        )}
        
        {/* Repeat button */}
        {onRepeat && (
          <button
            onClick={onRepeat}
            className="w-full py-2 border-t border-border/50 flex items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
          >
            <Volume2 className="w-4 h-4" />
            <span className="text-xs">Repeat</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default NavigationHUD;
