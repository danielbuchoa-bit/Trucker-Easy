import React, { useEffect, useState } from 'react';
import { NavigationEngine, type ActiveEngine, subscribeToDiagnostics } from '@/services/NavigationEngine';
import { Badge } from '@/components/ui/badge';
import { Truck, Map } from 'lucide-react';

interface EngineIndicatorProps {
  className?: string;
}

const EngineIndicator: React.FC<EngineIndicatorProps> = ({ className = '' }) => {
  const [activeEngine, setActiveEngine] = useState<ActiveEngine>(NavigationEngine.getActiveEngine());
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);

  useEffect(() => {
    // Get initial state
    const state = NavigationEngine.getState();
    setActiveEngine(state.activeEngine);
    setFallbackReason(state.fallbackReason);

    // Subscribe to diagnostics for real-time updates
    const unsubscribe = subscribeToDiagnostics((data) => {
      if (data.engine) {
        setActiveEngine(data.engine);
      }
      if (data.endpoint === 'fallback' && data.message) {
        setFallbackReason(data.message);
      }
    });

    // Poll state periodically (for cooldown expiration)
    const interval = setInterval(() => {
      const state = NavigationEngine.getState();
      setActiveEngine(state.activeEngine);
      setFallbackReason(state.fallbackReason);
    }, 10000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const isNextBillion = activeEngine === 'nextbillion';

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <Badge 
        variant="outline" 
        className={`
          flex items-center gap-1.5 px-2 py-1 text-xs font-medium
          backdrop-blur-sm border
          ${isNextBillion 
            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-100' 
            : 'bg-amber-500/20 border-amber-500/50 text-amber-100'
          }
        `}
        title={fallbackReason || (isNextBillion ? 'NextBillion truck routing active' : 'HERE fallback active')}
      >
        {isNextBillion ? (
          <>
            <Truck className="w-3.5 h-3.5" />
            <span>NB</span>
          </>
        ) : (
          <>
            <Map className="w-3.5 h-3.5" />
            <span>HERE</span>
          </>
        )}
      </Badge>
    </div>
  );
};

export default EngineIndicator;
