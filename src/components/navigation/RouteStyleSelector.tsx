import React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Palette, Check } from 'lucide-react';
import { RouteStyleType, ROUTE_STYLES, RouteStyleConfig } from '@/hooks/useRouteStyle';

interface RouteStyleSelectorProps {
  currentStyle: RouteStyleType;
  onStyleChange: (style: RouteStyleType) => void;
  className?: string;
}

const RouteStyleSelector: React.FC<RouteStyleSelectorProps> = ({
  currentStyle,
  onStyleChange,
  className = '',
}) => {
  const config = ROUTE_STYLES[currentStyle];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          size="icon"
          className={`backdrop-blur-sm bg-background/80 shadow-lg ${className}`}
          title={`Estilo de rota: ${config.label}`}
        >
          <Palette className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {(Object.entries(ROUTE_STYLES) as [RouteStyleType, RouteStyleConfig][]).map(
          ([key, styleConfig]) => (
            <DropdownMenuItem
              key={key}
              onClick={() => onStyleChange(key)}
              className="flex items-center gap-3 cursor-pointer"
            >
              {/* Color preview */}
              <div className="flex items-center gap-1">
                <div
                  className="w-3 h-3 rounded-full border border-border"
                  style={{ backgroundColor: styleConfig.outline }}
                />
                <div
                  className="w-4 h-4 rounded-full border border-border"
                  style={{ backgroundColor: styleConfig.main }}
                />
                <div
                  className="w-2 h-2 rounded-full border border-border"
                  style={{ backgroundColor: styleConfig.highlight }}
                />
              </div>
              
              <span className="flex-1">{styleConfig.label}</span>
              
              {currentStyle === key && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </DropdownMenuItem>
          )
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default RouteStyleSelector;
