// Shared constants for coordinate refresh timing and police radius
export const LOCATION_UPDATE_INTERVAL = 12000; // 12 seconds
export const POLICE_RADIUS_KM = 0.05; // 50 meters (0.05 km)

/**
 * Format radius for display, showing meters for sub-1km values
 */
export function formatRadius(radiusKm: number): string {
  if (radiusKm < 1) {
    return `${Math.round(radiusKm * 1000)}m`;
  }
  return `${radiusKm.toFixed(2)}km`;
}

/**
 * Format distance for display, showing meters for sub-1km values
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)}m`;
  }
  return `${distanceKm.toFixed(2)}km`;
}
