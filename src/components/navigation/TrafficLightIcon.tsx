import React from 'react';

interface TrafficLightIconProps {
  className?: string;
  size?: number;
  color?: string;
}

const TrafficLightIcon: React.FC<TrafficLightIconProps> = ({ 
  className = "", 
  size = 24, 
  color = "currentColor" 
}) => {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke={color} 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      className={className}
    >
      {/* Main body */}
      <rect width="8" height="16" x="8" y="5" rx="2" />
      {/* Red light */}
      <circle cx="12" cy="8" r="1.5" fill="#ef4444" stroke="#ef4444" />
      {/* Yellow light */}
      <circle cx="12" cy="12" r="1.5" fill="#eab308" stroke="#eab308" />
      {/* Green light */}
      <circle cx="12" cy="16" r="1.5" fill="#22c55e" stroke="#22c55e" />
      {/* Side arms */}
      <path d="M4 10h4" />
      <path d="M16 10h4" />
      {/* Pole */}
      <path d="M12 21v-2" />
      <path d="M12 5V3" />
    </svg>
  );
};

export default TrafficLightIcon;
