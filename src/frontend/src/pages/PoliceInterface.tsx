import { useState, useEffect, useRef } from 'react';
import { useGetLocationsInRadius, useGetActiveSOSAlerts, useUpdatePoliceLocation } from '../hooks/useQueries';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { MapPin, Loader2, AlertCircle, Radio, Navigation, Volume2, VolumeX } from 'lucide-react';
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
  const { data: sosAlerts = [] } = useGetActiveSOSAlerts();
  const updatePoliceLocation = useUpdatePoliceLocation();

  // Filter out stale ambulance locations (no update in last 15 seconds)
  const ambulances = ambulancesRaw.filter((ambulance) => {
    const timestamp = new Date(Number(ambulance.timestamp) / 1000000);
    const secondsAgo = Math.floor((Date.now() - timestamp.getTime()) / 1000);
    return secondsAgo <= LOCATION_TIMEOUT_SECONDS;
  });

  // Initialize audio context with error handling
  useEffect(() => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioContextRef.current = new AudioContextClass();
        setAudioAvailable(true);
      } else {
        console.warn('AudioContext not supported');
        setAudioAvailable(false);
      }
    } catch (error) {
      console.warn('Failed to initialize AudioContext:', error);
      setAudioAvailable(false);
    }
    
    return () => {
      try {
        audioContextRef.current?.close();
      } catch (error) {
        console.warn('Failed to close AudioContext:', error);
      }
    };
  }, []);

  // Play alert sound for new SOS alerts with comprehensive error handling
  const playAlertSound = () => {
    if (!audioContextRef.current || !audioAvailable) return;
    
    try {
      const audioContext = audioContextRef.current;
      
      // Resume context if suspended (browser autoplay policy)
      if (audioContext.state === 'suspended') {
        audioContext.resume().catch((err) => {
          console.warn('Failed to resume audio context:', err);
        });
      }
      
      // First beep
      try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 880; // A5 note
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
      } catch (error) {
        console.warn('Failed to play first beep:', error);
      }
      
      // Second beep
      setTimeout(() => {
        try {
          if (!audioContext || audioContext.state === 'closed') return;
          
          const oscillator2 = audioContext.createOscillator();
          const gainNode2 = audioContext.createGain();
          
          oscillator2.connect(gainNode2);
          gainNode2.connect(audioContext.destination);
          
          oscillator2.frequency.value = 1100; // C#6 note
          oscillator2.type = 'sine';
          
          gainNode2.gain.setValueAtTime(0.3, audioContext.currentTime);
          gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
          
          oscillator2.start(audioContext.currentTime);
          oscillator2.stop(audioContext.currentTime + 0.5);
        } catch (error) {
          console.warn('Failed to play second beep:', error);
        }
      }, 200);
    } catch (error) {
      console.warn('Failed to play alert sound:', error);
      setAudioAvailable(false);
    }
  };

  // Get user's location
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
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

  // Send police location updates to backend every 12 seconds
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

  // Detect new SOS alerts and play sound
  useEffect(() => {
    const currentAlertIds = new Set(sosAlerts.map(alert => alert.ambulanceId.toString()));
    
    // Find new alerts that weren't in the previous set
    const newAlerts = sosAlerts.filter(
      alert => !previousAlertIds.has(alert.ambulanceId.toString())
    );
    
    if (newAlerts.length > 0 && previousAlertIds.size > 0) {
      playAlertSound();
    }
    
    setPreviousAlertIds(currentAlertIds);
  }, [sosAlerts]);

  const calculateDistance = (coord1: Coordinates, coord2: Coordinates): number => {
    const R = 6371; // Earth's radius in km
    const dLat = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
    const dLon = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((coord1.latitude * Math.PI) / 180) *
        Math.cos((coord2.latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const isSOSActive = (ambulanceId: string): boolean => {
    return sosAlerts.some((alert) => alert.ambulanceId.toString() === ambulanceId);
  };

  const getSOSAlert = (ambulanceId: string): SOSAlert | undefined => {
    return sosAlerts.find((alert) => alert.ambulanceId.toString() === ambulanceId);
  };

  const getDirectionsUrl = (destination: Coordinates): string => {
    // If we have the police officer's location, use it as origin
    if (location) {
      return `https://www.google.com/maps/dir/?api=1&origin=${location.latitude},${location.longitude}&destination=${destination.latitude},${destination.longitude}&travelmode=driving`;
    }
    // Otherwise, just show the destination location
    return `https://www.google.com/maps/search/?api=1&query=${destination.latitude},${destination.longitude}`;
  };

  const handleGetDirections = (coordinates: Coordinates) => {
    const url = getDirectionsUrl(coordinates);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Prepare map markers
  const mapMarkers: MapMarker[] = [];
  
  // Add police officer location
  if (location) {
    mapMarkers.push({
      id: 'police-officer',
      lat: location.latitude,
      lng: location.longitude,
      type: 'police',
      label: 'Your Location (Police Officer)',
    });
  }

  // Add ambulance markers
  ambulances.forEach((ambulance) => {
    const isSOS = isSOSActive(ambulance.ambulanceId.toString());
    mapMarkers.push({
      id: `ambulance-${ambulance.ambulanceId.toString()}`,
      lat: ambulance.coordinates.latitude,
      lng: ambulance.coordinates.longitude,
      type: isSOS ? 'sos' : 'ambulance',
      label: isSOS ? 'SOS ALERT - Ambulance' : 'Ambulance',
    });
  });

  // Add SOS alert markers for alerts not in ambulances list
  sosAlerts.forEach((alert) => {
    const alertId = alert.ambulanceId.toString();
    const alreadyMarked = ambulances.some(amb => amb.ambulanceId.toString() === alertId);
    if (!alreadyMarked) {
      mapMarkers.push({
        id: `sos-${alertId}`,
        lat: alert.coordinates.latitude,
        lng: alert.coordinates.longitude,
        type: 'sos',
        label: 'SOS ALERT - Ambulance',
      });
    }
  });

  // Determine if we should show loading state
  const showLoading = !location || (ambulancesLoading && !ambulancesFetching);
  const showAmbulances = location && !locationError;

  return (
    <div className="container mx-auto min-h-[calc(100vh-8rem)] px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <img src="/assets/generated/police-badge.dim_64x64.png" alt="" className="h-8 w-8" />
              Police Command Center
            </CardTitle>
            <CardDescription>Real-time ambulance tracking and emergency response coordination</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Location Status */}
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-emergency-blue" />
                <div className="flex-1">
                  <h3 className="font-semibold">Your Location Status</h3>
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
                          <Radio className="h-3 w-3 animate-pulse text-emergency-blue" />
                          Monitoring {formatRadius(POLICE_RADIUS_KM)} radius
                        </Badge>
                        {!audioAvailable && (
                          <Badge variant="outline" className="gap-1 text-amber-600">
                            <VolumeX className="h-3 w-3" />
                            Audio alerts unavailable
                          </Badge>
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

            {/* Real-time Map */}
            {location && !locationError && (
              <div className="space-y-2">
                <h3 className="font-semibold">Tactical Map</h3>
                <RealtimeMap
                  center={{ lat: location.latitude, lng: location.longitude }}
                  markers={mapMarkers}
                  zoom={16}
                  className="h-[400px]"
                />
              </div>
            )}

            {/* Active SOS Alerts */}
            {sosAlerts.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-destructive">🚨 Active SOS Alerts</h3>
                <div className="space-y-2">
                  {sosAlerts.map((alert) => {
                    const distance = location ? calculateDistance(location, alert.coordinates) : null;
                    const timestamp = new Date(Number(alert.timestamp) / 1000000);
                    const secondsAgo = Math.floor((Date.now() - timestamp.getTime()) / 1000);

                    return (
                      <Alert key={alert.ambulanceId.toString()} className="border-destructive bg-destructive/10">
                        <AlertCircle className="h-4 w-4 text-destructive" />
                        <AlertTitle className="text-destructive">Emergency Alert</AlertTitle>
                        <AlertDescription className="space-y-2">
                          <div className="text-sm">
                            <p className="font-semibold">Ambulance ID: {alert.ambulanceId.toString().slice(0, 8)}...</p>
                            <p>Location: {alert.coordinates.latitude.toFixed(6)}, {alert.coordinates.longitude.toFixed(6)}</p>
                            {distance !== null && <p>Distance: {formatDistance(distance)}</p>}
                            <p className="text-xs text-muted-foreground">Alert triggered {secondsAgo}s ago</p>
                          </div>
                          <Button
                            onClick={() => handleGetDirections(alert.coordinates)}
                            size="sm"
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            <Navigation className="mr-2 h-4 w-4" />
                            Get Directions
                          </Button>
                        </AlertDescription>
                      </Alert>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Nearby Ambulances */}
            <div className="space-y-3">
              <h3 className="font-semibold">Nearby Ambulances</h3>
              
              {locationError ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Location access required to detect nearby ambulances. Please enable location services.
                  </AlertDescription>
                </Alert>
              ) : showLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : ambulances.length === 0 ? (
                <Alert>
                  <MapPin className="h-4 w-4" />
                  <AlertDescription>
                    No ambulances detected within {formatRadius(POLICE_RADIUS_KM)} radius of your location.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-2">
                  {ambulances.map((ambulance) => {
                    const distance = location ? calculateDistance(location, ambulance.coordinates) : null;
                    const timestamp = new Date(Number(ambulance.timestamp) / 1000000);
                    const secondsAgo = Math.floor((Date.now() - timestamp.getTime()) / 1000);
                    const isSOS = isSOSActive(ambulance.ambulanceId.toString());
                    const sosAlert = isSOS ? getSOSAlert(ambulance.ambulanceId.toString()) : undefined;

                    return (
                      <Card
                        key={ambulance.ambulanceId.toString()}
                        className={isSOS ? 'border-destructive bg-destructive/5' : ''}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2">
                                <img
                                  src="/assets/generated/ambulance-icon.dim_64x64.png"
                                  alt=""
                                  className="h-6 w-6"
                                />
                                <span className="font-semibold">
                                  {ambulance.ambulanceId.toString().slice(0, 8)}...
                                </span>
                                {isSOS && (
                                  <Badge variant="destructive" className="animate-pulse">
                                    SOS ACTIVE
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                <p>
                                  Location: {ambulance.coordinates.latitude.toFixed(6)},{' '}
                                  {ambulance.coordinates.longitude.toFixed(6)}
                                </p>
                                {distance !== null && <p>Distance: {formatDistance(distance)}</p>}
                                <p className="text-xs">Last update: {secondsAgo}s ago</p>
                              </div>
                            </div>
                            <Button
                              onClick={() => handleGetDirections(ambulance.coordinates)}
                              size="sm"
                              variant={isSOS ? 'destructive' : 'default'}
                            >
                              <Navigation className="mr-2 h-4 w-4" />
                              Navigate
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
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
                  Real-time tracking of ambulances within {formatRadius(POLICE_RADIUS_KM)} of your location
                </li>
                <li className="flex gap-2">
                  <span className="text-emergency-blue">•</span>
                  Automatic audio alerts when new SOS emergencies are triggered
                </li>
                <li className="flex gap-2">
                  <span className="text-emergency-blue">•</span>
                  One-tap navigation to ambulance locations via Google Maps
                </li>
                <li className="flex gap-2">
                  <span className="text-emergency-blue">•</span>
                  Live map view showing all nearby ambulances and active SOS alerts
                </li>
                <li className="flex gap-2">
                  <span className="text-emergency-blue">•</span>
                  Location data refreshes every {LOCATION_UPDATE_INTERVAL / 1000} seconds for real-time coordination
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
