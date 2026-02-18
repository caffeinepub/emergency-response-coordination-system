import { Button } from './ui/button';
import { AlertTriangle } from 'lucide-react';

interface CrashFallbackProps {
  error: Error | null;
  errorInfo?: React.ErrorInfo | null;
}

export default function CrashFallback({ error, errorInfo }: CrashFallbackProps) {
  const handleReload = () => {
    console.log('[CrashFallback] User initiated reload');
    window.location.reload();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-red-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4">
      <div className="max-w-md w-full bg-card border border-border rounded-lg shadow-lg p-8">
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Application Error</h1>
            <p className="text-muted-foreground">
              Something went wrong while loading the application. Please reload the page to try again.
            </p>
          </div>

          {error && (
            <details className="w-full text-left">
              <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                Technical details
              </summary>
              <div className="mt-2 space-y-2">
                <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-32">
                  {error.name}: {error.message}
                </pre>
                {error.stack && (
                  <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-32">
                    {error.stack}
                  </pre>
                )}
                {errorInfo?.componentStack && (
                  <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-32">
                    {errorInfo.componentStack}
                  </pre>
                )}
              </div>
            </details>
          )}

          <Button onClick={handleReload} size="lg" className="w-full">
            Reload Application
          </Button>
        </div>
      </div>
    </div>
  );
}
