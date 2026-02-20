import { useState } from 'react';
import { useSaveCallerUserProfile } from '../hooks/useQueries';
import { normalizePhoneInput, getPhoneValidationMessage } from '../utils/phoneValidation';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Alert, AlertDescription } from './ui/alert';
import { Ambulance, Shield, Loader2, AlertCircle } from 'lucide-react';
import { AppRole } from '../backend';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { useActor } from '../hooks/useActor';

// Helper function to categorize and format error messages
function categorizeError(error: any): { category: string; message: string; hint: string } {
  const errorMessage = error?.message || String(error);
  
  console.log('[ProfileSetup] Categorizing error:', {
    errorType: error?.constructor?.name,
    errorMessage,
    errorString: String(error),
    errorKeys: Object.keys(error || {}),
    timestamp: new Date().toISOString(),
  });
  
  // Phone number validation errors
  if (errorMessage.includes('Phone number must be exactly 10 digits')) {
    return {
      category: 'validation',
      message: 'Invalid phone number format',
      hint: 'Please enter exactly 10 digits without spaces or special characters.',
    };
  }
  
  if (errorMessage.includes('Phone number must contain only digits')) {
    return {
      category: 'validation',
      message: 'Invalid phone number format',
      hint: 'Phone number must contain only digits (0-9).',
    };
  }
  
  // Authorization errors - new user not set up by admin
  if (errorMessage.includes('New users must have their profile created by an admin')) {
    return {
      category: 'authorization',
      message: 'Account setup required',
      hint: 'Your account needs to be set up by an administrator before you can create a profile. Please contact your system administrator.',
    };
  }
  
  if (errorMessage.includes('Unauthorized') || errorMessage.includes('permission')) {
    return {
      category: 'authorization',
      message: 'Authorization error',
      hint: 'You do not have permission to perform this action. Please try logging out and logging in again.',
    };
  }
  
  // Network/connection errors
  if (
    errorMessage.includes('network') ||
    errorMessage.includes('fetch') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('Actor not available')
  ) {
    return {
      category: 'network',
      message: 'Connection error',
      hint: 'Unable to connect to the server. Please check your internet connection and try again.',
    };
  }
  
  // Generic backend errors
  return {
    category: 'backend',
    message: 'Unable to save profile',
    hint: errorMessage || 'An unexpected error occurred. Please try again.',
  };
}

export default function ProfileSetup() {
  console.log('[ProfileSetup] Component rendering');
  
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [role, setRole] = useState<'ambulance' | 'police'>('ambulance');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorHint, setErrorHint] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const saveProfile = useSaveCallerUserProfile();
  const { identity } = useInternetIdentity();
  const { actor } = useActor();

  console.log('[ProfileSetup] Current state:', {
    hasName: !!name,
    nameLength: name.length,
    phoneLength: phoneNumber.length,
    selectedRole: role,
    hasError: !!errorMessage,
    isPending: saveProfile.isPending,
    hasIdentity: !!identity,
    identityPrincipal: identity?.getPrincipal().toString(),
    hasActor: !!actor,
    timestamp: new Date().toISOString(),
  });

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    console.log('[ProfileSetup] Phone input changed:', {
      rawValue: value,
      length: value.length,
    });
    
    // Only allow digits
    const digitsOnly = normalizePhoneInput(value);
    setPhoneNumber(digitsOnly);
    
    console.log('[ProfileSetup] Phone normalized:', {
      digitsOnly,
      length: digitsOnly.length,
    });
    
    // Clear phone error when user starts typing
    if (phoneError) {
      setPhoneError(null);
    }
  };

  const validatePhone = (): boolean => {
    console.log('[ProfileSetup] Validating phone number:', {
      phoneNumber,
      length: phoneNumber.length,
    });
    
    const validationMessage = getPhoneValidationMessage(phoneNumber);
    if (validationMessage) {
      console.warn('[ProfileSetup] Phone validation failed:', validationMessage);
      setPhoneError(validationMessage);
      return false;
    }
    
    console.log('[ProfileSetup] Phone validation passed');
    setPhoneError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('[ProfileSetup] ========== Form submission started ==========');
    console.log('[ProfileSetup] Form data:', {
      name: name.trim(),
      nameLength: name.trim().length,
      phoneNumber,
      phoneLength: phoneNumber.length,
      role,
      timestamp: new Date().toISOString(),
    });
    
    if (!name.trim()) {
      console.warn('[ProfileSetup] Name is empty, aborting submission');
      return;
    }
    
    // Validate phone number
    if (!validatePhone()) {
      console.warn('[ProfileSetup] Phone validation failed, aborting submission');
      return;
    }

    // Clear any previous error
    setErrorMessage(null);
    setErrorHint(null);

    // Log authentication state before submission
    console.log('[ProfileSetup] Authentication state before save:', {
      hasIdentity: !!identity,
      identityPrincipal: identity?.getPrincipal().toString(),
      hasActor: !!actor,
      actorType: actor?.constructor?.name,
      timestamp: new Date().toISOString(),
    });

    const profileToSave = {
      name: name.trim(),
      phoneNumber: phoneNumber,
      role: role as AppRole,
    };

    console.log('[ProfileSetup] Profile object to save:', {
      ...profileToSave,
      timestamp: new Date().toISOString(),
    });

    try {
      console.log('[ProfileSetup] Calling saveProfile.mutateAsync...');
      await saveProfile.mutateAsync(profileToSave);
      console.log('[ProfileSetup] ✅ Profile saved successfully!');
      // Success - the query refetch will trigger App.tsx to transition
    } catch (error: any) {
      console.error('[ProfileSetup] ❌ Error saving profile - FULL ERROR DETAILS:', {
        errorType: error?.constructor?.name,
        errorName: error?.name,
        errorMessage: error?.message,
        errorString: String(error),
        errorStack: error?.stack,
        errorKeys: Object.keys(error || {}),
        errorProto: Object.getPrototypeOf(error)?.constructor?.name,
        // Try to extract any additional error properties
        errorCode: (error as any)?.code,
        errorStatus: (error as any)?.status,
        errorResponse: (error as any)?.response,
        errorData: (error as any)?.data,
        // Authentication context
        hasIdentity: !!identity,
        identityPrincipal: identity?.getPrincipal().toString(),
        hasActor: !!actor,
        // Profile data that was attempted
        attemptedProfile: profileToSave,
        timestamp: new Date().toISOString(),
      });
      
      // Categorize and format the error for user display
      const { category, message, hint } = categorizeError(error);
      
      console.log('[ProfileSetup] Error categorized as:', {
        category,
        message,
        hint,
        timestamp: new Date().toISOString(),
      });
      
      setErrorMessage(message);
      setErrorHint(hint);
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
                <AlertDescription>
                  <div className="font-semibold">{errorMessage}</div>
                  {errorHint && <div className="mt-1 text-sm">{errorHint}</div>}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Your Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Enter your full name"
                value={name}
                onChange={(e) => {
                  console.log('[ProfileSetup] Name input changed:', e.target.value);
                  setName(e.target.value);
                }}
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
              <RadioGroup value={role} onValueChange={(value) => {
                console.log('[ProfileSetup] Role changed to:', value);
                setRole(value as 'ambulance' | 'police');
              }}>
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
