import { useState, useEffect, useRef } from 'react';
import { useGetLocationsInRadius, useGetActiveSOSAlerts } from '../hooks/useQueries';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { MapPin, Loader2, AlertCircle, Radio, Navigation } from 'lucide-react';
import type { Coordinates, AmbulanceLocation, SOSAlert } from '../backend';

const RADIUS_KM = 1.0;
const LOCATION_TIMEOUT_SECONDS = 15; // Consider ambulance offline if no update in 15 seconds

export default function PoliceInterface() {
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [previousAlertIds, setPreviousAlertIds] = useState<Set<string>>(new Set());
  const audioContextRef = useRef<AudioContext | null>(null);

  const { data: ambulancesRaw = [], isLoading: ambulancesLoading } = useGetLocationsInRadius(location, RADIUS_KM);
  const { data: sosAlerts = [] } = useGetActiveSOSAlerts();

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
                        Monitoring {RADIUS_KM}km radius • Live updates every 3s
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

            {/* Active SOS Alerts */}
            {sosAlerts.length > 0 && (
              <div className="space-y-3">
                <h3 className="flex items-center gap-2 font-semibold text-destructive">
                  <AlertCircle className="h-5 w-5 animate-pulse" />
                  Active SOS Alerts ({sosAlerts.length})
                </h3>
                {sosAlerts.map((alert) => {
                  const distance = location ? calculateDistance(location, alert.coordinates) : null;
                  const timestamp = new Date(Number(alert.timestamp) / 1000000);
                  
                  return (
                    <Alert key={alert.ambulanceId.toString()} className="border-destructive bg-destructive/10 animate-pulse">
                      <img src="/assets/generated/alert-icon.dim_48x48.png" alt="" className="h-6 w-6" />
                      <div className="flex-1 space-y-3">
                        <div>
                          <AlertTitle className="text-destructive font-bold">🚨 EMERGENCY ALERT</AlertTitle>
                          <AlertDescription className="space-y-1">
                            <p className="font-mono text-xs">Ambulance ID: {alert.ambulanceId.toString().slice(0, 20)}...</p>
                            <p className="text-xs">
                              Location: {alert.coordinates.latitude.toFixed(6)}, {alert.coordinates.longitude.toFixed(6)}
                            </p>
                            <p className="text-xs">
                              Time: {timestamp.toLocaleTimeString()}
                            </p>
                            {distance !== null && (
                              <p className="text-xs font-bold text-destructive">
                                Distance: {formatDistance(distance)}
                              </p>
                            )}
                          </AlertDescription>
                        </div>
                        <Button
                          onClick={() => handleGetDirections(alert.coordinates)}
                          variant="destructive"
                          size="sm"
                          className="w-full gap-2 font-semibold sm:w-auto"
                        >
                          <Navigation className="h-4 w-4" />
                          Get Directions
                        </Button>
                      </div>
                    </Alert>
                  );
                })}
              </div>
            )}

            {/* Real-time Ambulance Map */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-semibold">
                  <Navigation className="h-5 w-5 text-emergency-blue" />
                  Live Ambulance Tracking
                </h3>
                <Badge variant="secondary">
                  {ambulances.length} within {RADIUS_KM}km
                </Badge>
              </div>

              {ambulancesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : ambulances.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center">
                  <MapPin className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">No ambulances in range</p>
                  <p className="mt-1 text-xs text-muted-foreground">Waiting for ambulances to share their location...</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {ambulances.map((ambulance) => {
                    const hasAlert = isSOSActive(ambulance.ambulanceId.toString());
                    const distance = location ? calculateDistance(location, ambulance.coordinates) : 0;
                    const timestamp = new Date(Number(ambulance.timestamp) / 1000000);
                    const secondsAgo = Math.floor((Date.now() - timestamp.getTime()) / 1000);

                    return (
                      <Card
                        key={ambulance.ambulanceId.toString()}
                        className={`transition-all ${
                          hasAlert
                            ? 'border-2 border-destructive bg-destructive/5 shadow-lg shadow-destructive/30 animate-pulse'
                            : 'hover:shadow-md'
                        }`}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <img
                                src="/assets/generated/ambulance-marker.dim_32x32.png"
                                alt=""
                                className={`h-8 w-8 ${hasAlert ? 'brightness-0 saturate-100 hue-rotate-[350deg]' : ''}`}
                                style={hasAlert ? { filter: 'brightness(0) saturate(100%) invert(27%) sepia(98%) saturate(7426%) hue-rotate(357deg) brightness(95%) contrast(118%)' } : {}}
                              />
                              <CardTitle className="text-sm">Ambulance</CardTitle>
                            </div>
                            {hasAlert && (
                              <Badge variant="destructive" className="animate-pulse gap-1">
                                <AlertCircle className="h-3 w-3" />
                                SOS
                              </Badge>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2 text-xs">
                          <div className="font-mono text-muted-foreground">
                            ID: {ambulance.ambulanceId.toString().slice(0, 15)}...
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Latitude:</span>
                              <span className="font-medium">{ambulance.coordinates.latitude.toFixed(6)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Longitude:</span>
                              <span className="font-medium">{ambulance.coordinates.longitude.toFixed(6)}</span>
                            </div>
                            {location && (
                              <div className="flex justify-between border-t border-border pt-2">
                                <span className="text-muted-foreground">Distance:</span>
                                <span className={`font-semibold ${hasAlert ? 'text-destructive' : 'text-emergency-blue'}`}>
                                  {formatDistance(distance)}
                                </span>
                              </div>
                            )}
                            <div className="flex justify-between text-muted-foreground">
                              <span>Updated:</span>
                              <span>{secondsAgo}s ago</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Info Panel */}
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="mb-2 font-semibold">System Status</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="text-emergency-blue">•</span>
                  Real-time location updates every 2-3 seconds
                </li>
                <li className="flex gap-2">
                  <span className="text-emergency-blue">•</span>
                  Audio alerts play when new SOS signals are detected
                </li>
                <li className="flex gap-2">
                  <span className="text-emergency-blue">•</span>
                  Red markers indicate active emergency situations
                </li>
                <li className="flex gap-2">
                  <span className="text-emergency-blue">•</span>
                  Distance calculated from your current position
                </li>
                <li className="flex gap-2">
                  <span className="text-emergency-blue">•</span>
                  Ambulances offline for more than {LOCATION_TIMEOUT_SECONDS}s are hidden
                </li>
                <li className="flex gap-2">
                  <span className="text-emergency-blue">•</span>
                  Tap "Get Directions" on SOS alerts to navigate to emergency location
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
