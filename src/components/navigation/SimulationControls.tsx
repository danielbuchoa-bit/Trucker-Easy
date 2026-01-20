import React from 'react';
import { Play, Pause, Square, FastForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface SimulationControlsProps {
  isSimulating: boolean;
  isPaused: boolean;
  progress: number;
  speed: number;
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  onSpeedChange: (speed: number) => void;
}

const SimulationControls = ({
  isSimulating,
  isPaused,
  progress,
  speed,
  onStart,
  onStop,
  onPause,
  onResume,
  onSpeedChange,
}: SimulationControlsProps) => {
  if (!isSimulating) {
    // Simulation is DISABLED by default - using real GPS only
    // This button is hidden in production, only shown for development/testing
    if (process.env.NODE_ENV === 'development') {
      return (
        <div className="absolute bottom-4 left-4 z-30">
          <Button
            variant="secondary"
            onClick={onStart}
            className="shadow-lg opacity-50"
          >
            <Play className="w-4 h-4 mr-2" />
            [DEV] Test Simulation
          </Button>
        </div>
      );
    }
    // In production, don't show simulation controls - use real GPS only
    return null;
  }

  // Show simulation controls when active
  return (
    <div className="absolute bottom-4 inset-x-4 z-30 bg-card/95 backdrop-blur-sm border border-border rounded-xl p-4 space-y-3 shadow-lg">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          🚛 Simulation Mode
        </span>
        <div className="flex items-center gap-2">
          <FastForward className="w-4 h-4 text-muted-foreground" />
          <Select
            value={speed.toString()}
            onValueChange={(value) => onSpeedChange(parseFloat(value))}
          >
            <SelectTrigger className="w-20 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1x</SelectItem>
              <SelectItem value="2">2x</SelectItem>
              <SelectItem value="5">5x</SelectItem>
              <SelectItem value="10">10x</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Progress value={progress} className="h-2" />

      <div className="flex items-center justify-center gap-3">
        {isPaused ? (
          <Button variant="default" size="sm" onClick={onResume}>
            <Play className="w-4 h-4 mr-1" />
            Resume
          </Button>
        ) : (
          <Button variant="secondary" size="sm" onClick={onPause}>
            <Pause className="w-4 h-4 mr-1" />
            Pause
          </Button>
        )}
        <Button variant="destructive" size="sm" onClick={onStop}>
          <Square className="w-4 h-4 mr-1" />
          Stop
        </Button>
      </div>
    </div>
  );
};

export default SimulationControls;
