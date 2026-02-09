import { useEffect, useRef, useState } from 'react';
import { Alert, AlertDescription } from './ui/alert';
import { AlertCircle } from 'lucide-react';

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

export default function RealtimeMap({ center, markers, zoom = 15, className = '' }: RealtimeMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

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
        setIsMapReady(false);
      }
    };
  }, []);

  // Update map center when it changes
  useEffect(() => {
    if (mapInstanceRef.current && isMapReady) {
      mapInstanceRef.current.setView([center.lat, center.lng], zoom);
    }
  }, [center.lat, center.lng, zoom, isMapReady]);

  // Update markers when they change
  useEffect(() => {
    if (!markersLayerRef.current || !isMapReady || !window.L) return;

    // Clear existing markers
    markersLayerRef.current.clearLayers();

    // Add new markers
    markers.forEach((marker) => {
      let iconHtml = '';
      let iconSize: [number, number] = [32, 32];
      let iconAnchor: [number, number] = [16, 32];

      switch (marker.type) {
        case 'ambulance':
          iconHtml = `<img src="/assets/generated/ambulance-marker.dim_32x32.png" alt="Ambulance" style="width: 32px; height: 32px;" />`;
          break;
        case 'police':
          iconHtml = `<img src="/assets/generated/police-badge.dim_64x64.png" alt="Police" style="width: 40px; height: 40px;" />`;
          iconSize = [40, 40];
          iconAnchor = [20, 40];
          break;
        case 'sos':
          iconHtml = `<div style="position: relative; width: 48px; height: 48px;">
            <img src="/assets/generated/alert-icon.dim_48x48.png" alt="SOS" style="width: 48px; height: 48px; animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;" />
          </div>`;
          iconSize = [48, 48];
          iconAnchor = [24, 48];
          break;
      }

      const customIcon = window.L.divIcon({
        html: iconHtml,
        iconSize: iconSize,
        iconAnchor: iconAnchor,
        className: 'custom-marker-icon',
      });

      const leafletMarker = window.L.marker([marker.lat, marker.lng], { icon: customIcon });

      if (marker.label) {
        leafletMarker.bindPopup(marker.label);
      }

      leafletMarker.addTo(markersLayerRef.current);
    });

    // Auto-fit bounds if there are multiple markers
    if (markers.length > 1) {
      const bounds = window.L.latLngBounds(markers.map(m => [m.lat, m.lng]));
      mapInstanceRef.current?.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
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
