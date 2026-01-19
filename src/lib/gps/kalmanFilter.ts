/**
 * 2D Kalman Filter for GPS Position Smoothing
 * 
 * State vector: [lat, lng, vLat, vLng]
 * - lat, lng: position in degrees
 * - vLat, vLng: velocity in degrees/second
 * 
 * This filter provides:
 * - Noise reduction without excessive lag
 * - Prediction during GPS gaps
 * - Spike rejection through innovation gating
 */

import { KALMAN } from './constants';

export interface KalmanState {
  // Position (degrees)
  lat: number;
  lng: number;
  // Velocity (degrees/second)
  vLat: number;
  vLng: number;
  // Covariance matrix (simplified - diagonal elements only)
  P: [number, number, number, number]; // P_lat, P_lng, P_vLat, P_vLng
  // Last update timestamp
  lastUpdate: number;
}

export interface KalmanMeasurement {
  lat: number;
  lng: number;
  accuracy: number; // GPS accuracy in meters
  timestamp: number;
}

export interface KalmanResult {
  lat: number;
  lng: number;
  vLat: number;
  vLng: number;
  speedMps: number;
  isValid: boolean;
  innovation: number; // For spike detection
}

/**
 * Convert GPS accuracy (meters) to measurement noise (degrees²)
 */
function accuracyToNoise(accuracyM: number): number {
  // Convert meters to degrees (approximate)
  const accuracyDeg = accuracyM / 111000;
  // Square for variance, with bounds
  const noise = accuracyDeg * accuracyDeg;
  return Math.max(KALMAN.R_MIN, Math.min(KALMAN.R_MAX, noise * KALMAN.R_BASE * 1e6));
}

/**
 * Create initial Kalman state
 */
export function createKalmanState(
  lat: number,
  lng: number,
  timestamp: number
): KalmanState {
  return {
    lat,
    lng,
    vLat: 0,
    vLng: 0,
    P: [
      KALMAN.Q_POSITION * 10, // Initial position uncertainty
      KALMAN.Q_POSITION * 10,
      KALMAN.Q_VELOCITY * 10, // Initial velocity uncertainty
      KALMAN.Q_VELOCITY * 10,
    ],
    lastUpdate: timestamp,
  };
}

/**
 * Predict step - project state forward in time
 */
export function kalmanPredict(
  state: KalmanState,
  timestamp: number
): KalmanState {
  const dt = (timestamp - state.lastUpdate) / 1000; // seconds
  
  if (dt <= 0 || dt > 30) {
    // No time passed or too much time - return as is
    return { ...state, lastUpdate: timestamp };
  }

  // State prediction: x = F * x
  // Position += velocity * dt
  const predictedLat = state.lat + state.vLat * dt;
  const predictedLng = state.lng + state.vLng * dt;

  // Covariance prediction: P = F * P * F' + Q
  // Simplified for diagonal covariance
  const Q_pos = KALMAN.Q_POSITION * dt;
  const Q_vel = KALMAN.Q_VELOCITY * dt;

  return {
    lat: predictedLat,
    lng: predictedLng,
    vLat: state.vLat,
    vLng: state.vLng,
    P: [
      state.P[0] + state.P[2] * dt * dt + Q_pos,
      state.P[1] + state.P[3] * dt * dt + Q_pos,
      state.P[2] + Q_vel,
      state.P[3] + Q_vel,
    ],
    lastUpdate: timestamp,
  };
}

/**
 * Update step - incorporate new measurement
 */
export function kalmanUpdate(
  state: KalmanState,
  measurement: KalmanMeasurement
): KalmanResult {
  // First predict to measurement time
  const predicted = kalmanPredict(state, measurement.timestamp);
  
  const dt = (measurement.timestamp - state.lastUpdate) / 1000;
  if (dt <= 0) {
    return {
      lat: predicted.lat,
      lng: predicted.lng,
      vLat: predicted.vLat,
      vLng: predicted.vLng,
      speedMps: Math.sqrt(predicted.vLat ** 2 + predicted.vLng ** 2) * 111000,
      isValid: true,
      innovation: 0,
    };
  }

  // Measurement noise
  const R = accuracyToNoise(measurement.accuracy);

  // Innovation (measurement residual)
  const yLat = measurement.lat - predicted.lat;
  const yLng = measurement.lng - predicted.lng;
  const innovation = Math.sqrt(yLat ** 2 + yLng ** 2);

  // Innovation covariance: S = H * P * H' + R
  const S_lat = predicted.P[0] + R;
  const S_lng = predicted.P[1] + R;

  // Kalman gain: K = P * H' * S^-1
  const K_lat = predicted.P[0] / S_lat;
  const K_lng = predicted.P[1] / S_lng;
  const K_vLat = predicted.P[2] / S_lat;
  const K_vLng = predicted.P[3] / S_lng;

  // State update: x = x + K * y
  const updatedLat = predicted.lat + K_lat * yLat;
  const updatedLng = predicted.lng + K_lng * yLng;
  
  // Velocity update from position change
  let updatedVLat = predicted.vLat + K_vLat * yLat;
  let updatedVLng = predicted.vLng + K_vLng * yLng;

  // Velocity from position delta (more direct)
  if (dt > 0.1 && dt < 10) {
    const directVLat = (measurement.lat - state.lat) / dt;
    const directVLng = (measurement.lng - state.lng) / dt;
    
    // Blend Kalman velocity with direct velocity
    const blend = Math.min(0.5, measurement.accuracy / 30);
    updatedVLat = updatedVLat * (1 - blend) + directVLat * blend;
    updatedVLng = updatedVLng * (1 - blend) + directVLng * blend;
  }

  // Covariance update: P = (I - K * H) * P
  const updatedP: [number, number, number, number] = [
    (1 - K_lat) * predicted.P[0],
    (1 - K_lng) * predicted.P[1],
    (1 - K_vLat) * predicted.P[2],
    (1 - K_vLng) * predicted.P[3],
  ];

  // Calculate speed in m/s
  const speedDegPerSec = Math.sqrt(updatedVLat ** 2 + updatedVLng ** 2);
  const speedMps = speedDegPerSec * 111000; // Approximate conversion

  // Update state
  state.lat = updatedLat;
  state.lng = updatedLng;
  state.vLat = updatedVLat;
  state.vLng = updatedVLng;
  state.P = updatedP;
  state.lastUpdate = measurement.timestamp;

  return {
    lat: updatedLat,
    lng: updatedLng,
    vLat: updatedVLat,
    vLng: updatedVLng,
    speedMps,
    isValid: true,
    innovation,
  };
}

/**
 * Check if measurement is a spike (innovation gating)
 */
export function isSpike(
  state: KalmanState,
  measurement: KalmanMeasurement,
  maxSpeedMps: number = 35
): boolean {
  const dt = (measurement.timestamp - state.lastUpdate) / 1000;
  
  if (dt <= 0.05 || dt > 30) {
    return false; // Can't determine, allow through
  }

  // Calculate implied speed
  const dLat = measurement.lat - state.lat;
  const dLng = measurement.lng - state.lng;
  const distanceDeg = Math.sqrt(dLat ** 2 + dLng ** 2);
  const distanceM = distanceDeg * 111000;
  const impliedSpeed = distanceM / dt;

  // Reject if impossible speed
  if (impliedSpeed > maxSpeedMps) {
    return true;
  }

  // Reject if extreme acceleration
  const currentSpeed = Math.sqrt(state.vLat ** 2 + state.vLng ** 2) * 111000;
  const acceleration = Math.abs(impliedSpeed - currentSpeed) / dt;
  if (acceleration > 5.0) { // 5 m/s² = very aggressive for trucks
    return true;
  }

  return false;
}

/**
 * Get predicted position without updating state
 */
export function predictPosition(
  state: KalmanState,
  targetTime: number
): { lat: number; lng: number } {
  const dt = (targetTime - state.lastUpdate) / 1000;
  
  if (dt <= 0) {
    return { lat: state.lat, lng: state.lng };
  }

  return {
    lat: state.lat + state.vLat * dt,
    lng: state.lng + state.vLng * dt,
  };
}
