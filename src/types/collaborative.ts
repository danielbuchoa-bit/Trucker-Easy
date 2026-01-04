export interface Facility {
  id: string;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  geofence_radius_m: number;
  place_id?: string;
  facility_type: 'shipper' | 'receiver' | 'both';
  created_by: string;
  verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface FacilityReview {
  id: string;
  facility_id: string;
  user_id: string;
  overall_rating: number;
  treatment_rating?: number;
  speed_rating?: number;
  staff_help_rating?: number;
  parking_rating?: number;
  exit_ease_rating?: number;
  visit_type: 'pickup' | 'delivery' | 'both';
  time_spent?: string;
  parking_available?: 'yes' | 'limited' | 'no';
  overnight_allowed?: 'allowed' | 'not_allowed' | 'unknown';
  restroom_available?: 'yes' | 'no' | 'unknown';
  tips?: string;
  created_at: string;
}

export interface FacilityAggregate {
  facility_id: string;
  avg_overall: number;
  avg_treatment?: number;
  avg_speed?: number;
  avg_staff_help?: number;
  avg_parking?: number;
  avg_exit_ease?: number;
  review_count: number;
  typical_time?: string;
  updated_at: string;
}

export interface RoadReport {
  id: string;
  user_id: string;
  report_type: 'weigh_station' | 'road_condition' | 'parking';
  subtype?: string;
  lat: number;
  lng: number;
  details: RoadReportDetails;
  confirmations: number;
  denials: number;
  expires_at: string;
  active: boolean;
  created_at: string;
}

export interface RoadReportDetails {
  // Weigh station
  status?: 'open' | 'closed' | 'unknown';
  pulled_in?: boolean;
  bypass?: boolean;
  inspection?: 'none' | 'level_3' | 'level_2' | 'other';
  
  // Road conditions
  condition?: 'accident' | 'traffic' | 'construction' | 'lane_closed' | 'ice_snow' | 'high_wind' | 'flooding';
  
  // Parking
  parking_status?: 'full' | 'few_spots' | 'plenty';
  location_name?: string;
}

export interface ReportVote {
  id: string;
  report_id: string;
  user_id: string;
  vote_type: 'confirm' | 'deny';
  created_at: string;
}

export const TIME_SPENT_OPTIONS = [
  { value: 'less_30', label: '<30 min' },
  { value: '30_60', label: '30-60 min' },
  { value: '1_2h', label: '1-2 hours' },
  { value: '2_4h', label: '2-4 hours' },
  { value: 'more_4h', label: '4+ hours' },
] as const;

export const REPORT_TYPE_TTL: Record<string, number> = {
  weigh_station: 4 * 60 * 60 * 1000, // 4 hours
  road_condition: 2 * 60 * 60 * 1000, // 2 hours
  parking: 1 * 60 * 60 * 1000, // 1 hour
  ice_snow: 8 * 60 * 60 * 1000, // 8 hours
  high_wind: 6 * 60 * 60 * 1000, // 6 hours
};

export const ROAD_CONDITIONS = [
  { value: 'accident', label: 'Accident', icon: '🚨' },
  { value: 'traffic', label: 'Heavy Traffic', icon: '🚗' },
  { value: 'construction', label: 'Construction', icon: '🚧' },
  { value: 'lane_closed', label: 'Lane Closed', icon: '⛔' },
  { value: 'ice_snow', label: 'Ice/Snow', icon: '❄️' },
  { value: 'high_wind', label: 'High Wind', icon: '💨' },
  { value: 'flooding', label: 'Flooding', icon: '🌊' },
] as const;

export const INSPECTION_LEVELS = [
  { value: 'none', label: 'None' },
  { value: 'level_3', label: 'Level 3 (Walk-around)' },
  { value: 'level_2', label: 'Level 2 (Full Inspection)' },
  { value: 'other', label: 'Other' },
] as const;
