/**
 * Truck stop brand detection and display utilities
 * Maps known truck stop chains to their brand keys and colors
 */

export interface TruckBrand {
  key: string;
  name: string;
  color: string; // Tailwind class for background
  textColor: string; // Tailwind class for text
  initial: string; // Single letter for fallback
}

// Known truck stop brands
export const TRUCK_BRANDS: Record<string, TruckBrand> = {
  loves: {
    key: 'loves',
    name: "Love's",
    color: 'bg-red-600',
    textColor: 'text-white',
    initial: 'L',
  },
  pilot: {
    key: 'pilot',
    name: 'Pilot',
    color: 'bg-red-700',
    textColor: 'text-white',
    initial: 'P',
  },
  flyingj: {
    key: 'flyingj',
    name: 'Flying J',
    color: 'bg-green-700',
    textColor: 'text-white',
    initial: 'J',
  },
  ta: {
    key: 'ta',
    name: 'TA',
    color: 'bg-blue-800',
    textColor: 'text-white',
    initial: 'T',
  },
  petro: {
    key: 'petro',
    name: 'Petro',
    color: 'bg-blue-600',
    textColor: 'text-white',
    initial: 'P',
  },
  sapp: {
    key: 'sapp',
    name: 'Sapp Bros',
    color: 'bg-orange-600',
    textColor: 'text-white',
    initial: 'S',
  },
  ambest: {
    key: 'ambest',
    name: 'Ambest',
    color: 'bg-blue-500',
    textColor: 'text-white',
    initial: 'A',
  },
  kwiktrip: {
    key: 'kwiktrip',
    name: 'Kwik Trip',
    color: 'bg-red-500',
    textColor: 'text-white',
    initial: 'K',
  },
  caseys: {
    key: 'caseys',
    name: "Casey's",
    color: 'bg-red-600',
    textColor: 'text-white',
    initial: 'C',
  },
  bucees: {
    key: 'bucees',
    name: "Buc-ee's",
    color: 'bg-yellow-500',
    textColor: 'text-black',
    initial: 'B',
  },
  sheetz: {
    key: 'sheetz',
    name: 'Sheetz',
    color: 'bg-red-600',
    textColor: 'text-white',
    initial: 'S',
  },
  wawa: {
    key: 'wawa',
    name: 'Wawa',
    color: 'bg-red-700',
    textColor: 'text-white',
    initial: 'W',
  },
  quiktrip: {
    key: 'quiktrip',
    name: 'QuikTrip',
    color: 'bg-red-600',
    textColor: 'text-white',
    initial: 'Q',
  },
  speedway: {
    key: 'speedway',
    name: 'Speedway',
    color: 'bg-yellow-500',
    textColor: 'text-black',
    initial: 'S',
  },
  shell: {
    key: 'shell',
    name: 'Shell',
    color: 'bg-yellow-400',
    textColor: 'text-black',
    initial: 'S',
  },
  chevron: {
    key: 'chevron',
    name: 'Chevron',
    color: 'bg-blue-600',
    textColor: 'text-white',
    initial: 'C',
  },
  exxon: {
    key: 'exxon',
    name: 'Exxon',
    color: 'bg-red-600',
    textColor: 'text-white',
    initial: 'E',
  },
  bp: {
    key: 'bp',
    name: 'BP',
    color: 'bg-green-600',
    textColor: 'text-white',
    initial: 'B',
  },
  rest_area: {
    key: 'rest_area',
    name: 'Rest Area',
    color: 'bg-blue-500',
    textColor: 'text-white',
    initial: 'R',
  },
};

// Brand detection patterns (order matters - more specific first)
const BRAND_PATTERNS: Array<{ pattern: RegExp; brandKey: string }> = [
  { pattern: /flying\s*j/i, brandKey: 'flyingj' },
  { pattern: /love'?s/i, brandKey: 'loves' },
  { pattern: /pilot/i, brandKey: 'pilot' },
  { pattern: /petro[\s-]?stopping/i, brandKey: 'petro' },
  { pattern: /\bta\b/i, brandKey: 'ta' },
  { pattern: /travel\s*centers?\s*of\s*america/i, brandKey: 'ta' },
  { pattern: /sapp\s*bros/i, brandKey: 'sapp' },
  { pattern: /ambest/i, brandKey: 'ambest' },
  { pattern: /kwik\s*trip/i, brandKey: 'kwiktrip' },
  { pattern: /casey'?s/i, brandKey: 'caseys' },
  { pattern: /buc-?ee'?s/i, brandKey: 'bucees' },
  { pattern: /sheetz/i, brandKey: 'sheetz' },
  { pattern: /wawa/i, brandKey: 'wawa' },
  { pattern: /quik\s*trip/i, brandKey: 'quiktrip' },
  { pattern: /speedway/i, brandKey: 'speedway' },
  { pattern: /shell/i, brandKey: 'shell' },
  { pattern: /chevron/i, brandKey: 'chevron' },
  { pattern: /exxon/i, brandKey: 'exxon' },
  { pattern: /\bbp\b/i, brandKey: 'bp' },
  { pattern: /rest\s*(area|stop)/i, brandKey: 'rest_area' },
];

// Cache for brand detection results
const brandCache = new Map<string, TruckBrand | null>();

/**
 * Detect truck stop brand from name/chain
 * Returns brand info or null if unknown
 */
export function detectBrand(name: string | null | undefined, chainName?: string | null): TruckBrand | null {
  if (!name && !chainName) return null;
  
  const searchText = `${name || ''} ${chainName || ''}`.trim().toLowerCase();
  if (!searchText) return null;
  
  // Check cache first
  if (brandCache.has(searchText)) {
    return brandCache.get(searchText) || null;
  }
  
  // Try to match against patterns
  for (const { pattern, brandKey } of BRAND_PATTERNS) {
    if (pattern.test(searchText)) {
      const brand = TRUCK_BRANDS[brandKey];
      brandCache.set(searchText, brand);
      return brand;
    }
  }
  
  // No match found
  brandCache.set(searchText, null);
  return null;
}

/**
 * Get display initial for a place name
 * Used as fallback when no brand is detected
 */
export function getInitial(name: string | null | undefined): string {
  if (!name) return '?';
  
  // Get first letter of meaningful word (skip "The", numbers, etc.)
  const words = name.trim().split(/\s+/);
  const skipWords = ['the', 'a', 'an'];
  
  for (const word of words) {
    const lower = word.toLowerCase();
    if (!skipWords.includes(lower) && /^[a-zA-Z]/.test(word)) {
      return word[0].toUpperCase();
    }
  }
  
  // Fallback to first char
  const first = name.trim()[0];
  return first ? first.toUpperCase() : '?';
}

/**
 * Get a color based on the initial letter
 * Provides visual variety for unknown brands
 */
export function getColorForInitial(initial: string): { bg: string; text: string } {
  const colors = [
    { bg: 'bg-emerald-600', text: 'text-white' },
    { bg: 'bg-cyan-600', text: 'text-white' },
    { bg: 'bg-violet-600', text: 'text-white' },
    { bg: 'bg-pink-600', text: 'text-white' },
    { bg: 'bg-amber-600', text: 'text-white' },
    { bg: 'bg-teal-600', text: 'text-white' },
    { bg: 'bg-indigo-600', text: 'text-white' },
    { bg: 'bg-rose-600', text: 'text-white' },
  ];
  
  // Use char code to pick consistent color for each letter
  const code = initial.charCodeAt(0) || 0;
  return colors[code % colors.length];
}
