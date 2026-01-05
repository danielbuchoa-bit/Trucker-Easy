export interface WeighStation {
  id: string;
  name: string;
  state: string | null;
  lat: number;
  lng: number;
  radius_m: number;
  active: boolean;
  created_at: string;
}

export interface BypassEvent {
  id: string;
  user_id: string;
  vehicle_id: string | null;
  weigh_station_id: string;
  occurred_at: string;
  result: BypassResult;
  lat: number;
  lng: number;
  source: string;
  confidence_score: number;
  created_at: string;
  weigh_stations?: {
    name: string;
    state: string | null;
  };
}

// Station closed, actively monitored (no bypass), or open with bypass
export type BypassResult = 'station_closed' | 'actively_monitored' | 'open_bypass';

export interface PendingBypassReport {
  id: string;
  weigh_station_id: string;
  station_name: string;
  result: BypassResult;
  lat: number;
  lng: number;
  occurred_at: string;
  synced: boolean;
}
