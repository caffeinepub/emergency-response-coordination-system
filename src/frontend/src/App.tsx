import { useInternetIdentity } from './hooks/useInternetIdentity';
import { useGetCallerUserProfile } from './hooks/useQueries';
import { isValidPhoneNumber } from './utils/phoneValidation';
import { Loader2 } from 'lucide-react';
import Header from './components/Header';
import Footer from './components/Footer';
import LoginPrompt from './components/LoginPrompt';
import ProfileSetup from './components/ProfileSetup';
import PhoneNumberCapture from './components/PhoneNumberCapture';
import AmbulanceInterface from './pages/AmbulanceInterface';
import PoliceInterface from './pages/PoliceInterface';

export default function App() {
  const { identity, isInitializing } = useInternetIdentity();
  const { data: userProfile, isLoading: profileLoading, isFetched } = useGetCallerUserProfile();

  const isAuthenticated = !!identity;

  // Show loading state while initializing
  if (isInitializing || (isAuthenticated && profileLoading && !isFetched)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-red-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-emergency-blue" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login prompt if not authenticated
  if (!isAuthenticated) {
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

  // Show profile setup if authenticated but no profile (new user)
  const showProfileSetup = isAuthenticated && isFetched && userProfile === null;
  if (showProfileSetup) {
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
