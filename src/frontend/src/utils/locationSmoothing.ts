/**
 * Client-side location smoothing utilities to reduce GPS jitter on map display.
 * These functions only affect UI rendering, not backend-stored coordinates.
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
 * Threshold for micro-movement filtering (in meters)
 * Movements smaller than this are considered GPS jitter
 */
export const MOVEMENT_THRESHOLD_METERS = 5;

/**
 * Low-pass filter alpha value for coordinate smoothing
 * Lower values = more smoothing, higher values = more responsive
 */
export const SMOOTHING_ALPHA = 0.3;

/**
 * Smoothed coordinate state for a single marker
 */
export interface SmoothedCoordinate {
  lat: number;
  lng: number;
  lastRawLat: number;
  lastRawLng: number;
}

/**
 * Apply low-pass filter smoothing to coordinates
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
  if (distanceMeters < MOVEMENT_THRESHOLD_METERS) {
    return {
      ...previous,
      lastRawLat: newLat,
      lastRawLng: newLng,
    };
  }

  // Significant movement detected - apply low-pass filter
  const smoothedLat = previous.lat + SMOOTHING_ALPHA * (newLat - previous.lat);
  const smoothedLng = previous.lng + SMOOTHING_ALPHA * (newLng - previous.lng);

  return {
    lat: smoothedLat,
    lng: smoothedLng,
    lastRawLat: newLat,
    lastRawLng: newLng,
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
  return distanceMeters >= MOVEMENT_THRESHOLD_METERS;
}
