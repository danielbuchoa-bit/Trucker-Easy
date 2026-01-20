import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TracePoint {
  lat: number;
  lng: number;
  timestamp?: number;
  heading?: number;
  speed?: number;
}

interface MapMatchRequest {
  trace: TracePoint[];
  routeMode?: 'truck' | 'car';
  transportMode?: string;
}

interface MatchedPoint {
  lat: number;
  lng: number;
  originalLat: number;
  originalLng: number;
  confidence: number;
  linkId?: string;
  roadName?: string;
  bearing?: number;
  distanceFromOriginal: number;
  functionalClass?: number;
  speedLimitKmh?: number;
}

interface MapMatchResponse {
  success: boolean;
  matchedPoints: MatchedPoint[];
  warnings?: string[];
  error?: string;
}

/**
 * Haversine distance calculation
 */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const HERE_API_KEY = Deno.env.get('HERE_API_KEY');
    if (!HERE_API_KEY) {
      console.error('[MAP_MATCHING] HERE_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'HERE API not configured', matchedPoints: [] }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: MapMatchRequest = await req.json();
    const { trace, routeMode = 'truck' } = body;

    if (!trace || trace.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'trace array is required', matchedPoints: [] }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[MAP_MATCHING] Request:', { 
      traceLength: trace.length, 
      routeMode,
      firstPoint: trace[0],
      lastPoint: trace[trace.length - 1]
    });

    const matchedPoints: MatchedPoint[] = [];
    const warnings: string[] = [];

    // HERE Route Matching API v8 supports up to 20 waypoints per request
    // For more points, we need to batch them
    const MAX_POINTS_PER_BATCH = 20;
    const batches: TracePoint[][] = [];
    
    for (let i = 0; i < trace.length; i += MAX_POINTS_PER_BATCH - 1) {
      // Overlap by 1 point to maintain continuity
      const start = i === 0 ? 0 : i;
      const end = Math.min(i + MAX_POINTS_PER_BATCH, trace.length);
      batches.push(trace.slice(start, end));
    }

    console.log('[MAP_MATCHING] Processing', batches.length, 'batch(es)');

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx];
      
      try {
        // Build waypoint parameters
        const waypointParams: Record<string, string> = {
          apikey: HERE_API_KEY,
          mode: `fastest;${routeMode}`,
          routeMatch: '1',
          attributes: 'SPEED_LIMITS_FCn(*),LINK_FCn(*)',
        };

        // Add each waypoint
        batch.forEach((point, idx) => {
          let wp = `${point.lat},${point.lng}`;
          if (point.heading !== undefined && !isNaN(point.heading)) {
            wp += `;${Math.round(point.heading)}`;
          }
          waypointParams[`waypoint${idx}`] = wp;
        });

        const params = new URLSearchParams(waypointParams);
        const matchUrl = `https://routematching.hereapi.com/v8/match/routelinks?${params.toString()}`;
        
        console.log('[MAP_MATCHING] Batch', batchIdx + 1, '- calling HERE API...');
        
        const response = await fetch(matchUrl);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[MAP_MATCHING] Batch', batchIdx + 1, 'API error:', response.status, errorText.slice(0, 300));
          warnings.push(`Batch ${batchIdx + 1} failed: ${response.status}`);
          
          // Add unmatched points as fallback
          batch.forEach(point => {
            matchedPoints.push({
              lat: point.lat,
              lng: point.lng,
              originalLat: point.lat,
              originalLng: point.lng,
              confidence: 0,
              distanceFromOriginal: 0,
            });
          });
          continue;
        }

        const data = await response.json();
        console.log('[MAP_MATCHING] Batch', batchIdx + 1, 'response received');

        // Extract matched positions from response
        const route = data.response?.route?.[0];
        const legs = route?.leg || [];
        
        let pointIdx = 0;
        
        // Process each leg
        for (const leg of legs) {
          const links = leg.link || [];
          
          for (const link of links) {
            // Get the matched shape points
            const shape = link.shape || [];
            
            if (shape.length >= 2 && pointIdx < batch.length) {
              const originalPoint = batch[pointIdx];
              
              // Shape is array of "lat,lng" strings
              const matchedCoord = shape[0].split(',').map(Number);
              const matchedLat = matchedCoord[0];
              const matchedLng = matchedCoord[1];
              
              // Calculate bearing from shape
              let bearing: number | undefined;
              if (shape.length >= 2) {
                const nextCoord = shape[1].split(',').map(Number);
                const dLng = (nextCoord[1] - matchedLng) * Math.PI / 180;
                const lat1Rad = matchedLat * Math.PI / 180;
                const lat2Rad = nextCoord[0] * Math.PI / 180;
                const x = Math.sin(dLng) * Math.cos(lat2Rad);
                const y = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
                          Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
                bearing = (Math.atan2(x, y) * 180 / Math.PI + 360) % 360;
              }

              // Extract speed limit from attributes
              let speedLimitKmh: number | undefined;
              const speedLimits = link.attributes?.SPEED_LIMITS_FCn;
              if (speedLimits && speedLimits.length > 0) {
                speedLimitKmh = speedLimits[0]?.FROM_REF_SPEED_LIMIT || speedLimits[0]?.TO_REF_SPEED_LIMIT;
              }

              // Calculate distance from original
              const distanceFromOriginal = haversineDistance(
                originalPoint.lat, 
                originalPoint.lng, 
                matchedLat, 
                matchedLng
              );

              // Calculate confidence based on distance
              // 0-10m = 1.0, 10-50m = 0.9-0.5, >50m = lower
              let confidence = 1.0;
              if (distanceFromOriginal > 10) {
                confidence = Math.max(0.1, 1.0 - (distanceFromOriginal - 10) / 100);
              }

              matchedPoints.push({
                lat: matchedLat,
                lng: matchedLng,
                originalLat: originalPoint.lat,
                originalLng: originalPoint.lng,
                confidence,
                linkId: link.linkId,
                roadName: link.roadName || leg.roadName,
                bearing,
                distanceFromOriginal,
                functionalClass: link.functionalClass,
                speedLimitKmh,
              });

              pointIdx++;
            }
          }
        }

        // Handle any remaining unmatched points in batch
        while (pointIdx < batch.length) {
          const point = batch[pointIdx];
          matchedPoints.push({
            lat: point.lat,
            lng: point.lng,
            originalLat: point.lat,
            originalLng: point.lng,
            confidence: 0,
            distanceFromOriginal: 0,
          });
          pointIdx++;
        }

      } catch (batchError) {
        console.error('[MAP_MATCHING] Batch', batchIdx + 1, 'error:', batchError);
        warnings.push(`Batch ${batchIdx + 1} exception: ${batchError}`);
        
        // Fallback for failed batch
        batch.forEach(point => {
          matchedPoints.push({
            lat: point.lat,
            lng: point.lng,
            originalLat: point.lat,
            originalLng: point.lng,
            confidence: 0,
            distanceFromOriginal: 0,
          });
        });
      }
    }

    const result: MapMatchResponse = {
      success: matchedPoints.length > 0 && matchedPoints.some(p => p.confidence > 0),
      matchedPoints,
      warnings: warnings.length > 0 ? warnings : undefined,
    };

    console.log('[MAP_MATCHING] Result:', { 
      success: result.success, 
      matchedCount: matchedPoints.length,
      avgConfidence: matchedPoints.reduce((s, p) => s + p.confidence, 0) / matchedPoints.length,
    });

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[MAP_MATCHING] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage, matchedPoints: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
