export type SpeedAlertType = 
  | 'speed_camera'      // Fixed speed camera
  | 'red_light_camera'  // Red light camera
  | 'average_speed'     // Average speed zone
  | 'mobile_patrol'     // Mobile patrol area
  | 'enforcement_zone'  // General enforcement zone
  | 'school_zone'       // School zone with reduced speed
  | 'construction_zone' // Construction zone
  | 'weigh_station';    // Weigh station ahead

export interface SpeedAlert {
  id: string;
  type: SpeedAlertType;
  lat: number;
  lng: number;
  speedLimit?: number;
  speedLimitMph?: number;
  direction?: number; // Bearing the camera faces (0-360)
  active: boolean;
  reportedAt?: string;
  confirmedCount?: number;
  confirmations?: number;
  denials?: number;
  name?: string;
  description?: string;
  source?: 'here' | 'user';
}

export interface SpeedAlertWithDistance extends SpeedAlert {
  distanceMeters: number;
  distanceMiles: number;
  bearing: number;
  isApproaching: boolean; // Within heading cone
  eta?: number; // Seconds until reaching
}

export const ALERT_TYPE_CONFIG: Record<SpeedAlertType, {
  label: string;
  shortLabel: string;
  color: string;
  bgColor: string;
  icon: string;
  warningDistanceMeters: number;
  criticalDistanceMeters: number;
  soundAlert: boolean;
}> = {
  speed_camera: {
    label: 'Speed Camera',
    shortLabel: 'Camera',
    color: 'text-red-500',
    bgColor: 'bg-red-500',
    icon: 'camera',
    warningDistanceMeters: 1609, // 1 mile
    criticalDistanceMeters: 400, // 0.25 mile
    soundAlert: true,
  },
  red_light_camera: {
    label: 'Red Light Camera',
    shortLabel: 'Red Light',
    color: 'text-red-600',
    bgColor: 'bg-red-600',
    icon: 'traffic-light',
    warningDistanceMeters: 800,
    criticalDistanceMeters: 200,
    soundAlert: true,
  },
  average_speed: {
    label: 'Average Speed Zone',
    shortLabel: 'Avg Speed',
    color: 'text-orange-500',
    bgColor: 'bg-orange-500',
    icon: 'gauge',
    warningDistanceMeters: 3218, // 2 miles
    criticalDistanceMeters: 1609,
    soundAlert: true,
  },
  mobile_patrol: {
    label: 'Mobile Patrol Reported',
    shortLabel: 'Patrol',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500',
    icon: 'car',
    warningDistanceMeters: 1609,
    criticalDistanceMeters: 400,
    soundAlert: true,
  },
  enforcement_zone: {
    label: 'Enforcement Zone',
    shortLabel: 'Enforce',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500',
    icon: 'shield',
    warningDistanceMeters: 1609,
    criticalDistanceMeters: 800,
    soundAlert: true,
  },
  school_zone: {
    label: 'School Zone',
    shortLabel: 'School',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500',
    icon: 'school',
    warningDistanceMeters: 800,
    criticalDistanceMeters: 200,
    soundAlert: true,
  },
  construction_zone: {
    label: 'Construction Zone',
    shortLabel: 'Construction',
    color: 'text-orange-600',
    bgColor: 'bg-orange-600',
    icon: 'construction',
    warningDistanceMeters: 1609,
    criticalDistanceMeters: 400,
    soundAlert: false,
  },
  weigh_station: {
    label: 'Weigh Station',
    shortLabel: 'Weigh',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500',
    icon: 'scale',
    warningDistanceMeters: 3218, // 2 miles
    criticalDistanceMeters: 1609,
    soundAlert: true,
  },
};
