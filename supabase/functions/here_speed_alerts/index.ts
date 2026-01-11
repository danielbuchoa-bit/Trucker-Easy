import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SpeedAlertsRequest {
  lat: number;
  lng: number;
  radiusMeters?: number;
  // Optional: route corridor for along-route alerts
  routeCoords?: [number, number][]; // [lng, lat] pairs
}

interface SpeedAlert {
  id: string;
  type: 'speed_camera' | 'red_light_camera' | 'average_speed' | 'mobile_patrol' | 
        'enforcement_zone' | 'school_zone' | 'construction_zone' | 'incident';
  lat: number;
  lng: number;
  speedLimitMph?: number;
  speedLimitKmh?: number;
  direction?: number;
  active: boolean;
  name?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  criticality?: string;
}

// Map HERE incident types to our alert types
function mapIncidentType(hereType: string, codes: number[]): SpeedAlert['type'] {
  const typeMap: Record<string, SpeedAlert['type']> = {
    'construction': 'construction_zone',
    'roadClosure': 'construction_zone',
    'laneRestriction': 'enforcement_zone',
    'massTransit': 'enforcement_zone',
    'plannedEvent': 'enforcement_zone',
    'roadHazard': 'enforcement_zone',
    'weather': 'enforcement_zone',
    'congestion': 'enforcement_zone',
    'accident': 'incident',
    'disabledVehicle': 'incident',
  };
  
  // Check codes for specific camera types
  // Code 1: Traffic camera
  // Code 2: Speed trap
  if (codes?.includes(1) || codes?.includes(2)) {
    return 'speed_camera';
  }
  
  return typeMap[hereType] || 'enforcement_zone';
}

// Extract speed limit from incident data
function extractSpeedLimit(incident: any): { mph?: number; kmh?: number } {
  // HERE may include speed info in the incident
  const speedLimit = incident.speedLimit;
  if (speedLimit) {
    const kmh = speedLimit;
    return { kmh, mph: Math.round(kmh * 0.621371) };
  }
  return {};
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const HERE_API_KEY = Deno.env.get('HERE_API_KEY');
    if (!HERE_API_KEY) {
      console.error('[HERE_SPEED_ALERTS] ❌ HERE_API_KEY not configured');
      return new Response(
        JSON.stringify({ ok: false, alerts: [], error: 'API not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: SpeedAlertsRequest = await req.json();
    const { lat, lng, radiusMeters = 10000, routeCoords } = body;

    if (lat === undefined || lng === undefined) {
      return new Response(
        JSON.stringify({ ok: false, alerts: [], error: 'lat and lng required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[HERE_SPEED_ALERTS] Request:', { lat, lng, radiusMeters });

    const alerts: SpeedAlert[] = [];

    // 1. Fetch traffic incidents from HERE Traffic API
    try {
      // Build bounding box from center + radius
      const latDelta = (radiusMeters / 111000);
      const lngDelta = (radiusMeters / (111000 * Math.cos(lat * Math.PI / 180)));
      
      const bbox = `${lng - lngDelta},${lat - latDelta},${lng + lngDelta},${lat + latDelta}`;
      
      const incidentsUrl = new URL('https://data.traffic.hereapi.com/v7/incidents');
      incidentsUrl.searchParams.set('in', `bbox:${bbox}`);
      incidentsUrl.searchParams.set('locationReferencing', 'shape');
      incidentsUrl.searchParams.set('apiKey', HERE_API_KEY);
      
      console.log('[HERE_SPEED_ALERTS] Fetching incidents:', incidentsUrl.toString().replace(HERE_API_KEY, '***'));
      
      const incidentsRes = await fetch(incidentsUrl.toString());
      const incidentsData = await incidentsRes.json();
      
      if (incidentsRes.ok && incidentsData.results) {
        console.log('[HERE_SPEED_ALERTS] Found', incidentsData.results.length, 'incidents');
        
        for (const result of incidentsData.results) {
          const incident = result.incidentDetails;
          const location = result.location;
          
          if (!incident || !location) continue;
          
          // Get position from shape
          const point = location.shape?.links?.[0]?.points?.[0];
          if (!point) continue;
          
          const speedLimits = extractSpeedLimit(incident);
          const alertType = mapIncidentType(incident.type, incident.codes || []);
          
          alerts.push({
            id: incident.id || `here-${Date.now()}-${Math.random()}`,
            type: alertType,
            lat: point.lat,
            lng: point.lng,
            speedLimitMph: speedLimits.mph,
            speedLimitKmh: speedLimits.kmh,
            active: !incident.roadClosed,
            name: incident.summary?.value || incident.description?.value,
            description: incident.description?.value,
            startTime: incident.startTime,
            endTime: incident.endTime,
            criticality: incident.criticality,
          });
        }
      } else {
        console.log('[HERE_SPEED_ALERTS] Incidents API response:', incidentsRes.status, incidentsData);
      }
    } catch (err) {
      console.error('[HERE_SPEED_ALERTS] Incidents fetch error:', err);
    }

    // 2. Fetch flow/hazards for additional speed info
    try {
      const flowUrl = new URL('https://data.traffic.hereapi.com/v7/flow');
      const latDelta = (radiusMeters / 111000);
      const lngDelta = (radiusMeters / (111000 * Math.cos(lat * Math.PI / 180)));
      const bbox = `${lng - lngDelta},${lat - latDelta},${lng + lngDelta},${lat + latDelta}`;
      
      flowUrl.searchParams.set('in', `bbox:${bbox}`);
      flowUrl.searchParams.set('apiKey', HERE_API_KEY);
      flowUrl.searchParams.set('locationReferencing', 'shape');
      
      const flowRes = await fetch(flowUrl.toString());
      const flowData = await flowRes.json();
      
      if (flowRes.ok && flowData.results) {
        // Look for speed restrictions or slow traffic zones
        for (const result of flowData.results) {
          const currentFlow = result.currentFlow;
          const location = result.location;
          
          if (!currentFlow || !location) continue;
          
          // Flag if speed is significantly restricted (under 25 mph / 40 kmh)
          const speedKmh = currentFlow.speed;
          const freeFlowKmh = currentFlow.freeFlow;
          
          // If current speed is less than 50% of free flow, it's likely an enforcement/congestion zone
          if (speedKmh && freeFlowKmh && speedKmh < freeFlowKmh * 0.5) {
            const point = location.shape?.links?.[0]?.points?.[0];
            if (point) {
              alerts.push({
                id: `flow-${point.lat}-${point.lng}`,
                type: 'enforcement_zone',
                lat: point.lat,
                lng: point.lng,
                speedLimitMph: Math.round(speedKmh * 0.621371),
                speedLimitKmh: Math.round(speedKmh),
                active: true,
                name: 'Slow Traffic Zone',
                description: `Current: ${Math.round(speedKmh)} km/h, Normal: ${Math.round(freeFlowKmh)} km/h`,
                criticality: speedKmh < 20 ? 'critical' : 'major',
              });
            }
          }
        }
      }
    } catch (err) {
      console.error('[HERE_SPEED_ALERTS] Flow fetch error:', err);
    }

    // 3. Add community-reported alerts (would be from database in production)
    // For now, we rely on HERE data only
    
    // Deduplicate by proximity (within 100m)
    const uniqueAlerts: SpeedAlert[] = [];
    for (const alert of alerts) {
      const isDuplicate = uniqueAlerts.some(existing => {
        const dist = Math.sqrt(
          Math.pow((alert.lat - existing.lat) * 111000, 2) +
          Math.pow((alert.lng - existing.lng) * 111000 * Math.cos(alert.lat * Math.PI / 180), 2)
        );
        return dist < 100;
      });
      
      if (!isDuplicate) {
        uniqueAlerts.push(alert);
      }
    }

    console.log('[HERE_SPEED_ALERTS] ✅ Returning', uniqueAlerts.length, 'unique alerts');

    return new Response(
      JSON.stringify({ 
        ok: true, 
        alerts: uniqueAlerts,
        source: 'here',
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[HERE_SPEED_ALERTS] ❌ Error:', error);
    
    return new Response(
      JSON.stringify({ ok: false, alerts: [], error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
