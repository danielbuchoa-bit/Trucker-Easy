import React from 'react';

interface TruckCursorProps {
  size?: number;
  color?: string;
  strokeColor?: string;
}

/**
 * SVG truck/arrow cursor for navigation map
 * This is a simple directional indicator that always points "forward"
 * In course-up mode, this icon stays fixed pointing up while the map rotates
 */
const TruckCursor: React.FC<TruckCursorProps> = ({ 
  size = 48, 
  color = '#3b82f6',
  strokeColor = '#ffffff'
}) => {
  return (
    <div 
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {/* Glow effect */}
      <div 
        className="absolute inset-0 rounded-full animate-pulse"
        style={{
          background: `radial-gradient(circle, ${color}40 0%, transparent 70%)`,
        }}
      />
      
      {/* Main arrow/truck icon */}
      <svg 
        viewBox="0 0 24 24" 
        width={size * 0.75} 
        height={size * 0.75}
        className="relative z-10 drop-shadow-lg"
      >
        {/* Navigation arrow - pointing UP */}
        <path 
          d="M12 2L4 20l1.5 1L12 17l6.5 4L20 20z"
          fill={color}
          stroke={strokeColor}
          strokeWidth="1"
          strokeLinejoin="round"
        />
        
        {/* Inner highlight for depth */}
        <path 
          d="M12 6l-4 10 4-2 4 2z"
          fill={`${color}cc`}
          stroke="none"
        />
      </svg>
    </div>
  );
};

export default TruckCursor;

// Alternative: Truck silhouette cursor
export const TruckIconCursor: React.FC<TruckCursorProps> = ({ 
  size = 48, 
  color = '#3b82f6',
  strokeColor = '#ffffff'
}) => {
  return (
    <div 
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {/* Glow effect */}
      <div 
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle, ${color}30 0%, transparent 60%)`,
        }}
      />
      
      {/* Truck icon - simplified semi view from above, pointing UP */}
      <svg 
        viewBox="0 0 32 48" 
        width={size * 0.6} 
        height={size * 0.9}
        className="relative z-10 drop-shadow-lg"
      >
        {/* Truck cab */}
        <rect 
          x="6" y="2" width="20" height="14" 
          rx="4" ry="2"
          fill={color}
          stroke={strokeColor}
          strokeWidth="1.5"
        />
        
        {/* Windshield */}
        <rect 
          x="9" y="5" width="14" height="6" 
          rx="2"
          fill={`${color}88`}
          stroke={strokeColor}
          strokeWidth="0.5"
        />
        
        {/* Trailer */}
        <rect 
          x="4" y="18" width="24" height="28" 
          rx="2"
          fill={color}
          stroke={strokeColor}
          strokeWidth="1.5"
        />
        
        {/* Trailer lines for depth */}
        <line x1="8" y1="24" x2="24" y2="24" stroke={strokeColor} strokeWidth="0.5" opacity="0.5"/>
        <line x1="8" y1="32" x2="24" y2="32" stroke={strokeColor} strokeWidth="0.5" opacity="0.5"/>
        <line x1="8" y1="40" x2="24" y2="40" stroke={strokeColor} strokeWidth="0.5" opacity="0.5"/>
      </svg>
    </div>
  );
};

// For use in Mapbox marker creation
export function createTruckCursorElement(size: number = 48): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'truck-cursor-marker';
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.position = 'relative';
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  el.style.pointerEvents = 'none';
  
  el.innerHTML = `
    <div style="position: absolute; inset: 0; border-radius: 50%; background: radial-gradient(circle, rgba(59,130,246,0.3) 0%, transparent 70%); animation: truck-pulse 2s infinite;"></div>
    <svg viewBox="0 0 24 24" width="${size * 0.7}" height="${size * 0.7}" style="position: relative; z-index: 10; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));">
      <path d="M12 2L4 20l1.5 1L12 17l6.5 4L20 20z" fill="#3b82f6" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M12 6l-4 10 4-2 4 2z" fill="#60a5fa" stroke="none"/>
    </svg>
  `;
  
  // Add pulse animation style if not already present
  if (!document.getElementById('truck-cursor-styles')) {
    const style = document.createElement('style');
    style.id = 'truck-cursor-styles';
    style.textContent = `
      @keyframes truck-pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.6; transform: scale(1.15); }
      }
      .truck-cursor-marker {
        z-index: 1000 !important;
      }
    `;
    document.head.appendChild(style);
  }
  
  return el;
}
