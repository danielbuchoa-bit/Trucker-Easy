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
  result: 'bypass' | 'pull_in' | 'unknown';
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

export type BypassResult = 'bypass' | 'pull_in' | 'unknown';
