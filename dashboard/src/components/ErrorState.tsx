import { AlertCircle } from 'lucide-react';
import { Button } from './Button';

interface ErrorStateProps {
  error: string;
  onRetry?: () => void;
}

export function ErrorState({ error, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <AlertCircle size={40} className="text-red-400 mb-3" />
      <p className="text-sm text-gray-600 mt-1 max-w-sm">{error}</p>
      {onRetry && (
        <div className="mt-4">
          <Button variant="secondary" onClick={onRetry}>Retry</Button>
        </div>
      )}
    </div>
  );
}
