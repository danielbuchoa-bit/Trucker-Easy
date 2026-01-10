import React, { useMemo } from 'react';
import { LogOut, ArrowUp, ArrowRight, ArrowUpRight } from 'lucide-react';
import ManeuverIcon from './ManeuverIcon';
import { HereService, type RouteInstruction } from '@/services/HereService';

interface LaneGuidanceProps {
  instruction: RouteInstruction | null;
  distanceToManeuver: number;
  instructions?: RouteInstruction[];
  currentInstructionIndex?: number;
  visible: boolean;
}

// Extract exit number from instruction text
function extractExitInfo(instruction: string): { exitNumber: string | null; roadName: string | null } {
  // Match patterns like \"exit 126A\", \"Exit 27\", \"exit onto 45B\"
  const exitMatch = instruction.match(/exit\s*(?:onto\s*)?(\d+[A-Za-z]?)/i);
  
  // Extract road name patterns like \"I-90 W\", \"US-20\", \"Kennedy Expy W\"
  const roadMatch = instruction.match(/(?:onto|toward|via)\s+([A-Z][A-Za-z0-9\-\s\/]+)/i);
  
  return {
    exitNumber: exitMatch ? exitMatch[1] : null,
    roadName: roadMatch ? roadMatch[1].trim() : null,
  };
}

// Determine lane configuration based on maneuver type
function getLaneConfig(instruction: string): { 
  totalLanes: number; 
  activeLanes: number[]; 
  exitPosition: 'left' | 'right';
  isExit: boolean;
} {
  const lower = instruction.toLowerCase();
  const isExit = lower.includes('exit') || lower.includes('ramp');
  const isLeft = lower.includes('left');
  const isRight = lower.includes('right') || (!isLeft && isExit);
  
  // Default configuration for highway exit
  if (isExit) {
    if (isLeft) {
      return { totalLanes: 4, activeLanes: [0], exitPosition: 'left', isExit: true };
    }
    return { totalLanes: 4, activeLanes: [3], exitPosition: 'right', isExit: true };
  }
  
  // Fork or keep maneuvers
  if (lower.includes('fork') || lower.includes('keep')) {
    if (isLeft) {
      return { totalLanes: 3, activeLanes: [0, 1], exitPosition: 'left', isExit: false };
    }
    return { totalLanes: 3, activeLanes: [1, 2], exitPosition: 'right', isExit: false };
  }
  
  return { totalLanes: 3, activeLanes: [1], exitPosition: 'right', isExit: false };
}

const LaneGuidancePanel: React.FC<LaneGuidanceProps> = ({
  instruction,
  distanceToManeuver,
  instructions,
  currentInstructionIndex,
  visible,
}) => {
  // Check if this is an exit maneuver and within threshold
  const exitInfo = useMemo(() => {
    if (!instruction) return null;
    
    const info = extractExitInfo(instruction.instruction || '');
    const isExitManeuver = instruction.instruction?.toLowerCase().includes('exit') ||
                          instruction.instruction?.toLowerCase().includes('ramp') ||
                          instruction.exitInfo !== undefined;
    
    // Only show lane guidance within 1 mile (1609m) of exit
    if (!isExitManeuver || distanceToManeuver > 1609) return null;
    
    return {
      exitNumber: instruction.exitInfo || info.exitNumber,
      roadName: info.roadName || instruction.roadName,
      laneConfig: getLaneConfig(instruction.instruction || ''),
    };
  }, [instruction, distanceToManeuver]);

  // Find next instruction for "Then" preview
  const nextInstruction = useMemo(() => {
    if (!instructions || currentInstructionIndex === undefined) return null;
    const nextIdx = currentInstructionIndex + 1;
    if (nextIdx >= instructions.length) return null;
    return instructions[nextIdx];
  }, [instructions, currentInstructionIndex]);

  if (!visible || !exitInfo) return null;

  const { exitNumber, roadName, laneConfig } = exitInfo;

  return (
    <div className="absolute top-4 left-4 z-40 safe-top animate-in slide-in-from-left-4 duration-300">
      <div className="bg-emerald-600 rounded-2xl shadow-2xl overflow-hidden min-w-[200px] max-w-[260px]">
        {/* Header with distance and exit badge */}
        <div className="p-4 pb-2">
          <div className="flex items-center gap-3">
            {/* Maneuver icon */}
            <div className="bg-white/20 rounded-lg p-2">
              <LogOut className="w-8 h-8 text-white" />
            </div>
            
            {/* Distance and exit number */}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-3xl font-black text-white">
                  {HereService.formatDistance(distanceToManeuver)}
                </span>
                {exitNumber && (
                  <div className="bg-white text-emerald-700 px-2 py-0.5 rounded font-bold text-sm flex items-center gap-1">
                    <ArrowUpRight className="w-3 h-3" />
                    {exitNumber}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Road name */}
          {roadName && (
            <p className="text-white/90 text-sm font-medium mt-1 truncate">
              {roadName}
            </p>
          )}
        </div>

        {/* Lane visualization */}
        <div className="relative h-32 bg-gradient-to-b from-sky-300 to-sky-400 overflow-hidden">
          {/* Road surface */}
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-zinc-700 to-zinc-600">
            {/* Road markings - lanes */}
            <div className="absolute inset-0 flex justify-center items-end pb-2">
              <div className="flex gap-1">
                {Array.from({ length: laneConfig.totalLanes }).map((_, idx) => {
                  const isActive = laneConfig.activeLanes.includes(idx);
                  const isExitLane = laneConfig.isExit && 
                    ((laneConfig.exitPosition === 'right' && idx === laneConfig.totalLanes - 1) ||
                     (laneConfig.exitPosition === 'left' && idx === 0));
                  
                  return (
                    <div
                      key={idx}
                      className={`relative h-20 transition-all duration-300 ${
                        isActive ? 'w-10' : 'w-8'
                      }`}
                    >
                      {/* Lane */}
                      <div
                        className={`absolute inset-0 rounded-t-sm ${
                          isActive 
                            ? 'bg-blue-500 border-2 border-blue-300' 
                            : 'bg-zinc-600'
                        }`}
                        style={{
                          transform: isExitLane ? 'skewY(-15deg) translateY(-8px)' : 'none',
                          transformOrigin: 'bottom',
                        }}
                      >
                        {/* Arrow indicator */}
                        {isActive && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            {isExitLane ? (
                              <ArrowUpRight className="w-6 h-6 text-white animate-pulse" />
                            ) : (
                              <ArrowUp className="w-6 h-6 text-white" />
                            )}
                          </div>
                        )}
                      </div>
                      
                      {/* Lane divider (white dashed line) */}
                      {idx < laneConfig.totalLanes - 1 && (
                        <div className="absolute right-0 top-0 h-full flex flex-col justify-evenly translate-x-1">
                          <div className="w-0.5 h-3 bg-white/60" />
                          <div className="w-0.5 h-3 bg-white/60" />
                          <div className="w-0.5 h-3 bg-white/60" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          
          {/* Horizon line */}
          <div className="absolute top-8 left-0 right-0 h-px bg-zinc-500/30" />
        </div>

        {/* Next maneuver preview */}
        {nextInstruction && (
          <div className="bg-zinc-800 p-3 flex items-center gap-2">
            <span className="text-zinc-400 text-xs">Then</span>
            <ManeuverIcon 
              maneuver={nextInstruction.instruction?.toLowerCase().includes('left') ? 'left' : 
                       nextInstruction.instruction?.toLowerCase().includes('right') ? 'right' : 'straight'} 
              className="w-4 h-4 text-white" 
            />
            <span className="text-white text-sm font-medium truncate flex-1">
              {HereService.formatDistance(nextInstruction.length || 0)}
            </span>
          </div>
        )}

        {/* Additional info footer */}
        <div className="bg-zinc-900 px-3 py-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-orange-400">
            <div className="w-2 h-2 rounded-full bg-orange-400" />
            <span>Toll ahead</span>
          </div>
          <span className="text-zinc-400">
            {HereService.formatDistance(distanceToManeuver + 1000)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default LaneGuidancePanel;

