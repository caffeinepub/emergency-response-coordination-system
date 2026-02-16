import { useState } from 'react';
import { useSaveCallerUserProfile, useGetCallerUserProfile } from '../hooks/useQueries';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { Loader2, AlertCircle, Phone, Ambulance, Shield } from 'lucide-react';
import { normalizePhoneInput, getPhoneValidationMessage } from '../utils/phoneValidation';

export default function PhoneNumberCapture() {
  const { data: userProfile } = useGetCallerUserProfile();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const saveProfile = useSaveCallerUserProfile();

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only allow digits
    const digitsOnly = normalizePhoneInput(value);
    setPhoneNumber(digitsOnly);
    
    // Clear phone error when user starts typing
    if (phoneError) {
      setPhoneError(null);
    }
    if (errorMessage) {
      setErrorMessage(null);
    }
  };

  const validatePhone = (): boolean => {
    const validationMessage = getPhoneValidationMessage(phoneNumber);
    if (validationMessage) {
      setPhoneError(validationMessage);
      return false;
    }
    setPhoneError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate phone number
    if (!validatePhone()) {
      return;
    }

    // Ensure we have the existing profile
    if (!userProfile) {
      setErrorMessage('Unable to load your profile. Please try logging in again.');
      return;
    }

    // Clear any previous error
    setErrorMessage(null);

    try {
      // Save profile with existing name and role, only updating phone number
      await saveProfile.mutateAsync({
        name: userProfile.name,
        phoneNumber: phoneNumber,
        role: userProfile.role,
      });
      // Success - the query refetch will trigger App.tsx to transition
    } catch (error: any) {
      // Display error to user
      const message = error?.message || 'Failed to update phone number. Please try again.';
      setErrorMessage(message);
    }
  };

  const isSubmitDisabled = phoneNumber.length !== 10 || saveProfile.isPending;

  return (
    <div className="container mx-auto flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md border-2 shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Phone Number Required</CardTitle>
          <CardDescription>Please provide your phone number to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {errorMessage && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            {/* Display existing profile info as read-only */}
            {userProfile && (
              <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Name:</span>
                  <span className="font-semibold">{userProfile.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Role:</span>
                  <Badge 
                    variant="outline" 
                    className={
                      userProfile.role === 'ambulance' 
                        ? 'border-emergency-red text-emergency-red' 
                        : 'border-emergency-blue text-emergency-blue'
                    }
                  >
                    {userProfile.role === 'ambulance' ? (
                      <>
                        <Ambulance className="mr-1 h-3 w-3" />
                        Ambulance
                      </>
                    ) : (
                      <>
                        <Shield className="mr-1 h-3 w-3" />
                        Police
                      </>
                    )}
                  </Badge>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="phoneNumber" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Phone Number
              </Label>
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
                autoFocus
              />
              {phoneError && (
                <p className="text-sm text-destructive">{phoneError}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {phoneNumber.length}/10 digits
              </p>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full bg-gradient-to-r from-emergency-blue to-emergency-red hover:opacity-90"
              disabled={isSubmitDisabled}
            >
              {saveProfile.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
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
