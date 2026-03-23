import { CheckCircle2, X, XCircle } from 'lucide-react';
import type { Toast as ToastType } from '../context/ToastContext';

interface ToastProps {
  toast: ToastType;
  onDismiss: (id: string) => void;
}

export function Toast({ toast, onDismiss }: ToastProps) {
  const isSuccess = toast.type === 'success';

  return (
    <div
      className={`pointer-events-auto rounded-lg border shadow-md px-4 py-3 flex items-start gap-3 text-sm font-medium ${
        isSuccess
          ? 'bg-green-50 border-green-200 text-green-800'
          : 'bg-red-50 border-red-200 text-red-800'
      }`}
    >
      {isSuccess ? (
        <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
      ) : (
        <XCircle size={16} className="shrink-0 mt-0.5" />
      )}
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}
