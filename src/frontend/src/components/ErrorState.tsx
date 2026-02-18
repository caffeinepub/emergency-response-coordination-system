import { Button } from './ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';

interface ErrorStateProps {
  title?: string;
  message: string;
  error?: Error | null;
  onRetry?: () => void;
  showReload?: boolean;
}

export default function ErrorState({ 
  title = 'Something went wrong',
  message, 
  error, 
  onRetry,
  showReload = true 
}: ErrorStateProps) {
  const handleReload = () => {
    window.location.reload();
  };

  // Extract additional context if available
  const errorContext = (error as any)?.context;
  const originalError = (error as any)?.originalError;
  const errorType = (error as any)?.errorType;

  // Classify error type for better messaging
  const isNetworkError = error?.message?.includes('network') || error?.message?.includes('fetch');
  const isAuthError = 
    error?.message?.includes('Unauthorized') || 
    error?.message?.includes('Anonymous') ||
    error?.message?.includes('permission') ||
    errorType === 'AUTHORIZATION_ERROR';
  const isBackendError = error?.message?.includes('Actor') || error?.message?.includes('canister');

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-red-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4">
      <div className="max-w-md w-full space-y-4">
        <Alert className="border-destructive bg-destructive/10">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-semibold">{title}</p>
              <p className="text-sm">{message}</p>
              
              {/* Error classification hints */}
              {isNetworkError && (
                <p className="text-xs text-muted-foreground mt-2">
                  💡 This appears to be a network connectivity issue. Check your internet connection.
                </p>
              )}
              {isAuthError && (
                <p className="text-xs text-muted-foreground mt-2">
                  💡 This appears to be an authorization issue. You may need to set up your profile or log in again.
                </p>
              )}
              {isBackendError && (
                <p className="text-xs text-muted-foreground mt-2">
                  💡 This appears to be a backend connectivity issue. The service may be temporarily unavailable.
                </p>
              )}
            </div>
          </AlertDescription>
        </Alert>

        {error && (
          <details className="rounded-lg border border-border bg-card p-4">
            <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
              Technical details
            </summary>
            <div className="mt-2 space-y-3">
              <div className="text-xs bg-muted p-3 rounded">
                <div className="font-semibold mb-1">Error Message:</div>
                <div className="text-destructive">{error.message}</div>
              </div>

              {errorType && (
                <div className="text-xs bg-muted p-3 rounded">
                  <div className="font-semibold mb-1">Error Type:</div>
                  <div className="font-mono">{errorType}</div>
                </div>
              )}

              {errorContext && (
                <div className="text-xs bg-muted p-3 rounded">
                  <div className="font-semibold mb-1">Context:</div>
                  <pre className="overflow-auto max-h-32 text-[10px]">
                    {JSON.stringify(errorContext, null, 2)}
                  </pre>
                </div>
              )}

              {originalError && (
                <div className="text-xs bg-muted p-3 rounded">
                  <div className="font-semibold mb-1">Original Error:</div>
                  <div className="text-destructive">{String(originalError)}</div>
                </div>
              )}

              {error.stack && (
                <div className="text-xs bg-muted p-3 rounded">
                  <div className="font-semibold mb-1">Stack Trace:</div>
                  <pre className="overflow-auto max-h-40 text-[10px]">
                    {error.stack}
                  </pre>
                </div>
              )}

              <div className="text-xs bg-muted p-3 rounded">
                <div className="font-semibold mb-1">Timestamp:</div>
                <div>{new Date().toISOString()}</div>
              </div>
            </div>
          </details>
        )}

        <div className="flex gap-2">
          {onRetry && (
            <Button onClick={onRetry} variant="default" className="flex-1">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          )}
          {showReload && (
            <Button onClick={handleReload} variant="outline" className="flex-1">
              Reload Page
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
