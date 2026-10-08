import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

export type ToastKind = 'success' | 'error' | 'info';
export interface ToastMessage { id: number; kind: ToastKind; text: string }

export const Toast: React.FC<{ toast: ToastMessage | null; onClose: () => void }> = ({ toast, onClose }) => {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onClose, toast.kind === 'error' ? 7000 : 4500);
    return () => clearTimeout(timer);
  }, [toast?.id]);

  const styles: Record<ToastKind, string> = {
    success: 'bg-decision-green text-white',
    error: 'bg-decision-red text-white',
    info: 'bg-ink text-paper',
  };
  const Icon = toast?.kind === 'success' ? CheckCircle : toast?.kind === 'error' ? AlertCircle : Info;

  return (
    <div className="fixed top-20 left-0 right-0 z-[200] flex justify-center px-4 pointer-events-none" role="status" aria-live="polite">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className={`pointer-events-auto max-w-md w-full rounded-2xl shadow-2xl px-4 py-3 flex items-start gap-3 text-sm ${styles[toast.kind]}`}
            data-testid={`toast-${toast.kind}`}
          >
            <Icon className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="flex-1 leading-snug">{toast.text}</p>
            <button onClick={onClose} aria-label="Dismiss" className="opacity-70 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
