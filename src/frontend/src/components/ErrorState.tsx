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

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-red-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4">
      <div className="max-w-md w-full space-y-4">
        <Alert className="border-destructive bg-destructive/10">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-semibold">{title}</p>
              <p className="text-sm">{message}</p>
            </div>
          </AlertDescription>
        </Alert>

        {error && (
          <details className="rounded-lg border border-border bg-card p-4">
            <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
              Technical details
            </summary>
            <pre className="mt-2 text-xs bg-muted p-3 rounded overflow-auto max-h-40">
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
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
