import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { useGetCallerUserProfile } from '../hooks/useQueries';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Siren, LogOut, User } from 'lucide-react';
import ShareAppLinkControl from './ShareAppLinkControl';
import LinkDomainInfoPanel from './LinkDomainInfoPanel';

export default function Header() {
  const { identity, clear, isLoggingIn } = useInternetIdentity();
  const { data: userProfile, isLoading: profileLoading } = useGetCallerUserProfile();
  const queryClient = useQueryClient();

  const isAuthenticated = !!identity;

  const handleLogout = async () => {
    try {
      console.log('[Header] Logging out...');
      await clear();
      // Clear all cached data after logout
      queryClient.clear();
      console.log('[Header] Logout successful, cache cleared');
    } catch (error) {
      console.error('[Header] Logout error:', error);
      // Force clear even if logout fails
      queryClient.clear();
    }
  };

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Siren className="h-6 w-6 text-emergency-red" />
            <h1 className="text-xl font-bold bg-gradient-to-r from-emergency-red to-emergency-blue bg-clip-text text-transparent">
              Emergency Response
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <ShareAppLinkControl />
            <LinkDomainInfoPanel />
            
            {isAuthenticated && userProfile && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {profileLoading ? 'Loading...' : userProfile?.name || 'User'}
                </span>
                {userProfile?.role && (
                  <Badge 
                    variant={userProfile.role === 'ambulance' ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {userProfile.role === 'ambulance' ? '🚑 Ambulance' : '👮 Police'}
                  </Badge>
                )}
              </div>
            )}

            {isAuthenticated && (
              <Button
                onClick={handleLogout}
                disabled={isLoggingIn}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
