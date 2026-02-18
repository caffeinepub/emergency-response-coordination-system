import { Loader2 } from 'lucide-react';

interface LoadingFallbackProps {
  message?: string;
}

export default function LoadingFallback({ message = 'Loading...' }: LoadingFallbackProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-red-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-emergency-blue" />
        <p className="text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
