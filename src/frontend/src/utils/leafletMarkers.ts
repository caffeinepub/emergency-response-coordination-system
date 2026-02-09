/**
 * Leaflet marker utilities for building and updating map markers.
 * UI-library-agnostic helpers for consistent marker management.
 */

/**
 * Marker type definitions
 */
export type MarkerType = 'ambulance' | 'police' | 'sos';

/**
 * Icon configuration for each marker type
 */
interface IconConfig {
  html: string;
  size: [number, number];
  anchor: [number, number];
}

/**
 * Build icon HTML and configuration for a marker type
 */
export function buildMarkerIcon(type: MarkerType, label?: string): IconConfig {
  switch (type) {
    case 'ambulance':
      return {
        html: '<img src="/assets/generated/ambulance-marker.dim_32x32.png" alt="Ambulance" style="width: 32px; height: 32px;" />',
        size: [32, 32],
        anchor: [16, 32],
      };
    case 'police':
      return {
        html: '<img src="/assets/generated/police-badge.dim_64x64.png" alt="Police" style="width: 40px; height: 40px;" />',
        size: [40, 40],
        anchor: [20, 40],
      };
    case 'sos':
      return {
        html: '<div style="position: relative; width: 48px; height: 48px;"><img src="/assets/generated/alert-icon.dim_48x48.png" alt="SOS" style="width: 48px; height: 48px; animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;" /></div>',
        size: [48, 48],
        anchor: [24, 48],
      };
  }
}

/**
 * Create a Leaflet divIcon from marker type
 */
export function createLeafletIcon(L: any, type: MarkerType, label?: string): any {
  const config = buildMarkerIcon(type, label);
  return L.divIcon({
    html: config.html,
    iconSize: config.size,
    iconAnchor: config.anchor,
    className: 'custom-marker-icon',
  });
}

/**
 * Check if marker properties have changed (requires icon update)
 */
export function hasMarkerChanged(
  oldType: MarkerType,
  newType: MarkerType,
  oldLabel?: string,
  newLabel?: string
): boolean {
  return oldType !== newType || oldLabel !== newLabel;
}
