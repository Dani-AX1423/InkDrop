'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, Info, AlertTriangle, AlertCircle, X } from 'lucide-react';

export type ToastType = 'success' | 'info' | 'warning' | 'error';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextType {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, 'id'>) => string;
  removeToast: (id: string) => void;
  toast: {
    success: (message: string, title?: string, duration?: number) => string;
    info: (message: string, title?: string, duration?: number) => string;
    warning: (message: string, title?: string, duration?: number) => string;
    error: (message: string, title?: string, duration?: number) => string;
  };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    ({ type, title, message, duration = 3500 }: Omit<ToastItem, 'id'>) => {
      const id = 'toast_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      const newToast: ToastItem = { id, type, title, message, duration };

      setToasts((prev) => [...prev.slice(-3), newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
      return id;
    },
    [removeToast]
  );

  const toastHelpers = {
    success: useCallback(
      (message: string, title?: string, duration?: number) =>
        addToast({ type: 'success', title, message, duration }),
      [addToast]
    ),
    info: useCallback(
      (message: string, title?: string, duration?: number) =>
        addToast({ type: 'info', title, message, duration }),
      [addToast]
    ),
    warning: useCallback(
      (message: string, title?: string, duration?: number) =>
        addToast({ type: 'warning', title, message, duration }),
      [addToast]
    ),
    error: useCallback(
      (message: string, title?: string, duration?: number) =>
        addToast({ type: 'error', title, message, duration }),
      [addToast]
    ),
  };

  return (
    <ToastContext.Provider
      value={{
        toasts,
        addToast,
        removeToast,
        toast: toastHelpers,
      }}
    >
      {children}
      <ToastViewport toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      toasts: [],
      addToast: () => '',
      removeToast: () => {},
      toast: {
        success: () => '',
        info: () => '',
        warning: () => '',
        error: () => '',
      },
    };
  }
  return context;
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  if (!mounted || toasts.length === 0) return null;

  const content = (
    <div
      aria-live="polite"
      role="region"
      aria-label="Notifications"
      className="fixed bottom-4 sm:bottom-6 right-4 sm:right-6 z-[120] flex flex-col gap-2.5 max-w-[calc(100vw-32px)] sm:max-w-sm pointer-events-none"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );

  return createPortal(content, document.body);
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: () => void;
}) {
  const { type, title, message } = toast;

  const icons = {
    success: <Check className="h-4 w-4 text-ink-teal" strokeWidth={1.5} />,
    info: <Info className="h-4 w-4 text-ink-indigo" strokeWidth={1.5} />,
    warning: <AlertTriangle className="h-4 w-4 text-ink-amber" strokeWidth={1.5} />,
    error: <AlertCircle className="h-4 w-4 text-ink-rose" strokeWidth={1.5} />,
  };

  const borders = {
    success: 'border-ink-teal/35 bg-surface-elevated/95',
    info: 'border-ink-indigo/35 bg-surface-elevated/95',
    warning: 'border-ink-amber/35 bg-surface-elevated/95',
    error: 'border-ink-rose/35 bg-surface-elevated/95',
  };

  return (
    <div
      role="status"
      className={`pointer-events-auto relative flex items-start gap-3 rounded-2xl border p-3.5 sm:p-4 shadow-xl backdrop-blur-md animate-fade-in transition-opacity transition-transform duration-150 ${borders[type]}`}
    >
      <div className="shrink-0 mt-0.5 rounded-lg p-1 bg-surface-base border border-surface-border">
        {icons[type]}
      </div>

      <div className="flex-1 min-w-0 pr-1">
        {title && (
          <h4 className="font-display text-xs font-semibold text-paper-white tracking-tight">
            {title}
          </h4>
        )}
        <p className="font-body text-xs text-paper-muted leading-relaxed [overflow-wrap:anywhere]">
          {message}
        </p>
      </div>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="shrink-0 p-1 rounded-lg text-paper-muted hover:text-paper-white hover:bg-surface-base transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
      >
        <X className="h-3.5 w-3.5" strokeWidth={1.5} />
      </button>
    </div>
  );
}
