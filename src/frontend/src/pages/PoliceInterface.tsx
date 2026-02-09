import { useState, useEffect, useRef } from 'react';
import { useGetLocationsInRadius, useGetActiveSOSAlerts, useUpdatePoliceLocation, useGetAmbulanceContactsInRadius } from '../hooks/useQueries';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { MapPin, Loader2, AlertCircle, Radio, Navigation, Volume2, VolumeX, Phone } from 'lucide-react';
import RealtimeMap, { MapMarker } from '../components/RealtimeMap';
import type { Coordinates, AmbulanceLocation, SOSAlert } from '../backend';
import { LOCATION_UPDATE_INTERVAL, POLICE_RADIUS_KM, formatDistance, formatRadius } from '../utils/locationRefresh';

const LOCATION_TIMEOUT_SECONDS = 15; // Consider ambulance offline if no update in 15 seconds

export default function PoliceInterface() {
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [previousAlertIds, setPreviousAlertIds] = useState<Set<string>>(new Set());
  const [audioAvailable, setAudioAvailable] = useState(true);
  const audioContextRef = useRef<AudioContext | null>(null);
  const locationUpdateTimerRef = useRef<number | null>(null);

  const { data: ambulancesRaw = [], isLoading: ambulancesLoading, isFetching: ambulancesFetching } = useGetLocationsInRadius(location, POLICE_RADIUS_KM);
  const { data: ambulanceContacts = [] } = useGetAmbulanceContactsInRadius(location, POLICE_RADIUS_KM);
  const { data: sosAlerts = [] } = useGetActiveSOSAlerts();
  const updatePoliceLocation = useUpdatePoliceLocation();

  // Filter out stale ambulance locations (no update in 15 seconds)
  const ambulances = ambulancesRaw.filter((ambulance) => {
    const now = Date.now();
    const timestamp = Number(ambulance.timestamp) / 1_000_000; // Convert nanoseconds to milliseconds
    const ageSeconds = (now - timestamp) / 1000;
    return ageSeconds <= LOCATION_TIMEOUT_SECONDS;
  });

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
    updatePoliceLocation.mutate(location);

    // Set up interval for continuous updates
    locationUpdateTimerRef.current = window.setInterval(() => {
      if (location) {
        updatePoliceLocation.mutate(location);
      }
    }, LOCATION_UPDATE_INTERVAL);

    return () => {
      if (locationUpdateTimerRef.current) {
        clearInterval(locationUpdateTimerRef.current);
      }
    };
  }, [location?.latitude, location?.longitude]);

  // Play alert sound for new SOS alerts
  useEffect(() => {
    if (!audioAvailable) return;

    const currentAlertIds = new Set(sosAlerts.map(alert => alert.ambulanceId.toString()));
    const newAlerts = sosAlerts.filter(
      alert => !previousAlertIds.has(alert.ambulanceId.toString())
    );

    if (newAlerts.length > 0) {
      playAlertSound();
    }

    setPreviousAlertIds(currentAlertIds);
  }, [sosAlerts, audioAvailable]);

  const playAlertSound = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const context = audioContextRef.current;
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(context.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, context.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.5);

      oscillator.start(context.currentTime);
      oscillator.stop(context.currentTime + 0.5);
    } catch (error) {
      console.error('Failed to play alert sound:', error);
      setAudioAvailable(false);
    }
  };

  const toggleAudio = () => {
    setAudioAvailable(!audioAvailable);
  };

  // Calculate distance from police location to ambulance
  const calculateDistance = (ambulance: AmbulanceLocation): number => {
    if (!location) return 0;

    const R = 6371; // Earth's radius in km
    const dLat = ((ambulance.coordinates.latitude - location.latitude) * Math.PI) / 180;
    const dLon = ((ambulance.coordinates.longitude - location.longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((location.latitude * Math.PI) / 180) *
        Math.cos((ambulance.coordinates.latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Get contact info for an ambulance by index
  const getContactInfo = (index: number) => {
    return ambulanceContacts[index] || { name: 'Unknown', phoneNumber: 'Unknown' };
  };

  // Check if phone number is valid (exactly 10 digits)
  const isValidPhoneNumber = (phoneNumber: string): boolean => {
    return /^\d{10}$/.test(phoneNumber);
  };

  // Prepare map markers
  const mapMarkers: MapMarker[] = [];

  // Add police location marker
  if (location) {
    mapMarkers.push({
      id: 'police',
      lat: location.latitude,
      lng: location.longitude,
      type: 'police',
      label: 'Your Location (Police)',
    });
  }

  // Add ambulance markers with contact info
  ambulances.forEach((ambulance, index) => {
    const distance = calculateDistance(ambulance);
    const contact = getContactInfo(index);
    const label = contact.name !== 'Unknown' 
      ? `${contact.name} (${formatDistance(distance)} away)${contact.phoneNumber !== 'Unknown' ? ` - ${contact.phoneNumber}` : ''}`
      : `Ambulance (${formatDistance(distance)} away)`;
    
    mapMarkers.push({
      id: ambulance.ambulanceId.toString(),
      lat: ambulance.coordinates.latitude,
      lng: ambulance.coordinates.longitude,
      type: 'ambulance',
      label,
    });
  });

  // Add SOS alert markers
  sosAlerts.forEach((alert) => {
    mapMarkers.push({
      id: `sos-${alert.ambulanceId.toString()}`,
      lat: alert.coordinates.latitude,
      lng: alert.coordinates.longitude,
      type: 'sos',
      label: `🚨 SOS ALERT - Ambulance needs assistance!`,
    });
  });

  return (
    <div className="container mx-auto min-h-[calc(100vh-8rem)] px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <img src="/assets/generated/police-badge.dim_64x64.png" alt="" className="h-8 w-8" />
                  Police Command Center
                </CardTitle>
                <CardDescription>Real-time ambulance tracking and emergency response</CardDescription>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={toggleAudio}
                title={audioAvailable ? 'Mute alerts' : 'Unmute alerts'}
              >
                {audioAvailable ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Active SOS Alerts */}
            {sosAlerts.length > 0 && (
              <Alert className="border-destructive bg-destructive/10">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <AlertTitle className="text-destructive">🚨 Active SOS Alerts ({sosAlerts.length})</AlertTitle>
                <AlertDescription>
                  <div className="mt-2 space-y-2">
                    {sosAlerts.map((alert) => (
                      <div key={alert.ambulanceId.toString()} className="rounded-md bg-background p-2 text-sm">
                        <p className="font-semibold">Ambulance ID: {alert.ambulanceId.toString().slice(0, 8)}...</p>
                        <p className="text-muted-foreground">
                          Location: {alert.coordinates.latitude.toFixed(6)}, {alert.coordinates.longitude.toFixed(6)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(Number(alert.timestamp) / 1_000_000).toLocaleTimeString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Real-time Tactical Map */}
            {location && !locationError && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Tactical Map</h3>
                  <Badge variant="outline" className="gap-1">
                    <Radio className="h-3 w-3 animate-pulse text-emergency-blue" />
                    {ambulances.length} Active {ambulances.length === 1 ? 'Ambulance' : 'Ambulances'}
                  </Badge>
                </div>
                <RealtimeMap
                  center={{ lat: location.latitude, lng: location.longitude }}
                  markers={mapMarkers}
                  zoom={15}
                  className="h-[500px]"
                />
              </div>
            )}

            {/* Location Status */}
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-emergency-blue" />
                <div className="flex-1">
                  <h3 className="font-semibold">Your Location</h3>
                  {locationError ? (
                    <p className="text-sm text-destructive">{locationError}</p>
                  ) : location ? (
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="space-y-1">
                        <p>Latitude: {location.latitude.toFixed(6)}</p>
                        <p>Longitude: {location.longitude.toFixed(6)}</p>
                      </div>
                      <Badge variant="outline" className="gap-1">
                        <Navigation className="h-3 w-3 animate-pulse text-emergency-blue" />
                        Live Tracking Active
                      </Badge>
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

            {/* Nearby Ambulances List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Nearby Ambulances (within {formatRadius(POLICE_RADIUS_KM)})</h3>
                {ambulancesFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>

              {ambulancesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : ambulances.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    No ambulances detected within {formatRadius(POLICE_RADIUS_KM)} of your location
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {ambulances.map((ambulance, index) => {
                    const distance = calculateDistance(ambulance);
                    const contact = getContactInfo(index);
                    const hasSOSAlert = sosAlerts.some(
                      alert => alert.ambulanceId.toString() === ambulance.ambulanceId.toString()
                    );
                    const hasValidPhone = isValidPhoneNumber(contact.phoneNumber);

                    return (
                      <div
                        key={ambulance.ambulanceId.toString()}
                        className={`rounded-lg border p-4 ${
                          hasSOSAlert
                            ? 'border-destructive bg-destructive/5'
                            : 'border-border bg-card'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1">
                            <img
                              src="/assets/generated/ambulance-icon.dim_64x64.png"
                              alt=""
                              className="h-10 w-10"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold">
                                  {contact.name !== 'Unknown' ? contact.name : `Ambulance ${ambulance.ambulanceId.toString().slice(0, 8)}...`}
                                </p>
                                {hasSOSAlert && (
                                  <Badge variant="destructive" className="animate-pulse">
                                    🚨 SOS
                                  </Badge>
                                )}
                              </div>
                              <div className="mt-1 space-y-1 text-sm text-muted-foreground">
                                <p>
                                  <span className="font-medium">Phone:</span>{' '}
                                  {hasValidPhone ? contact.phoneNumber : (
                                    <span className="text-destructive">No phone number on file</span>
                                  )}
                                </p>
                                <p>
                                  <span className="font-medium">Location:</span>{' '}
                                  {ambulance.coordinates.latitude.toFixed(6)}, {ambulance.coordinates.longitude.toFixed(6)}
                                </p>
                                <p>
                                  <span className="font-medium">Distance:</span> {formatDistance(distance)}
                                </p>
                                <p className="text-xs">
                                  Last update:{' '}
                                  {Math.floor(
                                    (Date.now() - Number(ambulance.timestamp) / 1_000_000) / 1000
                                  )}
                                  s ago
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            {hasValidPhone ? (
                              <Button
                                asChild
                                size="sm"
                                className="bg-emergency-blue hover:bg-emergency-blue/90"
                              >
                                <a href={`tel:${contact.phoneNumber}`}>
                                  <Phone className="mr-2 h-4 w-4" />
                                  Call
                                </a>
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                disabled
                                variant="outline"
                                title="No phone number available"
                              >
                                <Phone className="mr-2 h-4 w-4" />
                                Call
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Instructions */}
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="mb-2 font-semibold">Command Center Features</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="text-emergency-blue">•</span>
                  Real-time tracking of all ambulances within {formatRadius(POLICE_RADIUS_KM)} radius
                </li>
                <li className="flex gap-2">
                  <span className="text-emergency-blue">•</span>
                  View ambulance crew contact information and direct call capability
                </li>
                <li className="flex gap-2">
                  <span className="text-emergency-blue">•</span>
                  Instant SOS alert notifications with audio alerts
                </li>
                <li className="flex gap-2">
                  <span className="text-emergency-blue">•</span>
                  Live tactical map showing all units and emergency situations
                </li>
                <li className="flex gap-2">
                  <span className="text-emergency-blue">•</span>
                  Location updates refresh every {LOCATION_UPDATE_INTERVAL / 1000} seconds
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
