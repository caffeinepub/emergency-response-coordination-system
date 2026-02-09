import { useEffect, useRef, useState } from 'react';
import { Alert, AlertDescription } from './ui/alert';
import { AlertCircle } from 'lucide-react';
import { smoothCoordinate, shouldUpdateCenter, SmoothedCoordinate } from '../utils/locationSmoothing';
import { createLeafletIcon, hasMarkerChanged, MarkerType } from '../utils/leafletMarkers';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  type: 'ambulance' | 'police' | 'sos';
  label?: string;
}

interface RealtimeMapProps {
  center: { lat: number; lng: number };
  markers: MapMarker[];
  zoom?: number;
  className?: string;
}

/**
 * Persistent marker state for in-place updates
 */
interface MarkerState {
  leafletMarker: any;
  type: MarkerType;
  label?: string;
}

export default function RealtimeMap({ center, markers, zoom = 15, className = '' }: RealtimeMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  // Persistent marker registry for in-place updates
  const markerRegistryRef = useRef<Map<string, MarkerState>>(new Map());
  
  // Smoothing state per marker
  const smoothingStateRef = useRef<Map<string, SmoothedCoordinate>>(new Map());
  
  // Track current center to avoid unnecessary panning
  const currentCenterRef = useRef<{ lat: number; lng: number } | null>(null);
  
  // Track marker IDs to detect composition changes
  const previousMarkerIdsRef = useRef<Set<string>>(new Set());

  // Initialize map once
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current || !window.L) {
      return;
    }

    try {
      // Create map instance
      const map = window.L.map(mapContainerRef.current, {
        center: [center.lat, center.lng],
        zoom: zoom,
        zoomControl: true,
      });

      // Add OpenStreetMap tiles
      const tileLayer = window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      });

      tileLayer.on('tileerror', () => {
        setMapError('Unable to load map tiles. Check your internet connection.');
      });

      tileLayer.addTo(map);

      // Create a layer group for markers
      markersLayerRef.current = window.L.layerGroup().addTo(map);

      mapInstanceRef.current = map;
      currentCenterRef.current = { lat: center.lat, lng: center.lng };
      setIsMapReady(true);
    } catch (error) {
      console.error('Failed to initialize map:', error);
      setMapError('Failed to initialize map. Please refresh the page.');
    }

    // Cleanup
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersLayerRef.current = null;
        markerRegistryRef.current.clear();
        smoothingStateRef.current.clear();
        currentCenterRef.current = null;
        previousMarkerIdsRef.current.clear();
        setIsMapReady(false);
      }
    };
  }, []);

  // Update map center when it changes (with smoothing)
  useEffect(() => {
    if (!mapInstanceRef.current || !isMapReady || !currentCenterRef.current) return;

    // Check if center update is significant enough
    if (shouldUpdateCenter(
      currentCenterRef.current.lat,
      currentCenterRef.current.lng,
      center.lat,
      center.lng
    )) {
      // Pan without changing zoom (smooth transition)
      mapInstanceRef.current.panTo([center.lat, center.lng], {
        animate: true,
        duration: 0.5,
      });
      currentCenterRef.current = { lat: center.lat, lng: center.lng };
    }
  }, [center.lat, center.lng, isMapReady]);

  // Update markers in-place when they change
  useEffect(() => {
    if (!markersLayerRef.current || !isMapReady || !window.L) return;

    const currentMarkerIds = new Set(markers.map(m => m.id));
    const registry = markerRegistryRef.current;
    const smoothingState = smoothingStateRef.current;

    // Detect if marker composition changed (add/remove)
    const previousIds = previousMarkerIdsRef.current;
    const compositionChanged = 
      currentMarkerIds.size !== previousIds.size ||
      Array.from(currentMarkerIds).some(id => !previousIds.has(id));

    // Remove markers that no longer exist
    for (const [id, state] of registry.entries()) {
      if (!currentMarkerIds.has(id)) {
        markersLayerRef.current.removeLayer(state.leafletMarker);
        registry.delete(id);
        smoothingState.delete(id);
      }
    }

    // Update or create markers
    markers.forEach((marker) => {
      const existingState = registry.get(marker.id);

      // Apply smoothing to coordinates
      const previousSmoothing = smoothingState.get(marker.id);
      const smoothed = smoothCoordinate(marker.lat, marker.lng, previousSmoothing ?? null);
      smoothingState.set(marker.id, smoothed);

      if (existingState) {
        // Update existing marker in-place
        const { leafletMarker, type: oldType, label: oldLabel } = existingState;

        // Update position with smoothed coordinates
        leafletMarker.setLatLng([smoothed.lat, smoothed.lng]);

        // Update icon if type or label changed
        if (hasMarkerChanged(oldType, marker.type, oldLabel, marker.label)) {
          const newIcon = createLeafletIcon(window.L, marker.type, marker.label);
          leafletMarker.setIcon(newIcon);
          
          // Update popup if label changed
          if (marker.label) {
            leafletMarker.bindPopup(marker.label);
          } else {
            leafletMarker.unbindPopup();
          }

          registry.set(marker.id, {
            leafletMarker,
            type: marker.type,
            label: marker.label,
          });
        }
      } else {
        // Create new marker
        const icon = createLeafletIcon(window.L, marker.type, marker.label);
        const leafletMarker = window.L.marker([smoothed.lat, smoothed.lng], { icon });

        if (marker.label) {
          leafletMarker.bindPopup(marker.label);
        }

        leafletMarker.addTo(markersLayerRef.current);
        registry.set(marker.id, {
          leafletMarker,
          type: marker.type,
          label: marker.label,
        });
      }
    });

    // Fit bounds only on initial load or composition change
    if (compositionChanged && markers.length > 1) {
      const bounds = window.L.latLngBounds(markers.map(m => [m.lat, m.lng]));
      mapInstanceRef.current?.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }

    // Update previous marker IDs
    previousMarkerIdsRef.current = currentMarkerIds;
  }, [markers, isMapReady]);

  if (!window.L) {
    return (
      <Alert className="border-destructive bg-destructive/10">
        <AlertCircle className="h-4 w-4 text-destructive" />
        <AlertDescription>
          Map library failed to load. Please refresh the page.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {mapError && (
        <Alert className="mb-4 border-destructive bg-destructive/10">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <AlertDescription>
            {mapError}{' '}
            <a
              href={`https://www.openstreetmap.org/?mlat=${center.lat}&mlon=${center.lng}#map=${zoom}/${center.lat}/${center.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              View on OpenStreetMap
            </a>
          </AlertDescription>
        </Alert>
      )}
      <div
        ref={mapContainerRef}
        className="h-full w-full rounded-lg border border-border"
        style={{ minHeight: '400px' }}
      />
      <style>{`
        .custom-marker-icon {
          background: none;
          border: none;
        }
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: .5;
          }
        }
      `}</style>
    </div>
  );
}
