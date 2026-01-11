/**
 * SVG Logos for major truck stop brands
 * Inline SVGs for performance and reliability
 */

import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
}

// Love's Travel Stops - Red heart-shaped logo
export const LovesLogo: React.FC<LogoProps> = ({ className = '', size = 32 }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} className={className}>
    <rect width="100" height="100" rx="12" fill="#CC0000"/>
    <path 
      d="M50 80 L20 50 C10 40 10 25 25 20 C35 15 45 25 50 35 C55 25 65 15 75 20 C90 25 90 40 80 50 Z" 
      fill="white"
    />
    <text x="50" y="72" textAnchor="middle" fill="#CC0000" fontSize="18" fontWeight="bold" fontFamily="Arial">Love's</text>
  </svg>
);

// Pilot Travel Centers - Red P with wings
export const PilotLogo: React.FC<LogoProps> = ({ className = '', size = 32 }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} className={className}>
    <rect width="100" height="100" rx="12" fill="#B22222"/>
    <text x="50" y="65" textAnchor="middle" fill="white" fontSize="48" fontWeight="bold" fontFamily="Arial Black">P</text>
    <path d="M20 45 L35 50 L20 55 Z" fill="#FFD700"/>
    <path d="M80 45 L65 50 L80 55 Z" fill="#FFD700"/>
  </svg>
);

// Flying J - Green with J
export const FlyingJLogo: React.FC<LogoProps> = ({ className = '', size = 32 }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} className={className}>
    <rect width="100" height="100" rx="12" fill="#1B5E20"/>
    <text x="50" y="68" textAnchor="middle" fill="white" fontSize="52" fontWeight="bold" fontFamily="Arial Black" fontStyle="italic">J</text>
    <path d="M25 25 Q50 15 75 25" stroke="#FFD700" strokeWidth="4" fill="none"/>
  </svg>
);

// TA (TravelCenters of America) - Blue TA
export const TALogo: React.FC<LogoProps> = ({ className = '', size = 32 }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} className={className}>
    <rect width="100" height="100" rx="12" fill="#0D47A1"/>
    <text x="50" y="68" textAnchor="middle" fill="white" fontSize="42" fontWeight="bold" fontFamily="Arial Black">TA</text>
  </svg>
);

// Petro Stopping Centers - Blue P with star
export const PetroLogo: React.FC<LogoProps> = ({ className = '', size = 32 }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} className={className}>
    <rect width="100" height="100" rx="12" fill="#1565C0"/>
    <text x="50" y="65" textAnchor="middle" fill="white" fontSize="48" fontWeight="bold" fontFamily="Arial Black">P</text>
    <polygon points="50,10 54,22 67,22 57,30 61,42 50,34 39,42 43,30 33,22 46,22" fill="#FFD700"/>
  </svg>
);

// Sapp Bros - Orange S
export const SappBrosLogo: React.FC<LogoProps> = ({ className = '', size = 32 }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} className={className}>
    <rect width="100" height="100" rx="12" fill="#E65100"/>
    <text x="50" y="68" textAnchor="middle" fill="white" fontSize="52" fontWeight="bold" fontFamily="Arial Black">S</text>
  </svg>
);

// Buc-ee's - Yellow with beaver face
export const BuceesLogo: React.FC<LogoProps> = ({ className = '', size = 32 }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} className={className}>
    <rect width="100" height="100" rx="12" fill="#F9A825"/>
    <circle cx="50" cy="50" r="35" fill="#8B4513"/>
    <circle cx="38" cy="42" r="6" fill="white"/>
    <circle cx="62" cy="42" r="6" fill="white"/>
    <circle cx="38" cy="42" r="3" fill="black"/>
    <circle cx="62" cy="42" r="3" fill="black"/>
    <ellipse cx="50" cy="58" rx="12" ry="8" fill="#D4A574"/>
    <rect x="45" y="64" width="4" height="8" fill="white"/>
    <rect x="51" y="64" width="4" height="8" fill="white"/>
  </svg>
);

// Kwik Trip - Red KT
export const KwikTripLogo: React.FC<LogoProps> = ({ className = '', size = 32 }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} className={className}>
    <rect width="100" height="100" rx="12" fill="#D32F2F"/>
    <text x="50" y="68" textAnchor="middle" fill="white" fontSize="38" fontWeight="bold" fontFamily="Arial Black">KT</text>
  </svg>
);

// Casey's - Red C
export const CaseysLogo: React.FC<LogoProps> = ({ className = '', size = 32 }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} className={className}>
    <rect width="100" height="100" rx="12" fill="#B71C1C"/>
    <text x="50" y="68" textAnchor="middle" fill="white" fontSize="52" fontWeight="bold" fontFamily="Arial Black">C</text>
  </svg>
);

// Sheetz - Red S with wings
export const SheetzLogo: React.FC<LogoProps> = ({ className = '', size = 32 }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} className={className}>
    <rect width="100" height="100" rx="12" fill="#C62828"/>
    <text x="50" y="68" textAnchor="middle" fill="white" fontSize="52" fontWeight="bold" fontFamily="Arial Black">S</text>
    <path d="M15 50 L30 45 L15 40" stroke="white" strokeWidth="3" fill="none"/>
    <path d="M85 50 L70 45 L85 40" stroke="white" strokeWidth="3" fill="none"/>
  </svg>
);

// Wawa - Red W with goose
export const WawaLogo: React.FC<LogoProps> = ({ className = '', size = 32 }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} className={className}>
    <rect width="100" height="100" rx="12" fill="#8B0000"/>
    <text x="50" y="68" textAnchor="middle" fill="white" fontSize="48" fontWeight="bold" fontFamily="Arial Black">W</text>
  </svg>
);

// QuikTrip - Red QT
export const QuikTripLogo: React.FC<LogoProps> = ({ className = '', size = 32 }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} className={className}>
    <rect width="100" height="100" rx="12" fill="#D32F2F"/>
    <text x="50" y="68" textAnchor="middle" fill="white" fontSize="38" fontWeight="bold" fontFamily="Arial Black">QT</text>
  </svg>
);

// Speedway - Yellow with checkered
export const SpeedwayLogo: React.FC<LogoProps> = ({ className = '', size = 32 }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} className={className}>
    <rect width="100" height="100" rx="12" fill="#FBC02D"/>
    <text x="50" y="68" textAnchor="middle" fill="#333" fontSize="48" fontWeight="bold" fontFamily="Arial Black">S</text>
    <rect x="10" y="10" width="10" height="10" fill="#333"/>
    <rect x="20" y="20" width="10" height="10" fill="#333"/>
    <rect x="80" y="10" width="10" height="10" fill="#333"/>
    <rect x="70" y="20" width="10" height="10" fill="#333"/>
  </svg>
);

// Ambest - Blue A
export const AmbestLogo: React.FC<LogoProps> = ({ className = '', size = 32 }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} className={className}>
    <rect width="100" height="100" rx="12" fill="#2196F3"/>
    <text x="50" y="68" textAnchor="middle" fill="white" fontSize="52" fontWeight="bold" fontFamily="Arial Black">A</text>
  </svg>
);

// Generic truck icon for unknown brands
export const GenericTruckStopLogo: React.FC<LogoProps & { initial: string; bgColor: string }> = ({ 
  className = '', 
  size = 32, 
  initial = '?',
  bgColor = '#666'
}) => (
  <svg viewBox="0 0 100 100" width={size} height={size} className={className}>
    <rect width="100" height="100" rx="12" fill={bgColor}/>
    <text x="50" y="68" textAnchor="middle" fill="white" fontSize="48" fontWeight="bold" fontFamily="Arial Black">{initial}</text>
  </svg>
);

// Map brand keys to logo components
export const BRAND_LOGOS: Record<string, React.FC<LogoProps>> = {
  loves: LovesLogo,
  pilot: PilotLogo,
  flyingj: FlyingJLogo,
  ta: TALogo,
  petro: PetroLogo,
  sapp: SappBrosLogo,
  bucees: BuceesLogo,
  kwiktrip: KwikTripLogo,
  caseys: CaseysLogo,
  sheetz: SheetzLogo,
  wawa: WawaLogo,
  quiktrip: QuikTripLogo,
  speedway: SpeedwayLogo,
  ambest: AmbestLogo,
};

/**
 * Get the logo component for a brand key
 */
export function getBrandLogo(brandKey: string | undefined): React.FC<LogoProps> | null {
  if (!brandKey) return null;
  return BRAND_LOGOS[brandKey] || null;
}
