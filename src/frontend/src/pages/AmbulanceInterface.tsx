import { useState, useEffect, useRef } from 'react';
import { useTriggerSOS, useDeactivateSOS, useUpdateAmbulanceLocation, useGetMySOSAlert } from '../hooks/useQueries';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { AlertCircle, MapPin, Loader2, CheckCircle, Navigation, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '../components/ui/alert';
import RealtimeMap, { MapMarker } from '../components/RealtimeMap';
import type { Coordinates } from '../backend';
import { LOCATION_UPDATE_INTERVAL, POLICE_RADIUS_KM, formatRadius } from '../utils/locationRefresh';
import { processBackendUpdate, updateBackendState, BackendUpdateState, GPS_CONFIG } from '../utils/locationSmoothing';

const SOS_DURATION = 60000; // 60 seconds

export default function AmbulanceInterface() {
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [displayLocation, setDisplayLocation] = useState<Coordinates | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [gpsStatus, setGpsStatus] = useState<string>('Acquiring GPS...');
  const [sosActive, setSosActive] = useState(false);
  const [sosTimer, setSosTimer] = useState<number | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const locationUpdateTimerRef = useRef<number | null>(null);
  const backendStateRef = useRef<BackendUpdateState | null>(null);
  const lastRawPositionRef = useRef<{ lat: number; lng: number } | null>(null);

  const triggerSOS = useTriggerSOS();
  const deactivateSOS = useDeactivateSOS();
  const updateLocation = useUpdateAmbulanceLocation();
  const { data: mySOSAlert } = useGetMySOSAlert();

  // Get user's location continuously with accuracy filtering
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      setGpsStatus('Not supported');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const newLat = position.coords.latitude;
        const newLng = position.coords.longitude;
        const accuracy = position.coords.accuracy;

        // Always update display location for map (will be smoothed by map component)
        const displayCoords: Coordinates = {
          latitude: newLat,
          longitude: newLng,
        };
        setDisplayLocation(displayCoords);
        lastRawPositionRef.current = { lat: newLat, lng: newLng };

        // Process for backend updates with filtering and smoothing
        const result = processBackendUpdate(
          newLat,
          newLng,
          accuracy,
          backendStateRef.current
        );

        if (result === null) {
          // Fix rejected due to poor accuracy or outlier
          if (accuracy !== undefined && accuracy > GPS_CONFIG.MAX_ACCURACY_METERS) {
            setGpsStatus(`GPS accuracy poor (±${Math.round(accuracy)}m)`);
          } else {
            setGpsStatus('Filtering GPS outlier...');
          }
          setLocationError(null);
          return;
        }

        // Update backend state
        backendStateRef.current = updateBackendState(
          newLat,
          newLng,
          result.coords.latitude,
          result.coords.longitude,
          backendStateRef.current
        );

        // Update location for backend updates
        setLocation(result.coords);
        setLocationError(null);
        
        // Update status
        if (accuracy !== undefined) {
          setGpsStatus(`GPS active (±${Math.round(accuracy)}m)`);
        } else {
          setGpsStatus('GPS active');
        }
      },
      (error) => {
        setLocationError(error.message);
        setGpsStatus('GPS error');
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Send location updates to backend every 12 seconds
  useEffect(() => {
    if (!location) return;

    // Send initial update immediately
    updateLocation.mutate(location);
    setLastUpdateTime(new Date());

    // Set up interval for continuous updates
    locationUpdateTimerRef.current = window.setInterval(() => {
      if (location) {
        updateLocation.mutate(location);
        setLastUpdateTime(new Date());
      }
    }, LOCATION_UPDATE_INTERVAL);

    return () => {
      if (locationUpdateTimerRef.current) {
        clearInterval(locationUpdateTimerRef.current);
      }
    };
  }, [location?.latitude, location?.longitude]);

  // Sync SOS state with backend
  useEffect(() => {
    if (mySOSAlert?.active) {
      setSosActive(true);
    } else if (sosActive && mySOSAlert && !mySOSAlert.active) {
      setSosActive(false);
      if (sosTimer) {
        clearTimeout(sosTimer);
        setSosTimer(null);
      }
    }
  }, [mySOSAlert]);

  const handleSOSClick = async () => {
    if (!location) {
      alert('Location not available. Please enable location services.');
      return;
    }

    if (sosActive) {
      // Deactivate SOS
      try {
        await deactivateSOS.mutateAsync();
        setSosActive(false);
        if (sosTimer) {
          clearTimeout(sosTimer);
          setSosTimer(null);
        }
      } catch (error) {
        console.error('Failed to deactivate SOS:', error);
      }
    } else {
      // Trigger SOS
      try {
        await triggerSOS.mutateAsync(location);
        setSosActive(true);

        // Auto-deactivate after duration
        const timer = window.setTimeout(async () => {
          try {
            await deactivateSOS.mutateAsync();
            setSosActive(false);
            setSosTimer(null);
          } catch (error) {
            console.error('Failed to auto-deactivate SOS:', error);
          }
        }, SOS_DURATION);

        setSosTimer(timer);
      } catch (error) {
        console.error('Failed to trigger SOS:', error);
      }
    }
  };

  // Prepare map markers (use display location for smooth rendering)
  const mapMarkers: MapMarker[] = displayLocation
    ? [
        {
          id: 'ambulance',
          lat: displayLocation.latitude,
          lng: displayLocation.longitude,
          type: 'ambulance',
          label: 'Your Location (Ambulance)',
        },
      ]
    : [];

  const showPoorAccuracyWarning = gpsStatus.includes('poor') || gpsStatus.includes('outlier');

  return (
    <div className="container mx-auto min-h-[calc(100vh-8rem)] px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <img src="/assets/generated/ambulance-icon.dim_64x64.png" alt="" className="h-8 w-8" />
              Ambulance Control Panel
            </CardTitle>
            <CardDescription>Emergency SOS and continuous location sharing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Real-time Map */}
            {displayLocation && !locationError && (
              <div className="space-y-2">
                <h3 className="font-semibold">Live Location Map</h3>
                <RealtimeMap
                  center={{ lat: displayLocation.latitude, lng: displayLocation.longitude }}
                  markers={mapMarkers}
                  zoom={16}
                  className="h-[400px]"
                />
              </div>
            )}

            {/* Location Status */}
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-emergency-blue" />
                <div className="flex-1">
                  <h3 className="font-semibold">Location Status</h3>
                  {locationError ? (
                    <p className="text-sm text-destructive">{locationError}</p>
                  ) : location ? (
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="space-y-1">
                        <p>Latitude: {location.latitude.toFixed(6)}</p>
                        <p>Longitude: {location.longitude.toFixed(6)}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="gap-1">
                          <Navigation className="h-3 w-3 animate-pulse text-emergency-blue" />
                          Live Tracking Active
                        </Badge>
                        {lastUpdateTime && (
                          <span className="text-xs text-muted-foreground">
                            Updated {Math.floor((Date.now() - lastUpdateTime.getTime()) / 1000)}s ago
                          </span>
                        )}
                        <Badge variant={showPoorAccuracyWarning ? "destructive" : "outline"} className="gap-1">
                          {gpsStatus}
                        </Badge>
                      </div>
                      {showPoorAccuracyWarning && (
                        <div className="flex items-start gap-2 rounded-md bg-yellow-500/10 p-2 text-xs text-yellow-700 dark:text-yellow-400">
                          <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                          <span>
                            GPS accuracy is currently poor. Updates are being filtered to ensure stable tracking.
                            Move to an area with better sky visibility for improved accuracy.
                          </span>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Location updates every {LOCATION_UPDATE_INTERVAL / 1000} seconds with outlier filtering and smoothing
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Acquiring GPS location...
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* SOS Button */}
            <div className="flex flex-col items-center gap-4 py-8">
              <button
                onClick={handleSOSClick}
                disabled={!location || triggerSOS.isPending || deactivateSOS.isPending}
                className={`group relative h-48 w-48 rounded-full transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${
                  sosActive
                    ? 'animate-pulse bg-gradient-to-br from-destructive to-destructive/80 shadow-2xl shadow-destructive/50'
                    : 'bg-gradient-to-br from-emergency-red to-red-600 shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95'
                }`}
              >
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <img
                    src="/assets/generated/sos-button.dim_200x200.png"
                    alt="SOS"
                    className="h-24 w-24 drop-shadow-lg"
                  />
                  <span className="mt-2 text-2xl font-bold text-white drop-shadow-md">
                    {sosActive ? 'ACTIVE' : 'SOS'}
                  </span>
                </div>
              </button>

              {sosActive && (
                <Alert className="border-destructive bg-destructive/10">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <AlertDescription className="font-semibold text-destructive">
                    SOS Alert Active - Nearest 2 police units within {formatRadius(POLICE_RADIUS_KM)} have been notified
                  </AlertDescription>
                </Alert>
              )}

              <p className="text-center text-sm text-muted-foreground">
                {sosActive
                  ? 'Tap again to deactivate the SOS alert'
                  : 'Tap the button to send an emergency SOS alert to the nearest 2 police units'}
              </p>
            </div>

            {/* Instructions */}
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="mb-2 font-semibold">How it works</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="text-emergency-blue">•</span>
                  Your GPS location is continuously tracked and shared with police units every {LOCATION_UPDATE_INTERVAL / 1000} seconds
                </li>
                <li className="flex gap-2">
                  <span className="text-emergency-blue">•</span>
                  GPS outliers and poor-accuracy fixes are automatically filtered for stable tracking
                </li>
                <li className="flex gap-2">
                  <span className="text-emergency-blue">•</span>
                  Press SOS to send an emergency alert with your current location
                </li>
                <li className="flex gap-2">
                  <span className="text-emergency-blue">•</span>
                  The alert remains active for 60 seconds or until manually deactivated
                </li>
                <li className="flex gap-2">
                  <span className="text-emergency-blue">•</span>
                  Nearest 2 police units within {formatRadius(POLICE_RADIUS_KM)} will receive immediate notification
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
