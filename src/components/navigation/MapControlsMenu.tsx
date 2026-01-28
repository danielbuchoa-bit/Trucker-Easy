import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Layers, Bug, Utensils, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import RouteStyleSelector from './RouteStyleSelector';
import { RouteStyleType } from '@/hooks/useRouteStyle';

interface MapControlsMenuProps {
  // Map style cycling
  currentMapStyle: 'satellite' | 'streets' | 'navigation';
  onCycleMapStyle: () => void;
  
  // Route style selector
  currentRouteStyle: RouteStyleType;
  onRouteStyleChange: (style: RouteStyleType) => void;
  
  // Debug toggle
  showDebug: boolean;
  onToggleDebug: () => void;
  
  // Food suggestion (optional)
  showFoodButton?: boolean;
  onFoodClick?: () => void;
  
  // Settings
  onSettingsClick?: () => void;
}

const MapControlsMenu = ({
  currentMapStyle,
  onCycleMapStyle,
  currentRouteStyle,
  onRouteStyleChange,
  showDebug,
  onToggleDebug,
  showFoodButton = false,
  onFoodClick,
  onSettingsClick,
}: MapControlsMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);
  
  // Auto-close after selecting an option (with slight delay for visual feedback)
  const handleAction = (action: () => void) => {
    action();
    // Keep open for route style selector which has its own popover
  };

  return (
    <div 
      ref={menuRef}
      className="absolute top-24 right-4 z-30 flex flex-col items-end gap-2"
    >
      {/* Expandable buttons - shown when open */}
      <div 
        className={cn(
          "flex flex-col gap-2 transition-all duration-300 ease-out origin-top",
          isOpen ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 -translate-y-2 pointer-events-none h-0 overflow-hidden"
        )}
      >
        {/* Map style toggle */}
        <Button
          variant="secondary"
          size="icon"
          className="rounded-full shadow-lg w-12 h-12 bg-background/90 backdrop-blur-sm"
          onClick={() => handleAction(onCycleMapStyle)}
        >
          <Layers className="w-5 h-5" />
        </Button>
        
        {/* Route style selector */}
        <RouteStyleSelector
          currentStyle={currentRouteStyle}
          onStyleChange={onRouteStyleChange}
          className="rounded-full w-12 h-12 bg-background/90 backdrop-blur-sm"
        />
        
        {/* Food suggestions button - only show when at POI */}
        {showFoodButton && onFoodClick && (
          <Button
            variant="default"
            size="icon"
            className="rounded-full shadow-lg w-12 h-12 bg-green-600 hover:bg-green-700"
            onClick={() => {
              handleAction(onFoodClick);
              setIsOpen(false);
            }}
          >
            <Utensils className="w-5 h-5" />
          </Button>
        )}
        
        {/* Settings button */}
        {onSettingsClick && (
          <Button
            variant="secondary"
            size="icon"
            className="rounded-full shadow-lg w-12 h-12 bg-background/90 backdrop-blur-sm"
            onClick={() => {
              handleAction(onSettingsClick);
              setIsOpen(false);
            }}
          >
            <Settings className="w-5 h-5" />
          </Button>
        )}
        
        {/* Debug toggle */}
        <Button
          variant={showDebug ? "default" : "secondary"}
          size="icon"
          className={cn(
            "rounded-full shadow-lg w-12 h-12",
            !showDebug && "bg-background/90 backdrop-blur-sm"
          )}
          onClick={() => handleAction(onToggleDebug)}
        >
          <Bug className="w-5 h-5" />
        </Button>
      </div>
      
      {/* Main toggle button */}
      <Button
        variant="secondary"
        size="icon"
        className="rounded-full shadow-lg w-14 h-14 bg-background/95 backdrop-blur-sm"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Plus 
          className={cn(
            "w-6 h-6 transition-transform duration-300 ease-out",
            isOpen && "rotate-[135deg]"
          )} 
        />
      </Button>
    </div>
  );
};

export default MapControlsMenu;
