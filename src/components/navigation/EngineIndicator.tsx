import React, { useEffect, useState } from 'react';
import { NavigationEngine, type ActiveEngine, subscribeToDiagnostics } from '@/services/NavigationEngine';
import { Badge } from '@/components/ui/badge';
import { Truck } from 'lucide-react';

interface EngineIndicatorProps {
  className?: string;
}

const EngineIndicator: React.FC<EngineIndicatorProps> = ({ className = '' }) => {
  const [activeEngine, setActiveEngine] = useState<ActiveEngine>(NavigationEngine.getActiveEngine());
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    // Get initial state
    const state = NavigationEngine.getState();
    setActiveEngine(state.activeEngine);
    setLastError(state.lastError);

    // Subscribe to diagnostics for real-time updates
    const unsubscribe = subscribeToDiagnostics((data) => {
      if (data.engine) {
        setActiveEngine(data.engine);
      }
      if (data.status === 'error' && data.message) {
        setLastError(data.message);
      }
    });

    // Poll state periodically
    const interval = setInterval(() => {
      const state = NavigationEngine.getState();
      setActiveEngine(state.activeEngine);
      setLastError(state.lastError);
    }, 10000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <Badge 
        variant="outline" 
        className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium backdrop-blur-sm border bg-emerald-500/20 border-emerald-500/50 text-emerald-100"
        title={lastError || 'NextBillion truck routing active'}
      >
        <Truck className="w-3.5 h-3.5" />
        <span>NB</span>
      </Badge>
    </div>
  );
};

export default EngineIndicator;
