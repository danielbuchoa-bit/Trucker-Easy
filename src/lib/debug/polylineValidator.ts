/**
 * Polyline Validator
 * 
 * Validates decoded polylines for coordinate integrity and lat/lng order
 */

import { DiagnosticErrorCodes } from './debugNavConfig';
import type { PolylineValidation, PolylineError, CoordinateCheck } from './diagnosticTypes';
import { decodePolyline, type LngLat } from '@/lib/polylineDecoder';
import { decodeHereFlexiblePolyline } from '@/lib/hereFlexiblePolyline';
import { debugLog, debugError, debugWarn } from './debugNavConfig';

/**
 * Check if a single coordinate pair is valid
 * Returns issues found
 */
export function validateCoordinate(lng: number, lat: number): CoordinateCheck {
  const issues: (typeof DiagnosticErrorCodes)[keyof typeof DiagnosticErrorCodes][] = [];
  let possibleSwap = false;

  // Check if latitude is valid (-90 to 90)
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    issues.push(DiagnosticErrorCodes.COORD_INVALID_LAT);
  }

  // Check if longitude is valid (-180 to 180)
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    issues.push(DiagnosticErrorCodes.COORD_INVALID_LNG);
  }

  // Check for swapped coordinates
  // If lat looks like a longitude value (outside ±90) but would be valid as lng
  if (Math.abs(lat) > 90 && Math.abs(lat) <= 180) {
    // And lng looks like it could be a latitude (within ±90)
    if (Math.abs(lng) <= 90) {
      issues.push(DiagnosticErrorCodes.COORD_SWAPPED);
      possibleSwap = true;
    }
  }

  return {
    isValid: issues.length === 0,
    lat,
    lng,
    issues,
    possibleSwap,
  };
}

/**
 * Validate an array of coordinates (Mapbox format: [lng, lat])
 */
export function validateCoordinateArray(coords: LngLat[]): {
  valid: boolean;
  errors: PolylineError[];
  swapDetected: boolean;
} {
  const errors: PolylineError[] = [];
  let swapDetected = false;

  for (let i = 0; i < coords.length; i++) {
    const [lng, lat] = coords[i];
    const check = validateCoordinate(lng, lat);

    if (!check.isValid) {
      check.issues.forEach(issue => {
        errors.push({
          index: i,
          lat,
          lng,
          errorCode: issue,
          message: `Coordinate ${i}: ${issue}`,
        });
      });
    }

    if (check.possibleSwap) {
      swapDetected = true;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    swapDetected,
  };
}

/**
 * Calculate bounding box from coordinates
 */
export function calculateBoundingBox(coords: LngLat[]): {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
} | null {
  if (coords.length === 0) return null;

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (const [lng, lat] of coords) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }

  return { minLat, maxLat, minLng, maxLng };
}

/**
 * Detect polyline format from the encoded string
 */
export function detectPolylineFormat(encoded: string): 'flexible' | 'google' | 'unknown' {
  if (!encoded || encoded.length < 2) return 'unknown';
  
  // HERE Flexible Polyline typically starts with 'B' (version 1)
  if (encoded.charAt(0) === 'B') {
    return 'flexible';
  }
  
  // Google polyline uses different character set (no underscores/hyphens)
  if (!/[_-]/.test(encoded)) {
    return 'google';
  }
  
  return 'unknown';
}

/**
 * Full polyline validation with logging
 */
export function validatePolyline(encoded: string): PolylineValidation {
  const timestamp = Date.now();
  const format = detectPolylineFormat(encoded);
  const errors: PolylineError[] = [];
  
  debugLog('POLYLINE', `Validating polyline (format: ${format}, length: ${encoded?.length || 0})`);

  // Check if input exists
  if (!encoded || encoded.length === 0) {
    debugError('POLYLINE', 'Empty polyline string');
    return {
      timestamp,
      inputLength: 0,
      decodedPoints: 0,
      isValid: false,
      format,
      errors: [{
        index: -1,
        lat: 0,
        lng: 0,
        errorCode: DiagnosticErrorCodes.POLYLINE_EMPTY,
        message: 'Polyline string is empty',
      }],
      boundingBox: null,
    };
  }

  // Try to decode
  let coords: LngLat[] = [];
  
  try {
    if (format === 'flexible') {
      coords = decodeHereFlexiblePolyline(encoded);
      debugLog('POLYLINE', `Decoded as HERE Flexible: ${coords.length} points`);
    } else {
      coords = decodePolyline(encoded);
      debugLog('POLYLINE', `Decoded as auto-detect: ${coords.length} points`);
    }
  } catch (e) {
    debugError('POLYLINE', 'Decode failed', e);
    return {
      timestamp,
      inputLength: encoded.length,
      decodedPoints: 0,
      isValid: false,
      format,
      errors: [{
        index: -1,
        lat: 0,
        lng: 0,
        errorCode: DiagnosticErrorCodes.POLYLINE_DECODE_FAIL,
        message: `Decode error: ${e instanceof Error ? e.message : 'Unknown'}`,
      }],
      boundingBox: null,
    };
  }

  // Check minimum points
  if (coords.length < 2) {
    debugWarn('POLYLINE', `Too few points: ${coords.length}`);
    errors.push({
      index: -1,
      lat: 0,
      lng: 0,
      errorCode: DiagnosticErrorCodes.POLYLINE_TOO_FEW_POINTS,
      message: `Only ${coords.length} points decoded, minimum 2 required`,
    });
  }

  // Validate coordinates
  const coordValidation = validateCoordinateArray(coords);
  errors.push(...coordValidation.errors);

  if (coordValidation.swapDetected) {
    debugWarn('POLYLINE', 'Possible lat/lng swap detected!', {
      sampleCoord: coords[0],
    });
  }

  // Calculate bounding box
  const boundingBox = calculateBoundingBox(coords);
  
  if (boundingBox) {
    debugLog('POLYLINE', `BBox: lat[${boundingBox.minLat.toFixed(4)},${boundingBox.maxLat.toFixed(4)}] lng[${boundingBox.minLng.toFixed(4)},${boundingBox.maxLng.toFixed(4)}]`);
  }

  const isValid = errors.length === 0;
  
  if (isValid) {
    debugLog('POLYLINE', `✅ Polyline valid: ${coords.length} points`);
  } else {
    debugError('POLYLINE', `❌ Polyline has ${errors.length} errors`);
  }

  return {
    timestamp,
    inputLength: encoded.length,
    decodedPoints: coords.length,
    isValid,
    format,
    errors,
    boundingBox,
  };
}

/**
 * Compare two bounding boxes to detect significant deviation
 */
export function compareBoundingBoxes(
  expected: { minLat: number; maxLat: number; minLng: number; maxLng: number },
  actual: { minLat: number; maxLat: number; minLng: number; maxLng: number },
  toleranceDegrees = 0.5
): { matches: boolean; deviations: string[] } {
  const deviations: string[] = [];

  if (Math.abs(actual.minLat - expected.minLat) > toleranceDegrees) {
    deviations.push(`minLat off by ${(actual.minLat - expected.minLat).toFixed(4)}°`);
  }
  if (Math.abs(actual.maxLat - expected.maxLat) > toleranceDegrees) {
    deviations.push(`maxLat off by ${(actual.maxLat - expected.maxLat).toFixed(4)}°`);
  }
  if (Math.abs(actual.minLng - expected.minLng) > toleranceDegrees) {
    deviations.push(`minLng off by ${(actual.minLng - expected.minLng).toFixed(4)}°`);
  }
  if (Math.abs(actual.maxLng - expected.maxLng) > toleranceDegrees) {
    deviations.push(`maxLng off by ${(actual.maxLng - expected.maxLng).toFixed(4)}°`);
  }

  return {
    matches: deviations.length === 0,
    deviations,
  };
}
