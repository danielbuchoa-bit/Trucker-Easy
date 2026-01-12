import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SpeedAlertsRequest {
  lat: number;
  lng: number;
  radiusMeters?: number;
  routeCoords?: [number, number][];
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
  source?: string;
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
  
  if (codes?.includes(1) || codes?.includes(2)) {
    return 'speed_camera';
  }
  
  return typeMap[hereType] || 'enforcement_zone';
}

// Extract speed limit from incident data
function extractSpeedLimit(incident: any): { mph?: number; kmh?: number } {
  const speedLimit = incident.speedLimit;
  if (speedLimit) {
    const kmh = speedLimit;
    return { kmh, mph: Math.round(kmh * 0.621371) };
  }
  return {};
}

// Fetch traffic cameras from HERE Browse API
async function fetchTrafficCameras(lat: number, lng: number, radiusMeters: number, apiKey: string): Promise<SpeedAlert[]> {
  const alerts: SpeedAlert[] = [];
  
  try {
    // HERE Browse API categories for traffic cameras
    // 700-7520: Traffic cameras/surveillance
    // 700-7530: Speed cameras  
    const browseUrl = new URL('https://browse.search.hereapi.com/v1/browse');
    browseUrl.searchParams.set('at', `${lat},${lng}`);
    browseUrl.searchParams.set('limit', '50');
    browseUrl.searchParams.set('in', `circle:${lat},${lng};r=${radiusMeters}`);
    // Search for traffic enforcement POIs
    browseUrl.searchParams.set('categories', '700-7520,700-7530,700-7850-0000');
    browseUrl.searchParams.set('apiKey', apiKey);
    
    console.log('[HERE_SPEED_ALERTS] Fetching traffic cameras from Browse API');
    
    const response = await fetch(browseUrl.toString());
    const data = await response.json();
    
    if (response.ok && data.items) {
      console.log('[HERE_SPEED_ALERTS] Found', data.items.length, 'POIs from Browse API');
      
      for (const item of data.items) {
        const position = item.position;
        if (!position) continue;
        
        // Determine type based on category
        let alertType: SpeedAlert['type'] = 'speed_camera';
        const categoryId = item.categories?.[0]?.id || '';
        const title = (item.title || '').toLowerCase();
        
        if (title.includes('red light') || title.includes('semaforo') || title.includes('traffic light')) {
          alertType = 'red_light_camera';
        } else if (title.includes('school')) {
          alertType = 'school_zone';
        } else if (categoryId === '700-7530') {
          alertType = 'speed_camera';
        }
        
        alerts.push({
          id: item.id || `browse-${position.lat}-${position.lng}`,
          type: alertType,
          lat: position.lat,
          lng: position.lng,
          active: true,
          name: item.title,
          description: item.address?.label,
          source: 'here_browse',
        });
      }
    }
  } catch (err) {
    console.error('[HERE_SPEED_ALERTS] Browse API error:', err);
  }
  
  return alerts;
}

// Fetch school zones from HERE Browse API
async function fetchSchoolZones(lat: number, lng: number, radiusMeters: number, apiKey: string): Promise<SpeedAlert[]> {
  const alerts: SpeedAlert[] = [];
  
  try {
    const browseUrl = new URL('https://browse.search.hereapi.com/v1/browse');
    browseUrl.searchParams.set('at', `${lat},${lng}`);
    browseUrl.searchParams.set('limit', '30');
    browseUrl.searchParams.set('in', `circle:${lat},${lng};r=${Math.min(radiusMeters, 5000)}`);
    // Schools category
    browseUrl.searchParams.set('categories', '800-8200');
    browseUrl.searchParams.set('apiKey', apiKey);
    
    console.log('[HERE_SPEED_ALERTS] Fetching schools for school zones');
    
    const response = await fetch(browseUrl.toString());
    const data = await response.json();
    
    if (response.ok && data.items) {
      console.log('[HERE_SPEED_ALERTS] Found', data.items.length, 'schools');
      
      for (const item of data.items) {
        const position = item.position;
        if (!position) continue;
        
        alerts.push({
          id: `school-${item.id || `${position.lat}-${position.lng}`}`,
          type: 'school_zone',
          lat: position.lat,
          lng: position.lng,
          speedLimitMph: 20,
          speedLimitKmh: 32,
          active: true,
          name: `School Zone: ${item.title}`,
          description: item.address?.label,
          source: 'here_browse',
        });
      }
    }
  } catch (err) {
    console.error('[HERE_SPEED_ALERTS] School zones fetch error:', err);
  }
  
  return alerts;
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
    const { lat, lng, radiusMeters = 10000 } = body;

    if (lat === undefined || lng === undefined) {
      return new Response(
        JSON.stringify({ ok: false, alerts: [], error: 'lat and lng required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[HERE_SPEED_ALERTS] Request:', { lat, lng, radiusMeters });

    const alerts: SpeedAlert[] = [];

    // 1. Fetch traffic cameras from Browse API (includes red light cameras)
    const cameraAlerts = await fetchTrafficCameras(lat, lng, radiusMeters, HERE_API_KEY);
    alerts.push(...cameraAlerts);
    
    // 2. Fetch school zones
    const schoolAlerts = await fetchSchoolZones(lat, lng, radiusMeters, HERE_API_KEY);
    alerts.push(...schoolAlerts);

    // 3. Fetch traffic incidents from HERE Traffic API
    try {
      const latDelta = (radiusMeters / 111000);
      const lngDelta = (radiusMeters / (111000 * Math.cos(lat * Math.PI / 180)));
      
      const bbox = `${lng - lngDelta},${lat - latDelta},${lng + lngDelta},${lat + latDelta}`;
      
      const incidentsUrl = new URL('https://data.traffic.hereapi.com/v7/incidents');
      incidentsUrl.searchParams.set('in', `bbox:${bbox}`);
      incidentsUrl.searchParams.set('locationReferencing', 'shape');
      incidentsUrl.searchParams.set('apiKey', HERE_API_KEY);
      
      console.log('[HERE_SPEED_ALERTS] Fetching incidents');
      
      const incidentsRes = await fetch(incidentsUrl.toString());
      const incidentsData = await incidentsRes.json();
      
      if (incidentsRes.ok && incidentsData.results) {
        console.log('[HERE_SPEED_ALERTS] Found', incidentsData.results.length, 'incidents');
        
        for (const result of incidentsData.results) {
          const incident = result.incidentDetails;
          const location = result.location;
          
          if (!incident || !location) continue;
          
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
            source: 'here_traffic',
          });
        }
      }
    } catch (err) {
      console.error('[HERE_SPEED_ALERTS] Incidents fetch error:', err);
    }

    // 4. Fetch flow for slow traffic zones
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
        for (const result of flowData.results) {
          const currentFlow = result.currentFlow;
          const location = result.location;
          
          if (!currentFlow || !location) continue;
          
          const speedKmh = currentFlow.speed;
          const freeFlowKmh = currentFlow.freeFlow;
          
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
                source: 'here_flow',
              });
            }
          }
        }
      }
    } catch (err) {
      console.error('[HERE_SPEED_ALERTS] Flow fetch error:', err);
    }

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
    console.log('[HERE_SPEED_ALERTS] Alert types:', uniqueAlerts.map(a => a.type).reduce((acc, t) => {
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {} as Record<string, number>));

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
