import { useState, useEffect, useRef } from 'react';
import { useTriggerSOS, useDeactivateSOS, useUpdateAmbulanceLocation, useGetMySOSAlert } from '../hooks/useQueries';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { AlertCircle, MapPin, Loader2, CheckCircle, Navigation } from 'lucide-react';
import { Alert, AlertDescription } from '../components/ui/alert';
import type { Coordinates } from '../backend';

const SOS_DURATION = 60000; // 60 seconds
const LOCATION_UPDATE_INTERVAL = 12000; // 12 seconds

export default function AmbulanceInterface() {
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [sosActive, setSosActive] = useState(false);
  const [sosTimer, setSosTimer] = useState<number | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const locationUpdateTimerRef = useRef<number | null>(null);

  const triggerSOS = useTriggerSOS();
  const deactivateSOS = useDeactivateSOS();
  const updateLocation = useUpdateAmbulanceLocation();
  const { data: mySOSAlert } = useGetMySOSAlert();

  // Get user's location continuously
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const coords: Coordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setLocation(coords);
        setLocationError(null);
      },
      (error) => {
        setLocationError(error.message);
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

  return (
    <div className="container mx-auto min-h-[calc(100vh-8rem)] px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <img src="/assets/generated/ambulance-icon.dim_64x64.png" alt="" className="h-8 w-8" />
              Ambulance Control Panel
            </CardTitle>
            <CardDescription>Emergency SOS and continuous location sharing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
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
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="gap-1">
                          <Navigation className="h-3 w-3 animate-pulse text-emergency-blue" />
                          Live Tracking Active
                        </Badge>
                        {lastUpdateTime && (
                          <span className="text-xs text-muted-foreground">
                            Updated {Math.floor((Date.now() - lastUpdateTime.getTime()) / 1000)}s ago
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Location updates every {LOCATION_UPDATE_INTERVAL / 1000} seconds
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
                    SOS Alert Active - Nearest 2 police units within 30 meters have been notified
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
                  Your GPS location is continuously tracked and shared with police units every 12 seconds
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
                  Nearest 2 police units within 30 meters will receive immediate notification
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
