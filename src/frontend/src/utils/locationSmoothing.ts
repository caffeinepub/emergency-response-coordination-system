/**
 * Client-side location smoothing utilities to reduce GPS jitter on map display
 * and improve backend update accuracy by filtering outliers and poor-accuracy fixes.
 */

const EARTH_RADIUS_KM = 6371;

/**
 * Convert degrees to radians
 */
function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @returns distance in kilometers
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Configuration for GPS filtering and smoothing
 */
export const GPS_CONFIG = {
  // Accuracy threshold: ignore fixes with accuracy worse than this (in meters)
  MAX_ACCURACY_METERS: 50,
  
  // Outlier detection: reject jumps larger than this (in meters)
  MAX_JUMP_METERS: 200,
  
  // Minimum time between outlier checks (milliseconds)
  MIN_TIME_BETWEEN_FIXES: 500,
  
  // Map display smoothing
  DISPLAY: {
    // Threshold for micro-movement filtering (in meters)
    MOVEMENT_THRESHOLD_METERS: 5,
    // Low-pass filter alpha for marker smoothing (0-1, lower = more smoothing)
    SMOOTHING_ALPHA: 0.3,
  },
  
  // Backend update smoothing (more conservative to reduce distance spikes)
  BACKEND: {
    // Threshold for micro-movement filtering (in meters)
    MOVEMENT_THRESHOLD_METERS: 8,
    // Low-pass filter alpha for backend updates (0-1, lower = more smoothing)
    SMOOTHING_ALPHA: 0.2,
  },
  
  // Center pan threshold (in meters) - prevents map shake
  CENTER_PAN_THRESHOLD_METERS: 10,
};

/**
 * Smoothed coordinate state for a single marker
 */
export interface SmoothedCoordinate {
  lat: number;
  lng: number;
  lastRawLat: number;
  lastRawLng: number;
  lastUpdateTime?: number;
}

/**
 * Apply low-pass filter smoothing to coordinates for map display
 * Returns smoothed coordinates or original if movement exceeds threshold
 */
export function smoothCoordinate(
  newLat: number,
  newLng: number,
  previous: SmoothedCoordinate | null
): SmoothedCoordinate {
  // First update - no smoothing needed
  if (!previous) {
    return {
      lat: newLat,
      lng: newLng,
      lastRawLat: newLat,
      lastRawLng: newLng,
      lastUpdateTime: Date.now(),
    };
  }

  // Calculate distance from last raw position
  const distanceKm = haversineDistance(
    previous.lastRawLat,
    previous.lastRawLng,
    newLat,
    newLng
  );
  const distanceMeters = distanceKm * 1000;

  // If movement is below threshold, keep previous smoothed position (reduce jitter)
  if (distanceMeters < GPS_CONFIG.DISPLAY.MOVEMENT_THRESHOLD_METERS) {
    return {
      ...previous,
      lastRawLat: newLat,
      lastRawLng: newLng,
      lastUpdateTime: Date.now(),
    };
  }

  // Significant movement detected - apply low-pass filter
  const smoothedLat = previous.lat + GPS_CONFIG.DISPLAY.SMOOTHING_ALPHA * (newLat - previous.lat);
  const smoothedLng = previous.lng + GPS_CONFIG.DISPLAY.SMOOTHING_ALPHA * (newLng - previous.lng);

  return {
    lat: smoothedLat,
    lng: smoothedLng,
    lastRawLat: newLat,
    lastRawLng: newLng,
    lastUpdateTime: Date.now(),
  };
}

/**
 * Check if center should be updated based on distance threshold
 * Prevents micro-panning that causes map shake
 */
export function shouldUpdateCenter(
  currentLat: number,
  currentLng: number,
  newLat: number,
  newLng: number
): boolean {
  const distanceKm = haversineDistance(currentLat, currentLng, newLat, newLng);
  const distanceMeters = distanceKm * 1000;
  return distanceMeters >= GPS_CONFIG.CENTER_PAN_THRESHOLD_METERS;
}

/**
 * Backend update pipeline state
 */
export interface BackendUpdateState {
  lat: number;
  lng: number;
  lastRawLat: number;
  lastRawLng: number;
  lastUpdateTime: number;
}

/**
 * Filter and smooth coordinates for backend updates
 * Returns null if the fix should be rejected (poor accuracy or outlier)
 */
export function processBackendUpdate(
  newLat: number,
  newLng: number,
  accuracy: number | undefined,
  previous: BackendUpdateState | null
): { coords: { latitude: number; longitude: number }; status: string } | null {
  // Check accuracy threshold
  if (accuracy !== undefined && accuracy > GPS_CONFIG.MAX_ACCURACY_METERS) {
    return null; // Reject: poor accuracy
  }

  // First update - accept without smoothing
  if (!previous) {
    return {
      coords: { latitude: newLat, longitude: newLng },
      status: 'initial',
    };
  }

  // Check for implausible jumps (outliers)
  const distanceKm = haversineDistance(
    previous.lastRawLat,
    previous.lastRawLng,
    newLat,
    newLng
  );
  const distanceMeters = distanceKm * 1000;
  const timeDelta = Date.now() - previous.lastUpdateTime;

  // Reject obvious outliers (e.g., 200m+ jump in < 1 second)
  if (
    distanceMeters > GPS_CONFIG.MAX_JUMP_METERS &&
    timeDelta < GPS_CONFIG.MIN_TIME_BETWEEN_FIXES
  ) {
    return null; // Reject: implausible jump
  }

  // If movement is below threshold, keep previous position (reduce jitter)
  if (distanceMeters < GPS_CONFIG.BACKEND.MOVEMENT_THRESHOLD_METERS) {
    return {
      coords: { latitude: previous.lat, longitude: previous.lng },
      status: 'held',
    };
  }

  // Significant movement detected - apply conservative smoothing
  const smoothedLat = previous.lat + GPS_CONFIG.BACKEND.SMOOTHING_ALPHA * (newLat - previous.lat);
  const smoothedLng = previous.lng + GPS_CONFIG.BACKEND.SMOOTHING_ALPHA * (newLng - previous.lng);

  return {
    coords: { latitude: smoothedLat, longitude: smoothedLng },
    status: 'smoothed',
  };
}

/**
 * Update backend state after successful update
 */
export function updateBackendState(
  newLat: number,
  newLng: number,
  smoothedLat: number,
  smoothedLng: number,
  previous: BackendUpdateState | null
): BackendUpdateState {
  return {
    lat: smoothedLat,
    lng: smoothedLng,
    lastRawLat: newLat,
    lastRawLng: newLng,
    lastUpdateTime: Date.now(),
  };
}
