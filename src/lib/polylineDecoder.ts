import { decodeHereFlexiblePolyline, type LngLat } from './hereFlexiblePolyline';

export type { LngLat };

/**
 * Decodes a Google Encoded Polyline string into an array of [lng, lat] coordinates.
 * This is the format used by NextBillion.ai, Google Maps, and many other routing APIs.
 * 
 * Based on: https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
export function decodeGooglePolyline(encoded: string): LngLat[] {
  if (!encoded) return [];

  const coordinates: LngLat[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  try {
    while (index < encoded.length) {
      // Decode latitude
      let shift = 0;
      let result = 0;
      let byte: number;

      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20 && index < encoded.length);

      const deltaLat = (result & 1) ? ~(result >> 1) : (result >> 1);
      lat += deltaLat;

      // Decode longitude
      shift = 0;
      result = 0;

      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20 && index < encoded.length);

      const deltaLng = (result & 1) ? ~(result >> 1) : (result >> 1);
      lng += deltaLng;

      // Convert to actual lat/lng values (divide by 1e5 for Google format)
      const latitude = lat / 1e5;
      const longitude = lng / 1e5;

      // Validate coordinates
      if (
        Number.isFinite(latitude) &&
        Number.isFinite(longitude) &&
        latitude >= -90 &&
        latitude <= 90 &&
        longitude >= -180 &&
        longitude <= 180
      ) {
        coordinates.push([longitude, latitude]); // Mapbox format: [lng, lat]
      }
    }
  } catch (e) {
    console.error('Failed to decode Google polyline:', e);
    return [];
  }

  return coordinates;
}

/**
 * Smart polyline decoder that auto-detects the format.
 * Supports:
 * - HERE Flexible Polyline (used by HERE API)
 * - Google Encoded Polyline (used by NextBillion.ai, Google Maps, etc.)
 * 
 * Returns coordinates in Mapbox format: [lng, lat]
 */
export function decodePolyline(encoded: string): LngLat[] {
  if (!encoded) return [];

  // HERE Flexible Polyline typically starts with 'B' (version 1) 
  // and uses characters from ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_
  const firstChar = encoded.charAt(0);
  
  // Try HERE format first if it looks like it
  if (firstChar === 'B') {
    try {
      const coords = decodeHereFlexiblePolyline(encoded);
      if (coords.length >= 2) {
        console.log('[PolylineDecoder] Decoded as HERE Flexible Polyline:', coords.length, 'points');
        return coords;
      }
    } catch (e) {
      // Fall through to Google format
    }
  }

  // Try Google format (used by NextBillion.ai)
  const googleCoords = decodeGooglePolyline(encoded);
  if (googleCoords.length >= 2) {
    console.log('[PolylineDecoder] Decoded as Google Encoded Polyline:', googleCoords.length, 'points');
    return googleCoords;
  }

  // Last attempt with HERE if we haven't tried it
  if (firstChar !== 'B') {
    try {
      const coords = decodeHereFlexiblePolyline(encoded);
      if (coords.length >= 2) {
        console.log('[PolylineDecoder] Decoded as HERE Flexible Polyline (fallback):', coords.length, 'points');
        return coords;
      }
    } catch (e) {
      // Nothing we can do
    }
  }

  console.warn('[PolylineDecoder] Failed to decode polyline, format unknown');
  return [];
}
