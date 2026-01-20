import { useState, useEffect } from 'react';

export type RouteStyleType = 'default' | 'high-contrast' | 'night';

export interface RouteStyleConfig {
  outline: string;
  main: string;
  highlight: string;
  highlightOpacity: number;
  label: string;
  icon: string;
}

export const ROUTE_STYLES: Record<RouteStyleType, RouteStyleConfig> = {
  'default': {
    outline: '#1e3a5f',      // Dark navy outline
    main: '#00d4ff',         // Bright cyan
    highlight: '#ffffff',    // White highlight
    highlightOpacity: 0.6,
    label: 'Padrão',
    icon: '🛣️',
  },
  'high-contrast': {
    outline: '#000000',      // Pure black outline
    main: '#ff6b00',         // Bright orange - maximum visibility
    highlight: '#ffff00',    // Yellow highlight
    highlightOpacity: 0.8,
    label: 'Alto Contraste',
    icon: '🔶',
  },
  'night': {
    outline: '#0d1b2a',      // Very dark blue outline
    main: '#4cc9f0',         // Soft cyan
    highlight: '#7209b7',    // Purple accent
    highlightOpacity: 0.5,
    label: 'Noturno',
    icon: '🌙',
  },
};

const STORAGE_KEY = 'trucker-route-style';

export function useRouteStyle() {
  const [style, setStyle] = useState<RouteStyleType>(() => {
    if (typeof window === 'undefined') return 'default';
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored in ROUTE_STYLES) {
      return stored as RouteStyleType;
    }
    return 'default';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, style);
  }, [style]);

  const cycleStyle = () => {
    const styles: RouteStyleType[] = ['default', 'high-contrast', 'night'];
    const currentIndex = styles.indexOf(style);
    const nextIndex = (currentIndex + 1) % styles.length;
    setStyle(styles[nextIndex]);
  };

  return {
    style,
    setStyle,
    cycleStyle,
    config: ROUTE_STYLES[style],
    allStyles: ROUTE_STYLES,
  };
}
