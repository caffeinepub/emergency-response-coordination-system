import { useState } from 'react';
import { useSaveCallerUserProfile } from '../hooks/useQueries';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Alert, AlertDescription } from './ui/alert';
import { Ambulance, Shield, Loader2, AlertCircle } from 'lucide-react';
import { AppRole } from '../backend';

export default function ProfileSetup() {
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [role, setRole] = useState<'ambulance' | 'police'>('ambulance');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const saveProfile = useSaveCallerUserProfile();

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only allow digits
    const digitsOnly = value.replace(/\D/g, '');
    setPhoneNumber(digitsOnly);
    
    // Clear phone error when user starts typing
    if (phoneError) {
      setPhoneError(null);
    }
  };

  const validatePhone = (): boolean => {
    if (phoneNumber.length !== 10) {
      setPhoneError('Phone number must be exactly 10 digits');
      return false;
    }
    setPhoneError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    // Validate phone number
    if (!validatePhone()) {
      return;
    }

    // Clear any previous error
    setErrorMessage(null);

    try {
      await saveProfile.mutateAsync({
        name: name.trim(),
        phoneNumber: phoneNumber,
        role: role as AppRole,
      });
      // Success - the query refetch will trigger App.tsx to transition
    } catch (error: any) {
      // Display error to user
      const message = error?.message || 'Failed to save profile. Please try again.';
      setErrorMessage(message);
    }
  };

  return (
    <div className="container mx-auto flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md border-2 shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Complete Your Profile</CardTitle>
          <CardDescription>Choose your role and enter your details</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {errorMessage && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Your Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Enter your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={saveProfile.isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <Input
                id="phoneNumber"
                type="tel"
                placeholder="Enter 10-digit phone number"
                value={phoneNumber}
                onChange={handlePhoneChange}
                maxLength={10}
                required
                disabled={saveProfile.isPending}
                className={phoneError ? 'border-destructive' : ''}
              />
              {phoneError && (
                <p className="text-sm text-destructive">{phoneError}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {phoneNumber.length}/10 digits
              </p>
            </div>

            <div className="space-y-3">
              <Label>Select Your Role</Label>
              <RadioGroup value={role} onValueChange={(value) => setRole(value as 'ambulance' | 'police')}>
                <div className="flex items-center space-x-3 rounded-lg border-2 border-border p-4 transition-colors hover:bg-muted/50 has-[:checked]:border-emergency-red has-[:checked]:bg-emergency-red/5">
                  <RadioGroupItem value="ambulance" id="ambulance" />
                  <Label htmlFor="ambulance" className="flex flex-1 cursor-pointer items-center gap-3">
                    <Ambulance className="h-6 w-6 text-emergency-red" />
                    <div>
                      <div className="font-semibold">Ambulance Crew</div>
                      <div className="text-xs text-muted-foreground">Send SOS alerts and share location</div>
                    </div>
                  </Label>
                </div>

                <div className="flex items-center space-x-3 rounded-lg border-2 border-border p-4 transition-colors hover:bg-muted/50 has-[:checked]:border-emergency-blue has-[:checked]:bg-emergency-blue/5">
                  <RadioGroupItem value="police" id="police" />
                  <Label htmlFor="police" className="flex flex-1 cursor-pointer items-center gap-3">
                    <Shield className="h-6 w-6 text-emergency-blue" />
                    <div>
                      <div className="font-semibold">Police Unit</div>
                      <div className="text-xs text-muted-foreground">Monitor ambulances and respond to alerts</div>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full bg-gradient-to-r from-emergency-blue to-emergency-red hover:opacity-90"
              disabled={!name.trim() || phoneNumber.length !== 10 || saveProfile.isPending}
            >
              {saveProfile.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Continue'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
