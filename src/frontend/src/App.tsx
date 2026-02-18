import { useInternetIdentity } from './hooks/useInternetIdentity';
import { useGetCallerUserProfile } from './hooks/useQueries';
import { useActor } from './hooks/useActor';
import { useAdminTokenInitialization } from './hooks/useAdminTokenInitialization';
import { isValidPhoneNumber } from './utils/phoneValidation';
import { Loader2 } from 'lucide-react';
import Header from './components/Header';
import Footer from './components/Footer';
import LoginPrompt from './components/LoginPrompt';
import ProfileSetup from './components/ProfileSetup';
import PhoneNumberCapture from './components/PhoneNumberCapture';
import AmbulanceInterface from './pages/AmbulanceInterface';
import PoliceInterface from './pages/PoliceInterface';
import ErrorState from './components/ErrorState';
import { useQueryClient } from '@tanstack/react-query';

export default function App() {
  console.log('[App] Rendering App component');
  
  const { identity, isInitializing, loginError } = useInternetIdentity();
  const { actor, isFetching: actorFetching } = useActor();
  const { data: userProfile, isLoading: profileLoading, isFetched, isError, error: profileError, refetch: refetchProfile } = useGetCallerUserProfile();
  const queryClient = useQueryClient();
  
  // Initialize admin token once per session after login (non-blocking)
  useAdminTokenInitialization();

  const isAuthenticated = !!identity;

  console.log('[App] State:', {
    isInitializing,
    isAuthenticated,
    actorFetching,
    profileLoading,
    isFetched,
    isError,
    hasProfile: !!userProfile,
    profileRole: userProfile?.role,
    loginError: loginError?.message,
    profileError: profileError instanceof Error ? profileError.message : profileError,
  });

  // Handle Internet Identity initialization errors
  if (loginError) {
    console.error('[App] Login error detected:', loginError);
    return (
      <ErrorState
        title="Authentication Error"
        message="Failed to initialize authentication system. Please try reloading the page."
        error={loginError}
        showReload={true}
      />
    );
  }

  // Show loading state while initializing identity or actor
  if (isInitializing) {
    console.log('[App] Showing initialization loading state');
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-red-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-emergency-blue" />
          <p className="text-muted-foreground">Initializing authentication...</p>
        </div>
      </div>
    );
  }

  if (actorFetching) {
    console.log('[App] Showing actor loading state');
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-red-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-emergency-blue" />
          <p className="text-muted-foreground">Connecting to backend...</p>
        </div>
      </div>
    );
  }

  // Show login prompt if not authenticated
  if (!isAuthenticated) {
    console.log('[App] User not authenticated, showing login prompt');
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">
          <LoginPrompt />
        </main>
        <Footer />
      </div>
    );
  }

  // Wait for profile query to complete (either success or error)
  if (actor && profileLoading && !isFetched) {
    console.log('[App] Loading user profile...');
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-red-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-emergency-blue" />
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  // Handle profile query error
  if (isError) {
    console.error('[App] Profile loading error:', profileError);
    return (
      <ErrorState
        title="Profile Loading Error"
        message="Failed to load your user profile. This might be a temporary network issue or a backend problem."
        error={profileError instanceof Error ? profileError : new Error(String(profileError))}
        onRetry={() => {
          console.log('[App] Retrying profile fetch');
          refetchProfile();
        }}
        showReload={true}
      />
    );
  }

  // Show profile setup if authenticated but no profile (new user)
  const showProfileSetup = isAuthenticated && isFetched && userProfile === null;
  if (showProfileSetup) {
    console.log('[App] New user detected, showing profile setup');
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">
          <ProfileSetup />
        </main>
        <Footer />
      </div>
    );
  }

  // Show phone number capture ONLY for ambulance users with invalid phone
  const showPhoneCapture = isAuthenticated && isFetched && userProfile !== null && userProfile !== undefined && userProfile.role === 'ambulance' && !isValidPhoneNumber(userProfile.phoneNumber);
  if (showPhoneCapture) {
    console.log('[App] Ambulance user needs phone number, showing capture screen');
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">
          <PhoneNumberCapture />
        </main>
        <Footer />
      </div>
    );
  }

  // Show appropriate interface based on role (phone validation only blocks ambulance users)
  console.log('[App] Rendering main interface for role:', userProfile?.role);
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        {userProfile?.role === 'ambulance' ? <AmbulanceInterface /> : <PoliceInterface />}
      </main>
      <Footer />
    </div>
  );
}
