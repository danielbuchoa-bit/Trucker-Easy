export type LngLat = [number, number];

// HERE Flexible Polyline decoder (2D output) based on the official spec:
// https://github.com/heremaps/flexible-polyline

const ENCODING_TABLE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

// Build ASCII decoding table for fast lookups
const DECODING_TABLE: Int16Array = (() => {
  const table = new Int16Array(128);
  table.fill(-1);
  for (let i = 0; i < ENCODING_TABLE.length; i++) {
    const code = ENCODING_TABLE.charCodeAt(i);
    if (code < 128) table[code] = i;
  }
  return table;
})();

function decodeChar(char: string): number {
  const code = char.charCodeAt(0);
  if (code >= 128) return -1;
  return DECODING_TABLE[code];
}

function decodeUnsignedVarint(encoded: string, idxRef: { idx: number }): number {
  let result = 0;
  let shift = 0;

  while (idxRef.idx < encoded.length) {
    const v = decodeChar(encoded[idxRef.idx++]);
    if (v < 0) throw new Error('Invalid encoding');

    result |= (v & 0x1f) << shift;

    const hasNext = (v & 0x20) !== 0;
    if (!hasNext) return result;

    shift += 5;
  }

  throw new Error('Invalid encoding (truncated)');
}

function toSigned(val: number): number {
  // least-significant bit stores the sign
  return (val & 1) !== 0 ? -((val + 1) >> 1) : val >> 1;
}

function decodeSignedVarint(encoded: string, idxRef: { idx: number }): number {
  return toSigned(decodeUnsignedVarint(encoded, idxRef));
}

/**
 * Decodes HERE Flexible Polyline and returns coordinates in Mapbox order: [lng, lat].
 * Filters invalid coords to avoid runtime crashes.
 */
export function decodeHereFlexiblePolyline(encoded: string): LngLat[] {
  if (!encoded) return [];

  try {
    const idxRef = { idx: 0 };

    // Header: version + content (both are unsigned varints)
    const headerVersion = decodeUnsignedVarint(encoded, idxRef);
    if (headerVersion !== 1) {
      // still try to decode if a newer version shows up
      console.warn('Unexpected flexible polyline version:', headerVersion);
    }

    const header = decodeUnsignedVarint(encoded, idxRef);
    const precision = header & 0x0f;
    const thirdDim = (header >> 4) & 0x07;
    const thirdDimPrecision = (header >> 7) & 0x0f;

    const factorDegree = 10 ** precision;
    const factorZ = 10 ** thirdDimPrecision;

    let lastLat = 0;
    let lastLng = 0;
    let lastZ = 0;

    const coordinates: LngLat[] = [];

    while (idxRef.idx < encoded.length) {
      lastLat += decodeSignedVarint(encoded, idxRef);
      lastLng += decodeSignedVarint(encoded, idxRef);

      if (thirdDim !== 0) {
        lastZ += decodeSignedVarint(encoded, idxRef);
        // third dimension ignored for map rendering (but still consumed)
        void factorZ;
        void lastZ;
      }

      const lat = lastLat / factorDegree;
      const lng = lastLng / factorDegree;

      if (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
      ) {
        coordinates.push([lng, lat]);
      }
    }

    return coordinates;
  } catch (e) {
    console.error('Failed to decode HERE flexible polyline', e);
    return [];
  }
}
