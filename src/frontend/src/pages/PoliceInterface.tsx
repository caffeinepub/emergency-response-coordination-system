import { useState, useEffect, useRef } from 'react';
import { useGetAllAmbulanceLocations, useGetActiveSOSAlerts, useGetUserProfile, useUpdatePoliceLocation } from '../hooks/useQueries';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { AlertCircle, Phone, MapPin, Navigation2, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '../components/ui/alert';
import RealtimeMap, { MapMarker } from '../components/RealtimeMap';
import type { AmbulanceLocation, SOSAlert, Coordinates } from '../backend';
import { formatDistance, formatRadius, LOCATION_UPDATE_INTERVAL } from '../utils/locationRefresh';
import { buildDirectionsUrl } from '../utils/mapsDirections';
import { processBackendUpdate, updateBackendState, BackendUpdateState, GPS_CONFIG } from '../utils/locationSmoothing';

const OFFLINE_THRESHOLD_MS = 60000; // 1 minute

export default function PoliceInterface() {
  console.log('[PoliceInterface] Rendering');
  
  const [showOffline, setShowOffline] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [displayLocation, setDisplayLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<string>('Acquiring GPS...');
  const backendStateRef = useRef<BackendUpdateState | null>(null);
  const locationUpdateTimerRef = useRef<number | null>(null);

  const { data: allAmbulances = [], isLoading: ambulancesLoading } = useGetAllAmbulanceLocations();
  const { data: sosAlerts = [], isLoading: alertsLoading } = useGetActiveSOSAlerts();
  const updatePoliceLocation = useUpdatePoliceLocation();

  // Get police officer's location with GPS smoothing and accuracy filtering
  useEffect(() => {
    console.log('[PoliceInterface] Setting up geolocation watch');
    if (!navigator.geolocation) {
      console.error('[PoliceInterface] Geolocation not supported');
      setGpsStatus('Not supported');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const newLat = position.coords.latitude;
        const newLng = position.coords.longitude;
        const accuracy = position.coords.accuracy;

        console.log('[PoliceInterface] GPS position update:', { newLat, newLng, accuracy });

        // Always update display location for map
        setDisplayLocation({ lat: newLat, lng: newLng });

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

        // Update location for backend updates and distance calculations
        setUserLocation({
          lat: result.coords.latitude,
          lng: result.coords.longitude,
        });

        // Update status
        if (accuracy !== undefined) {
          setGpsStatus(`GPS active (±${Math.round(accuracy)}m)`);
        } else {
          setGpsStatus('GPS active');
        }
      },
      (error) => {
        console.error('[PoliceInterface] Geolocation error:', error);
        setGpsStatus('GPS error');
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      }
    );

    return () => {
      console.log('[PoliceInterface] Clearing geolocation watch');
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // Send police location updates to backend every 12 seconds (same as ambulance)
  useEffect(() => {
    if (!userLocation) return;

    console.log('[PoliceInterface] Setting up location update interval');
    
    // Convert to backend Coordinates format
    const coordinates: Coordinates = {
      latitude: userLocation.lat,
      longitude: userLocation.lng,
    };

    // Send initial update immediately
    updatePoliceLocation.mutate(coordinates);

    // Set up interval for continuous updates
    locationUpdateTimerRef.current = window.setInterval(() => {
      if (userLocation) {
        console.log('[PoliceInterface] Sending location update to backend');
        const coords: Coordinates = {
          latitude: userLocation.lat,
          longitude: userLocation.lng,
        };
        updatePoliceLocation.mutate(coords);
      }
    }, LOCATION_UPDATE_INTERVAL);

    return () => {
      if (locationUpdateTimerRef.current) {
        console.log('[PoliceInterface] Clearing location update interval');
        clearInterval(locationUpdateTimerRef.current);
      }
    };
  }, [userLocation?.lat, userLocation?.lng]);

  // Filter ambulances based on online/offline status
  const now = Date.now();
  const onlineAmbulances = allAmbulances.filter(
    (amb) => now - Number(amb.timestamp) / 1_000_000 < OFFLINE_THRESHOLD_MS
  );
  const offlineAmbulances = allAmbulances.filter(
    (amb) => now - Number(amb.timestamp) / 1_000_000 >= OFFLINE_THRESHOLD_MS
  );

  const displayedAmbulances = showOffline ? allAmbulances : onlineAmbulances;

  // Create SOS alert lookup
  const sosAlertMap = new Map<string, SOSAlert>();
  sosAlerts.forEach((alert) => {
    sosAlertMap.set(alert.ambulanceId.toString(), alert);
  });

  // Prepare map markers
  const mapMarkers: MapMarker[] = displayedAmbulances.map((amb) => {
    const hasSOS = sosAlertMap.has(amb.ambulanceId.toString());
    return {
      id: amb.ambulanceId.toString(),
      lat: amb.coordinates.latitude,
      lng: amb.coordinates.longitude,
      type: hasSOS ? 'sos' : 'ambulance',
      label: hasSOS ? 'SOS ALERT' : 'Ambulance',
    };
  });

  // Add police location marker if available (use display location for map)
  if (displayLocation) {
    mapMarkers.push({
      id: 'police-self',
      lat: displayLocation.lat,
      lng: displayLocation.lng,
      type: 'police',
      label: 'Your Location (Police)',
    });
  }

  // Calculate map center - prefer display location, then first ambulance, then default
  const mapCenter = displayLocation || (displayedAmbulances.length > 0
    ? {
        lat: displayedAmbulances[0].coordinates.latitude,
        lng: displayedAmbulances[0].coordinates.longitude,
      }
    : { lat: 0, lng: 0 });

  // Check if Leaflet is available - render error if not
  if (!window.L) {
    console.error('[PoliceInterface] Leaflet not available');
    return (
      <div className="container mx-auto min-h-[calc(100vh-8rem)] px-4 py-8">
        <Alert className="border-destructive bg-destructive/10">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <AlertDescription>
            Map library failed to load. Please refresh the page to try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto min-h-[calc(100vh-8rem)] px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <img src="/assets/generated/police-badge.dim_64x64.png" alt="" className="h-8 w-8" />
              Police Command Center
            </CardTitle>
            <CardDescription>Monitor all ambulances and respond to SOS alerts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* GPS Status */}
            <div className="flex items-center gap-2 text-sm">
              <Badge variant={gpsStatus.includes('active') ? 'default' : 'secondary'}>
                {gpsStatus}
              </Badge>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch id="show-offline" checked={showOffline} onCheckedChange={setShowOffline} />
                <Label htmlFor="show-offline">Show offline ambulances</Label>
              </div>
              <div className="flex gap-2 text-sm text-muted-foreground">
                <Badge variant="outline">{onlineAmbulances.length} online</Badge>
                <Badge variant="secondary">{offlineAmbulances.length} offline</Badge>
                {sosAlerts.length > 0 && (
                  <Badge variant="destructive" className="animate-pulse">
                    {sosAlerts.length} SOS ALERT{sosAlerts.length > 1 ? 'S' : ''}
                  </Badge>
                )}
              </div>
            </div>

            {/* Map - Always show, even when no ambulances */}
            <div className="space-y-2">
              <h3 className="font-semibold">Live Map</h3>
              <div className="relative">
                <RealtimeMap
                  center={mapCenter}
                  markers={mapMarkers}
                  zoom={displayedAmbulances.length > 0 ? 13 : 2}
                  className="h-[500px]"
                />
                {/* Overlay message when no ambulances are online */}
                {displayedAmbulances.length === 0 && !ambulancesLoading && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="bg-background/90 backdrop-blur-sm border rounded-lg px-6 py-4 shadow-lg">
                      <p className="text-center text-muted-foreground font-medium">
                        {showOffline
                          ? 'No ambulances in the system yet'
                          : 'No ambulances currently online'}
                      </p>
                      {!showOffline && allAmbulances.length > 0 && (
                        <p className="text-center text-sm text-muted-foreground mt-1">
                          Toggle "Show offline ambulances" to see all
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Loading State */}
            {(ambulancesLoading || alertsLoading) && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-emergency-blue" />
              </div>
            )}

            {/* No Ambulances Alert (below map) */}
            {!ambulancesLoading && displayedAmbulances.length === 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {showOffline
                    ? 'No ambulances in the system yet.'
                    : 'No online ambulances. Toggle "Show offline ambulances" to see all.'}
                </AlertDescription>
              </Alert>
            )}

            {/* Ambulance List */}
            {displayedAmbulances.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-semibold">Ambulances ({displayedAmbulances.length})</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {displayedAmbulances.map((amb) => (
                    <AmbulanceCard
                      key={amb.ambulanceId.toString()}
                      ambulance={amb}
                      hasSOS={sosAlertMap.has(amb.ambulanceId.toString())}
                      userLocation={userLocation}
                    />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface AmbulanceCardProps {
  ambulance: AmbulanceLocation;
  hasSOS: boolean;
  userLocation: { lat: number; lng: number } | null;
}

function AmbulanceCard({ ambulance, hasSOS, userLocation }: AmbulanceCardProps) {
  const { data: profile, isLoading: profileLoading } = useGetUserProfile(ambulance.ambulanceId);

  const now = Date.now();
  const lastSeen = now - Number(ambulance.timestamp) / 1_000_000;
  const isOnline = lastSeen < OFFLINE_THRESHOLD_MS;

  const distance = userLocation
    ? calculateDistance(
        userLocation.lat,
        userLocation.lng,
        ambulance.coordinates.latitude,
        ambulance.coordinates.longitude
      )
    : null;

  const directionsUrl = buildDirectionsUrl(
    ambulance.coordinates,
    userLocation ? { latitude: userLocation.lat, longitude: userLocation.lng } : undefined
  );

  return (
    <Card className={hasSOS ? 'border-emergency-red bg-red-50 dark:bg-red-950' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-base">
              {profileLoading ? (
                <span className="text-muted-foreground">Loading...</span>
              ) : profile ? (
                profile.name
              ) : (
                <span className="text-muted-foreground">Unknown</span>
              )}
            </CardTitle>
            <CardDescription className="text-xs">
              ID: {ambulance.ambulanceId.toString().slice(0, 8)}...
            </CardDescription>
          </div>
          <div className="flex gap-1">
            {hasSOS && (
              <Badge variant="destructive" className="animate-pulse">
                SOS
              </Badge>
            )}
            <Badge variant={isOnline ? 'default' : 'secondary'}>
              {isOnline ? 'Online' : 'Offline'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-start gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div className="flex-1 space-y-1">
            <p className="text-xs text-muted-foreground">
              {ambulance.coordinates.latitude.toFixed(6)}, {ambulance.coordinates.longitude.toFixed(6)}
            </p>
            {distance !== null && (
              <p className="text-xs font-medium">{formatDistance(distance)} away</p>
            )}
          </div>
        </div>

        {profile && profile.phoneNumber && profile.phoneNumber !== 'Unknown' && (
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <a href={`tel:${profile.phoneNumber}`} className="text-emergency-blue hover:underline">
              {profile.phoneNumber}
            </a>
          </div>
        )}

        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-emergency-blue hover:underline"
        >
          <Navigation2 className="h-4 w-4" />
          Get Directions
        </a>

        <p className="text-xs text-muted-foreground">
          Last seen: {Math.floor(lastSeen / 1000)}s ago
        </p>
      </CardContent>
    </Card>
  );
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
