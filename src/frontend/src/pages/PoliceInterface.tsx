import { useState, useEffect, useRef } from 'react';
import { useGetLocationsInRadius, useGetActiveSOSAlerts, useUpdatePoliceLocation } from '../hooks/useQueries';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { MapPin, Loader2, AlertCircle, Radio, Navigation } from 'lucide-react';
import type { Coordinates, AmbulanceLocation, SOSAlert } from '../backend';

const RADIUS_KM = 1.0;
const LOCATION_TIMEOUT_SECONDS = 15; // Consider ambulance offline if no update in 15 seconds
const POLICE_LOCATION_UPDATE_INTERVAL = 12000; // 12 seconds

export default function PoliceInterface() {
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [previousAlertIds, setPreviousAlertIds] = useState<Set<string>>(new Set());
  const audioContextRef = useRef<AudioContext | null>(null);
  const locationUpdateTimerRef = useRef<number | null>(null);

  const { data: ambulancesRaw = [], isLoading: ambulancesLoading } = useGetLocationsInRadius(location, RADIUS_KM);
  const { data: sosAlerts = [] } = useGetActiveSOSAlerts();
  const updatePoliceLocation = useUpdatePoliceLocation();

  // Filter out stale ambulance locations (no update in last 15 seconds)
  const ambulances = ambulancesRaw.filter((ambulance) => {
    const timestamp = new Date(Number(ambulance.timestamp) / 1000000);
    const secondsAgo = Math.floor((Date.now() - timestamp.getTime()) / 1000);
    return secondsAgo <= LOCATION_TIMEOUT_SECONDS;
  });

  // Initialize audio context
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    return () => {
      audioContextRef.current?.close();
    };
  }, []);

  // Play alert sound for new SOS alerts
  const playAlertSound = () => {
    if (!audioContextRef.current) return;
    
    const audioContext = audioContextRef.current;
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
    
    // Play second beep
    setTimeout(() => {
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
    }, 200);
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
    }, POLICE_LOCATION_UPDATE_INTERVAL);

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

  const formatDistance = (distance: number): string => {
    if (distance < 1) {
      return `${Math.round(distance * 1000)}m`;
    }
    return `${distance.toFixed(2)}km`;
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

  return (
    <div className="container mx-auto min-h-[calc(100vh-8rem)] px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <img src="/assets/generated/police-badge.dim_64x64.png" alt="" className="h-8 w-8" />
              Police Command Center
            </CardTitle>
            <CardDescription>Real-time ambulance tracking and emergency response</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Location Status */}
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-emergency-blue" />
                <div className="flex-1">
                  <h3 className="font-semibold">Your Location</h3>
                  {locationError ? (
                    <p className="text-sm text-destructive">{locationError}</p>
                  ) : location ? (
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p>Latitude: {location.latitude.toFixed(6)}</p>
                      <p>Longitude: {location.longitude.toFixed(6)}</p>
                      <Badge variant="outline" className="mt-2 gap-1">
                        <Radio className="h-3 w-3 animate-pulse text-emergency-blue" />
                        Monitoring {RADIUS_KM}km radius • Live updates every 12s
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

            {/* SOS Alerts */}
            {sosAlerts.length > 0 && (
              <div className="space-y-3">
                <h3 className="flex items-center gap-2 font-semibold">
                  <img src="/assets/generated/alert-icon.dim_48x48.png" alt="" className="h-6 w-6" />
                  Active SOS Alerts ({sosAlerts.length})
                </h3>
                {sosAlerts.map((alert) => {
                  const distance = location ? calculateDistance(location, alert.coordinates) : null;
                  return (
                    <Alert key={alert.ambulanceId.toString()} className="border-destructive bg-destructive/10">
                      <AlertCircle className="h-5 w-5 text-destructive" />
                      <div className="flex-1">
                        <AlertTitle className="text-destructive">Emergency Alert</AlertTitle>
                        <AlertDescription className="space-y-2">
                          <div className="text-sm">
                            <p className="font-medium">Ambulance ID: {alert.ambulanceId.toString().slice(0, 8)}...</p>
                            <p>Location: {alert.coordinates.latitude.toFixed(6)}, {alert.coordinates.longitude.toFixed(6)}</p>
                            {distance !== null && <p>Distance: {formatDistance(distance)}</p>}
                          </div>
                          <Button
                            onClick={() => handleGetDirections(alert.coordinates)}
                            size="sm"
                            className="bg-emergency-blue hover:bg-emergency-blue/90"
                          >
                            <Navigation className="mr-2 h-4 w-4" />
                            Get Directions
                          </Button>
                        </AlertDescription>
                      </div>
                    </Alert>
                  );
                })}
              </div>
            )}

            {/* Ambulance List */}
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 font-semibold">
                <img src="/assets/generated/ambulance-marker.dim_32x32.png" alt="" className="h-6 w-6" />
                Nearby Ambulances ({ambulances.length})
              </h3>

              {ambulancesLoading && !location ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : ambulances.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    No ambulances detected within {RADIUS_KM}km radius
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {ambulances.map((ambulance) => {
                    const distance = location ? calculateDistance(location, ambulance.coordinates) : null;
                    const timestamp = new Date(Number(ambulance.timestamp) / 1000000);
                    const secondsAgo = Math.floor((Date.now() - timestamp.getTime()) / 1000);
                    const hasSOSAlert = isSOSActive(ambulance.ambulanceId.toString());

                    return (
                      <Card
                        key={ambulance.ambulanceId.toString()}
                        className={hasSOSAlert ? 'border-destructive bg-destructive/5' : ''}
                      >
                        <CardContent className="flex items-center justify-between p-4">
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">
                                Ambulance {ambulance.ambulanceId.toString().slice(0, 8)}...
                              </p>
                              {hasSOSAlert && (
                                <Badge variant="destructive" className="gap-1">
                                  <AlertCircle className="h-3 w-3" />
                                  SOS ACTIVE
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              <p>
                                {ambulance.coordinates.latitude.toFixed(6)}, {ambulance.coordinates.longitude.toFixed(6)}
                              </p>
                              {distance !== null && (
                                <p className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {formatDistance(distance)} away • Updated {secondsAgo}s ago
                                </p>
                              )}
                            </div>
                          </div>
                          <Button
                            onClick={() => handleGetDirections(ambulance.coordinates)}
                            size="sm"
                            variant={hasSOSAlert ? 'destructive' : 'outline'}
                          >
                            <Navigation className="mr-2 h-4 w-4" />
                            Navigate
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
