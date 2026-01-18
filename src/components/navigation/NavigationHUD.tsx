import React, { useMemo } from 'react';
import { Volume2, LogOut, CornerUpRight, CornerUpLeft, ArrowUp, TrendingUp, TrendingDown, RotateCw } from 'lucide-react';
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
  const exitMatch = instruction.match(/exit\s*(?:onto\s*)?(\d+[A-Za-z]?)/i);
  return exitMatch ? exitMatch[1] : null;
}

// Find the next exit in the route - look ahead up to 10 miles
function findNextExit(
  instructions: RouteInstruction[],
  currentIndex: number
): { exitNumber: string; distanceToExit: number; roadName?: string } | null {
  if (!instructions || currentIndex < 0) return null;

  let accumulatedDistance = 0;
  const maxLookAheadMeters = 16093; // 10 miles

  for (let i = currentIndex; i < instructions.length; i++) {
    const inst = instructions[i];
    
    // Check for exit info in instruction
    if (inst.exitInfo) {
      return {
        exitNumber: inst.exitInfo,
        distanceToExit: accumulatedDistance,
        roadName: inst.roadName,
      };
    }
    
    // Try to extract exit number from instruction text
    const exitNum = extractExitNumber(inst.instruction || '');
    if (exitNum) {
      return {
        exitNumber: exitNum,
        distanceToExit: accumulatedDistance,
        roadName: inst.roadName,
      };
    }
    
    // Check if instruction contains exit/ramp keywords
    const lower = (inst.instruction || '').toLowerCase();
    if (lower.includes('exit') || lower.includes('ramp') || lower.includes('off ramp')) {
      // Try to get a meaningful exit identifier
      const roadMatch = lower.match(/(?:onto|toward)\s+([A-Za-z0-9\-\s\/]+)/i);
      return {
        exitNumber: roadMatch ? roadMatch[1].trim() : (inst.roadName || 'Exit'),
        distanceToExit: accumulatedDistance,
        roadName: inst.roadName,
      };
    }

    if (i > currentIndex) {
      accumulatedDistance += inst.length || 0;
    }
    
    // Stop looking if we're too far ahead
    if (accumulatedDistance > maxLookAheadMeters) break;
  }

  return null;
}

// Get maneuver description from modifier
function getManeuverDescription(modifier: string | undefined, instruction: string): string | null {
  if (!modifier) return null;
  
  const modifierMap: Record<string, string> = {
    'slight left': 'Slight Left',
    'slight right': 'Slight Right',
    'sharp left': 'Sharp Left', 
    'sharp right': 'Sharp Right',
    'left': 'Turn Left',
    'right': 'Turn Right',
    'uturn': 'U-Turn',
    'straight': 'Continue',
  };
  
  return modifierMap[modifier.toLowerCase()] || null;
}

// Get maneuver icon component based on modifier
function getManeuverBadgeIcon(modifier: string | undefined) {
  if (!modifier) return null;
  
  const mod = modifier.toLowerCase();
  
  if (mod.includes('left')) {
    if (mod.includes('slight')) return <TrendingDown className="w-4 h-4 rotate-90" />;
    if (mod.includes('sharp')) return <CornerUpLeft className="w-4 h-4" />;
    return <CornerUpLeft className="w-4 h-4" />;
  }
  
  if (mod.includes('right')) {
    if (mod.includes('slight')) return <TrendingUp className="w-4 h-4 rotate-90" />;
    if (mod.includes('sharp')) return <CornerUpRight className="w-4 h-4" />;
    return <CornerUpRight className="w-4 h-4" />;
  }
  
  if (mod.includes('uturn')) return <RotateCw className="w-4 h-4" />;
  if (mod.includes('straight')) return <ArrowUp className="w-4 h-4" />;
  
  return null;
}

const NavigationHUD = ({
  currentInstruction,
  distanceToNextManeuver,
  instructions,
  currentInstructionIndex,
  onRepeat,
}: NavigationHUDProps) => {
  // Pass maneuverType (action) to getManeuverIcon for better accuracy
  const maneuverType = currentInstruction
    ? getManeuverIcon(currentInstruction.instruction, currentInstruction.action)
    : 'straight';

  // Get road name for display
  const roadName = currentInstruction?.roadName || '';
  
  // Get modifier for maneuver badge
  const modifier = (currentInstruction as any)?.modifier;
  const maneuverDescription = getManeuverDescription(modifier, currentInstruction?.instruction || '');
  const maneuverBadgeIcon = getManeuverBadgeIcon(modifier);
  
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

  // Determine action text based on instruction
  const getActionText = () => {
    const text = instructionText.toLowerCase();
    if (text.includes('turn left')) return 'Turn left onto';
    if (text.includes('turn right')) return 'Turn right onto';
    if (text.includes('slight left')) return 'Slight left onto';
    if (text.includes('slight right')) return 'Slight right onto';
    if (text.includes('sharp left')) return 'Sharp left onto';
    if (text.includes('sharp right')) return 'Sharp right onto';
    if (text.includes('merge')) return 'Merge onto';
    if (text.includes('exit')) return 'Exit onto';
    if (text.includes('u-turn') || text.includes('uturn')) return 'U-turn onto';
    if (isStayOn) return 'Stay on';
    return 'Continue on';
  };

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
                {getActionText()}
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
        
        {/* Maneuver Badge - shows when no exit info but has modifier */}
        {!nextExit && maneuverDescription && maneuverBadgeIcon && (
          <div className="px-3 pb-3">
            <div className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg">
              {maneuverBadgeIcon}
              <span className="text-sm font-bold">{maneuverDescription}</span>
            </div>
          </div>
        )}
        
      {/* Next Exit badge - always visible if there's an upcoming exit */}
      {nextExit && (
        <div className="px-3 pb-3">
          <div className="flex flex-col gap-1">
            <div className="inline-flex items-center gap-1.5 bg-success text-success-foreground px-3 py-1.5 rounded-lg">
              <LogOut className="w-4 h-4" />
              <span className="text-sm font-bold">Exit {nextExit.exitNumber}</span>
              {/* Show distance to exit */}
              <span className="text-xs opacity-80 ml-1">
                • {HereService.formatDistance(
                  isCurrentExit ? distanceToNextManeuver : (distanceToNextManeuver + nextExit.distanceToExit)
                )}
              </span>
            </div>
            {/* Show road name if available */}
            {nextExit.roadName && (
              <span className="text-xs text-muted-foreground pl-1 truncate">
                → {nextExit.roadName}
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
