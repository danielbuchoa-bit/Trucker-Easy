import React, { useMemo } from 'react';
import { LogOut, ArrowUp, ArrowUpRight, ArrowUpLeft, CornerUpRight, CornerUpLeft, ArrowRight, ArrowLeft, RotateCw } from 'lucide-react';
import ManeuverIcon from './ManeuverIcon';
import { HereService, type RouteInstruction } from '@/services/HereService';

interface LaneGuidanceProps {
  instruction: RouteInstruction | null;
  distanceToManeuver: number;
  instructions?: RouteInstruction[];
  currentInstructionIndex?: number;
  visible: boolean;
}

type ManeuverType = 'exit-right' | 'exit-left' | 'turn-right' | 'turn-left' | 
                    'slight-right' | 'slight-left' | 'sharp-right' | 'sharp-left' |
                    'fork-right' | 'fork-left' | 'merge' | 'uturn' | 'straight';

interface LaneConfig {
  totalLanes: number;
  activeLanes: number[];
  laneArrows: ManeuverType[];
  maneuverType: ManeuverType;
}

// Determine maneuver type from instruction
function getManeuverType(instruction: string, modifier?: string): ManeuverType {
  const lower = instruction.toLowerCase();
  const mod = modifier?.toLowerCase() || '';
  
  // Check for exit
  if (lower.includes('exit') || lower.includes('ramp') || lower.includes('off ramp')) {
    if (mod.includes('left') || lower.includes('left')) return 'exit-left';
    return 'exit-right';
  }
  
  // Check for fork/keep
  if (lower.includes('fork') || lower.includes('keep')) {
    if (mod.includes('left') || lower.includes('left')) return 'fork-left';
    return 'fork-right';
  }
  
  // Check for merge
  if (lower.includes('merge')) return 'merge';
  
  // Check for U-turn
  if (lower.includes('u-turn') || lower.includes('uturn') || mod.includes('uturn')) return 'uturn';
  
  // Check for turns based on modifier first, then instruction
  if (mod.includes('sharp left') || lower.includes('sharp left')) return 'sharp-left';
  if (mod.includes('sharp right') || lower.includes('sharp right')) return 'sharp-right';
  if (mod.includes('slight left') || lower.includes('slight left')) return 'slight-left';
  if (mod.includes('slight right') || lower.includes('slight right')) return 'slight-right';
  if (mod.includes('left') || lower.includes('turn left')) return 'turn-left';
  if (mod.includes('right') || lower.includes('turn right')) return 'turn-right';
  
  return 'straight';
}

// Get lane configuration based on maneuver
function getLaneConfig(maneuverType: ManeuverType): LaneConfig {
  switch (maneuverType) {
    case 'exit-right':
      return {
        totalLanes: 4,
        activeLanes: [3],
        laneArrows: ['straight', 'straight', 'straight', 'exit-right'],
        maneuverType,
      };
    case 'exit-left':
      return {
        totalLanes: 4,
        activeLanes: [0],
        laneArrows: ['exit-left', 'straight', 'straight', 'straight'],
        maneuverType,
      };
    case 'turn-right':
    case 'sharp-right':
      return {
        totalLanes: 3,
        activeLanes: [2],
        laneArrows: ['straight', 'straight', 'turn-right'],
        maneuverType,
      };
    case 'turn-left':
    case 'sharp-left':
      return {
        totalLanes: 3,
        activeLanes: [0],
        laneArrows: ['turn-left', 'straight', 'straight'],
        maneuverType,
      };
    case 'slight-right':
    case 'fork-right':
      return {
        totalLanes: 3,
        activeLanes: [1, 2],
        laneArrows: ['straight', 'slight-right', 'slight-right'],
        maneuverType,
      };
    case 'slight-left':
    case 'fork-left':
      return {
        totalLanes: 3,
        activeLanes: [0, 1],
        laneArrows: ['slight-left', 'slight-left', 'straight'],
        maneuverType,
      };
    case 'merge':
      return {
        totalLanes: 3,
        activeLanes: [1],
        laneArrows: ['straight', 'straight', 'straight'],
        maneuverType,
      };
    case 'uturn':
      return {
        totalLanes: 3,
        activeLanes: [0],
        laneArrows: ['uturn', 'straight', 'straight'],
        maneuverType,
      };
    default:
      return {
        totalLanes: 3,
        activeLanes: [1],
        laneArrows: ['straight', 'straight', 'straight'],
        maneuverType: 'straight',
      };
  }
}

// Get arrow icon for lane
function getLaneArrowIcon(arrowType: ManeuverType, isActive: boolean) {
  const className = `w-5 h-5 ${isActive ? 'text-white' : 'text-zinc-400'}`;
  
  switch (arrowType) {
    case 'exit-right':
    case 'slight-right':
      return <ArrowUpRight className={className} />;
    case 'exit-left':
    case 'slight-left':
      return <ArrowUpLeft className={className} />;
    case 'turn-right':
    case 'sharp-right':
      return <CornerUpRight className={className} />;
    case 'turn-left':
    case 'sharp-left':
      return <CornerUpLeft className={className} />;
    case 'fork-right':
      return <ArrowUpRight className={className} />;
    case 'fork-left':
      return <ArrowUpLeft className={className} />;
    case 'uturn':
      return <RotateCw className={className} />;
    default:
      return <ArrowUp className={className} />;
  }
}

// Get maneuver icon for header
function getManeuverHeaderIcon(maneuverType: ManeuverType) {
  switch (maneuverType) {
    case 'exit-right':
    case 'exit-left':
      return <LogOut className="w-7 h-7 text-white" />;
    case 'turn-right':
    case 'sharp-right':
      return <CornerUpRight className="w-7 h-7 text-white" />;
    case 'turn-left':
    case 'sharp-left':
      return <CornerUpLeft className="w-7 h-7 text-white" />;
    case 'slight-right':
    case 'fork-right':
      return <ArrowUpRight className="w-7 h-7 text-white" />;
    case 'slight-left':
    case 'fork-left':
      return <ArrowUpLeft className="w-7 h-7 text-white" />;
    case 'uturn':
      return <RotateCw className="w-7 h-7 text-white" />;
    default:
      return <ArrowUp className="w-7 h-7 text-white" />;
  }
}

// Get background color based on maneuver type
function getManeuverColor(maneuverType: ManeuverType): string {
  if (maneuverType.includes('exit')) return 'bg-emerald-600';
  if (maneuverType.includes('turn') || maneuverType.includes('sharp')) return 'bg-blue-600';
  if (maneuverType.includes('fork') || maneuverType.includes('slight')) return 'bg-indigo-600';
  if (maneuverType === 'uturn') return 'bg-amber-600';
  return 'bg-zinc-700';
}

// Extract exit/road info from instruction
function extractExitInfo(instruction: string, exitInfo?: string, roadName?: string): { 
  exitNumber: string | null; 
  destination: string | null;
} {
  // Use provided exitInfo first
  if (exitInfo) {
    return { exitNumber: exitInfo, destination: roadName || null };
  }
  
  // Extract from instruction text
  const exitMatch = instruction.match(/exit\s*(?:onto\s*)?(\d+[A-Za-z]?)/i);
  const roadMatch = instruction.match(/(?:onto|toward|via)\s+([A-Z][A-Za-z0-9\-\s\/]+)/i);
  
  return {
    exitNumber: exitMatch ? exitMatch[1] : null,
    destination: roadMatch ? roadMatch[1].trim() : roadName || null,
  };
}

const LaneGuidancePanel: React.FC<LaneGuidanceProps> = ({
  instruction,
  distanceToManeuver,
  instructions,
  currentInstructionIndex,
  visible,
}) => {
  // Analyze the current instruction
  const guidance = useMemo(() => {
    if (!instruction) return null;
    
    const modifier = (instruction as any)?.modifier;
    const maneuverType = getManeuverType(instruction.instruction || '', modifier);
    
    // Only show lane guidance within 0.5 mile (800m) for non-straight maneuvers
    // Show up to 1 mile (1609m) for exits
    const isExit = maneuverType.includes('exit');
    const threshold = isExit ? 1609 : 800;
    
    if (maneuverType === 'straight' || distanceToManeuver > threshold) return null;
    
    const laneConfig = getLaneConfig(maneuverType);
    const { exitNumber, destination } = extractExitInfo(
      instruction.instruction || '', 
      instruction.exitInfo,
      instruction.roadName
    );
    
    return {
      laneConfig,
      maneuverType,
      exitNumber,
      destination,
      color: getManeuverColor(maneuverType),
    };
  }, [instruction, distanceToManeuver]);

  // Find next instruction for "Then" preview
  const nextInstruction = useMemo(() => {
    if (!instructions || currentInstructionIndex === undefined) return null;
    const nextIdx = currentInstructionIndex + 1;
    if (nextIdx >= instructions.length) return null;
    return instructions[nextIdx];
  }, [instructions, currentInstructionIndex]);

  if (!visible || !guidance) return null;

  const { laneConfig, maneuverType, exitNumber, destination, color } = guidance;

  return (
    <div className="absolute top-4 left-4 z-40 safe-top animate-in slide-in-from-left-4 duration-300">
      <div className={`${color} rounded-2xl shadow-2xl overflow-hidden min-w-[200px] max-w-[280px]`}>
        {/* Header with distance and maneuver */}
        <div className="p-3 pb-2">
          <div className="flex items-center gap-3">
            {/* Maneuver icon */}
            <div className="bg-white/20 rounded-lg p-2">
              {getManeuverHeaderIcon(maneuverType)}
            </div>
            
            {/* Distance and exit badge */}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-white">
                  {HereService.formatDistance(distanceToManeuver)}
                </span>
                {exitNumber && (
                  <div className="bg-white text-emerald-700 px-2 py-0.5 rounded font-bold text-xs flex items-center gap-1">
                    <ArrowUpRight className="w-3 h-3" />
                    {exitNumber}
                  </div>
                )}
              </div>
              {/* Destination */}
              {destination && (
                <p className="text-white/90 text-sm font-medium truncate mt-0.5">
                  {destination}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Lane visualization */}
        <div className="relative px-3 py-4 bg-zinc-800">
          <div className="flex justify-center gap-1.5">
            {laneConfig.laneArrows.map((arrowType, idx) => {
              const isActive = laneConfig.activeLanes.includes(idx);
              
              return (
                <div
                  key={idx}
                  className={`
                    relative flex items-center justify-center
                    w-12 h-16 rounded-t-lg border-2 transition-all duration-300
                    ${isActive 
                      ? 'bg-blue-500 border-blue-400 scale-105' 
                      : 'bg-zinc-700 border-zinc-600'
                    }
                  `}
                >
                  {/* Lane arrow */}
                  <div className={isActive ? 'animate-pulse' : ''}>
                    {getLaneArrowIcon(arrowType, isActive)}
                  </div>
                  
                  {/* Active lane indicator dot */}
                  {isActive && (
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                      <div className="w-2 h-2 rounded-full bg-blue-400 shadow-lg shadow-blue-400/50" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          {/* Lane labels */}
          <div className="flex justify-center gap-1.5 mt-4">
            {laneConfig.laneArrows.map((_, idx) => {
              const isActive = laneConfig.activeLanes.includes(idx);
              return (
                <div
                  key={idx}
                  className={`w-12 text-center text-xs font-medium ${
                    isActive ? 'text-blue-400' : 'text-zinc-500'
                  }`}
                >
                  {isActive ? 'USE' : ''}
                </div>
              );
            })}
          </div>
        </div>

        {/* Next maneuver preview */}
        {nextInstruction && (
          <div className="bg-zinc-900 p-2.5 flex items-center gap-2">
            <span className="text-zinc-500 text-xs font-medium">Then</span>
            <ManeuverIcon 
              maneuver={
                nextInstruction.instruction?.toLowerCase().includes('left') ? 'left' : 
                nextInstruction.instruction?.toLowerCase().includes('right') ? 'right' : 'straight'
              } 
              className="w-4 h-4 text-zinc-300" 
            />
            <span className="text-zinc-300 text-sm font-medium">
              {HereService.formatDistance(nextInstruction.length || 0)}
            </span>
            <span className="text-zinc-500 text-xs truncate flex-1">
              {nextInstruction.roadName || ''}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default LaneGuidancePanel;
