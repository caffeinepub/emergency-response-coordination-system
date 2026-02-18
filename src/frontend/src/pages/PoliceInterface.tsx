import { useState, useEffect } from 'react';
import { useGetAllAmbulanceLocations, useGetActiveSOSAlerts, useGetUserProfile } from '../hooks/useQueries';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { AlertCircle, Phone, MapPin, Navigation2, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '../components/ui/alert';
import RealtimeMap, { MapMarker } from '../components/RealtimeMap';
import type { AmbulanceLocation, SOSAlert } from '../backend';
import { formatDistance, formatRadius } from '../utils/locationRefresh';
import { buildDirectionsUrl } from '../utils/mapsDirections';

const OFFLINE_THRESHOLD_MS = 60000; // 1 minute

export default function PoliceInterface() {
  console.log('[PoliceInterface] Rendering');
  
  const [showOffline, setShowOffline] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const { data: allAmbulances = [], isLoading: ambulancesLoading } = useGetAllAmbulanceLocations();
  const { data: sosAlerts = [], isLoading: alertsLoading } = useGetActiveSOSAlerts();

  // Get police officer's location
  useEffect(() => {
    console.log('[PoliceInterface] Setting up geolocation watch');
    if (!navigator.geolocation) {
      console.error('[PoliceInterface] Geolocation not supported');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        console.log('[PoliceInterface] GPS position update:', {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        console.error('[PoliceInterface] Geolocation error:', error);
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

  // Add police location marker if available
  if (userLocation) {
    mapMarkers.push({
      id: 'police-self',
      lat: userLocation.lat,
      lng: userLocation.lng,
      type: 'police',
      label: 'Your Location (Police)',
    });
  }

  // Calculate map center
  const mapCenter = userLocation || (displayedAmbulances.length > 0
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

            {/* Map */}
            {displayedAmbulances.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold">Live Map</h3>
                <RealtimeMap
                  center={mapCenter}
                  markers={mapMarkers}
                  zoom={13}
                  className="h-[500px]"
                />
              </div>
            )}

            {/* Loading State */}
            {(ambulancesLoading || alertsLoading) && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-emergency-blue" />
              </div>
            )}

            {/* No Ambulances */}
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
