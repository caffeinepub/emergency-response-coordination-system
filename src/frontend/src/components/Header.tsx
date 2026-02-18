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
  const { data: userProfile } = useGetCallerUserProfile();
  const queryClient = useQueryClient();

  const isAuthenticated = !!identity;

  const handleLogout = async () => {
    try {
      await clear();
      // Clear all cached data after logout
      queryClient.clear();
    } catch (error) {
      console.error('Logout error:', error);
      // Force clear even if logout fails
      queryClient.clear();
    }
  };

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emergency-blue to-emergency-red">
            <Siren className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">Emergency Response</h1>
            <p className="text-xs text-muted-foreground">Coordination System</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ShareAppLinkControl />
          <LinkDomainInfoPanel />
          {isAuthenticated && userProfile && (
            <div className="flex items-center gap-2 ml-2 pl-2 border-l border-border">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{userProfile.name}</span>
              <Badge variant={userProfile.role === 'ambulance' ? 'default' : 'secondary'}>
                {userProfile.role === 'ambulance' ? 'Ambulance' : 'Police'}
              </Badge>
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
    </header>
  );
}
