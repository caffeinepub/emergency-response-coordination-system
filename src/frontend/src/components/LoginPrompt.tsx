import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Siren, Shield, Ambulance } from 'lucide-react';

export default function LoginPrompt() {
  const { login, isLoggingIn } = useInternetIdentity();

  return (
    <div className="container mx-auto flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md border-2 shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emergency-blue to-emergency-red shadow-lg">
            <Siren className="h-10 w-10 text-white" />
          </div>
          <CardTitle className="text-2xl">Emergency Response System</CardTitle>
          <CardDescription className="text-base">
            Secure coordination between ambulance crews and police units
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-muted/30 p-4">
              <Ambulance className="h-8 w-8 text-emergency-red" />
              <span className="text-sm font-medium">Ambulance</span>
            </div>
            <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-muted/30 p-4">
              <Shield className="h-8 w-8 text-emergency-blue" />
              <span className="text-sm font-medium">Police</span>
            </div>
          </div>
          <Button
            onClick={login}
            disabled={isLoggingIn}
            size="lg"
            className="w-full bg-gradient-to-r from-emergency-blue to-emergency-red hover:opacity-90"
          >
            {isLoggingIn ? 'Connecting...' : 'Login to Continue'}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Secure authentication via Internet Identity
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
