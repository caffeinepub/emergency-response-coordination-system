/**
 * Builds a Google Maps directions URL for navigation
 * @param destination - The destination coordinates
 * @param origin - Optional origin coordinates (if not provided, uses user's current location)
 * @returns A URL string suitable for opening in a new tab
 */
export function buildDirectionsUrl(
  destination: { latitude: number; longitude: number },
  origin?: { latitude: number; longitude: number } | null
): string {
  const destParam = `${destination.latitude},${destination.longitude}`;
  
  if (origin) {
    const originParam = `${origin.latitude},${origin.longitude}`;
    return `https://www.google.com/maps/dir/?api=1&origin=${originParam}&destination=${destParam}&travelmode=driving`;
  }
  
  // If no origin provided, Google Maps will use the user's current location
  return `https://www.google.com/maps/dir/?api=1&destination=${destParam}&travelmode=driving`;
}
