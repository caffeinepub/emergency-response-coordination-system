import { useState, useEffect, useRef, useMemo } from 'react';
import { useGetAllAmbulanceLocations, useGetActiveSOSAlerts, useUpdatePoliceLocation, useGetUserProfile } from '../hooks/useQueries';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { MapPin, Loader2, AlertCircle, Radio, Navigation, Volume2, VolumeX, Phone, Filter } from 'lucide-react';
import RealtimeMap, { MapMarker } from '../components/RealtimeMap';
import type { Coordinates, AmbulanceLocation, SOSAlert, UserProfile } from '../backend';
import { LOCATION_UPDATE_INTERVAL, POLICE_RADIUS_KM, formatDistance, formatRadius } from '../utils/locationRefresh';
import { buildDirectionsUrl } from '../utils/mapsDirections';
import { Principal } from '@dfinity/principal';

const LOCATION_TIMEOUT_SECONDS = 15; // Consider ambulance offline if no update in 15 seconds

export default function PoliceInterface() {
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [previousAlertIds, setPreviousAlertIds] = useState<Set<string>>(new Set());
  const [audioAvailable, setAudioAvailable] = useState(true);
  const [showOfflineAmbulances, setShowOfflineAmbulances] = useState(true);
  const [applyRadiusFilter, setApplyRadiusFilter] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const locationUpdateTimerRef = useRef<number | null>(null);

  // Fetch ALL ambulance locations (not radius-limited)
  const { data: ambulancesRaw = [], isLoading: ambulancesLoading, isFetching: ambulancesFetching } = useGetAllAmbulanceLocations();
  const { data: sosAlerts = [] } = useGetActiveSOSAlerts();
  const updatePoliceLocation = useUpdatePoliceLocation();

  // Compute offline status and apply filters
  const ambulancesWithStatus = useMemo(() => {
    const now = Date.now();
    return ambulancesRaw.map((ambulance) => {
      const timestamp = Number(ambulance.timestamp) / 1_000_000; // Convert nanoseconds to milliseconds
      const ageSeconds = (now - timestamp) / 1000;
      const isOffline = ageSeconds > LOCATION_TIMEOUT_SECONDS;
      
      // Calculate distance if police location is available
      let distance = 0;
      if (location) {
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
        distance = R * c;
      }

      return {
        ...ambulance,
        isOffline,
        ageSeconds,
        distance,
      };
    });
  }, [ambulancesRaw, location]);

  // Apply view filters
  const filteredAmbulances = useMemo(() => {
    let filtered = ambulancesWithStatus;

    // Filter offline ambulances if toggle is off
    if (!showOfflineAmbulances) {
      filtered = filtered.filter(a => !a.isOffline);
    }

    // Apply radius filter if enabled and location is available
    if (applyRadiusFilter && location) {
      filtered = filtered.filter(a => a.distance <= POLICE_RADIUS_KM);
    }

    return filtered;
  }, [ambulancesWithStatus, showOfflineAmbulances, applyRadiusFilter, location]);

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

  // Add ambulance markers (use filteredAmbulances for map display)
  filteredAmbulances.forEach((ambulance) => {
    const offlineLabel = ambulance.isOffline ? ' [OFFLINE]' : '';
    const label = `Ambulance (${formatDistance(ambulance.distance)} away)${offlineLabel}`;
    
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

            {/* View Filters */}
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold">View Filters</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="show-offline" className="text-sm cursor-pointer">
                    Show offline ambulances
                  </Label>
                  <Switch
                    id="show-offline"
                    checked={showOfflineAmbulances}
                    onCheckedChange={setShowOfflineAmbulances}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="radius-filter" className="text-sm cursor-pointer">
                    Only show within {formatRadius(POLICE_RADIUS_KM)}
                  </Label>
                  <Switch
                    id="radius-filter"
                    checked={applyRadiusFilter}
                    onCheckedChange={setApplyRadiusFilter}
                  />
                </div>
              </div>
            </div>

            {/* Real-time Tactical Map */}
            {location && !locationError && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Tactical Map</h3>
                  <Badge variant="outline" className="gap-1">
                    <Radio className="h-3 w-3 animate-pulse text-emergency-blue" />
                    {filteredAmbulances.length} {filteredAmbulances.length === 1 ? 'Ambulance' : 'Ambulances'}
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

            {/* Ambulances List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">
                  Ambulances
                  {applyRadiusFilter && ` (within ${formatRadius(POLICE_RADIUS_KM)})`}
                </h3>
                {ambulancesFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>

              {ambulancesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredAmbulances.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    {ambulancesWithStatus.length === 0 
                      ? 'No ambulances detected'
                      : !showOfflineAmbulances && ambulancesWithStatus.every(a => a.isOffline)
                      ? 'All ambulances are offline. Enable "Show offline ambulances" to see them.'
                      : applyRadiusFilter
                      ? `No ambulances within ${formatRadius(POLICE_RADIUS_KM)}. Disable radius filter to see all ambulances.`
                      : 'No ambulances match current filters'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredAmbulances.map((ambulance) => (
                    <AmbulanceListItem
                      key={ambulance.ambulanceId.toString()}
                      ambulance={ambulance}
                      sosAlerts={sosAlerts}
                      policeLocation={location}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Instructions */}
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="mb-2 font-semibold">Command Center Features</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-emergency-blue">•</span>
                  <span>Real-time tracking of all ambulances in the system</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emergency-blue">•</span>
                  <span>Direct call buttons for ambulances with valid phone numbers</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emergency-blue">•</span>
                  <span>Get turn-by-turn directions to any ambulance location</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emergency-blue">•</span>
                  <span>Instant audio alerts for SOS emergencies</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emergency-blue">•</span>
                  <span>Filter view by radius or offline status</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Separate component for ambulance list items with profile fetching
function AmbulanceListItem({
  ambulance,
  sosAlerts,
  policeLocation,
}: {
  ambulance: AmbulanceLocation & { isOffline: boolean; ageSeconds: number; distance: number };
  sosAlerts: SOSAlert[];
  policeLocation: Coordinates | null;
}) {
  // Fetch user profile for this specific ambulance
  const ambulancePrincipal = Principal.fromText(ambulance.ambulanceId.toString());
  const { data: profile } = useGetUserProfile(ambulancePrincipal);

  const hasSOSAlert = sosAlerts.some(
    alert => alert.ambulanceId.toString() === ambulance.ambulanceId.toString()
  );

  const contactName = profile?.name || 'Unknown';
  const contactPhone = profile?.phoneNumber || 'Unknown';
  const hasValidPhone = isValidPhoneNumber(contactPhone);

  return (
    <div
      className={`rounded-lg border p-4 ${
        hasSOSAlert
          ? 'border-destructive bg-destructive/5'
          : ambulance.isOffline
          ? 'border-muted bg-muted/30'
          : 'border-border bg-card'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1">
          <img
            src="/assets/generated/ambulance-icon.dim_64x64.png"
            alt=""
            className={`h-10 w-10 ${ambulance.isOffline ? 'opacity-50' : ''}`}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold">
                {contactName !== 'Unknown' ? contactName : `Ambulance ${ambulance.ambulanceId.toString().slice(0, 8)}...`}
              </p>
              {hasSOSAlert && (
                <Badge variant="destructive" className="animate-pulse">
                  🚨 SOS
                </Badge>
              )}
              {ambulance.isOffline && (
                <Badge variant="outline" className="text-muted-foreground">
                  Offline
                </Badge>
              )}
            </div>
            <div className="mt-1 space-y-1 text-sm text-muted-foreground">
              <p>
                <span className="font-medium">Phone:</span>{' '}
                {hasValidPhone ? contactPhone : (
                  <span className="text-destructive">No phone number on file</span>
                )}
              </p>
              <p>
                <span className="font-medium">Location:</span>{' '}
                {ambulance.coordinates.latitude.toFixed(6)}, {ambulance.coordinates.longitude.toFixed(6)}
              </p>
              <p>
                <span className="font-medium">Distance:</span> {formatDistance(ambulance.distance)}
              </p>
              <p className="text-xs">
                Last update: {Math.floor(ambulance.ageSeconds)}s ago
                {ambulance.isOffline && ' (offline)'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 flex-shrink-0">
          {hasValidPhone ? (
            <Button
              asChild
              size="sm"
              className="bg-emergency-blue hover:bg-emergency-blue/90"
            >
              <a href={`tel:${contactPhone}`}>
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
          <Button
            asChild
            size="sm"
            variant="outline"
          >
            <a
              href={buildDirectionsUrl(ambulance.coordinates, policeLocation)}
              target="_blank"
              rel="noopener noreferrer"
              title="Get directions to ambulance location"
            >
              <Navigation className="mr-2 h-4 w-4" />
              Directions
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}

// Helper function to check if phone number is valid
function isValidPhoneNumber(phoneNumber: string): boolean {
  return /^\d{10}$/.test(phoneNumber);
}
