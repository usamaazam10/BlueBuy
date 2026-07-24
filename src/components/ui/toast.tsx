'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Visual tone of a toast. */
export type ToastVariant = 'success' | 'error' | 'info';

interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** Auto-dismiss delay in ms. Defaults to 4000; pass 0 to require manual close. */
  duration?: number;
}

interface ToastRecord extends Required<Omit<ToastOptions, 'description'>> {
  id: string;
  description?: string;
}

interface ToastContextValue {
  /** Show a toast; returns its id. */
  toast: (options: ToastOptions) => string;
  /** Convenience helpers. */
  success: (title: string, description?: string) => string;
  error: (title: string, description?: string) => string;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

/** Access the toast API. Must be used within a {@link ToastProvider}. */
export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a <ToastProvider>');
  return ctx;
}

const VARIANT_META: Record<
  ToastVariant,
  { Icon: typeof CheckCircle2; iconClass: string; role: 'status' | 'alert' }
> = {
  success: {
    Icon: CheckCircle2,
    iconClass: 'text-emerald-600 dark:text-emerald-400',
    role: 'status',
  },
  error: { Icon: XCircle, iconClass: 'text-rose-600 dark:text-rose-400', role: 'alert' },
  info: { Icon: Info, iconClass: 'text-brand', role: 'status' },
};

/**
 * Provides the toast API to its subtree and renders the toast stack in a portal.
 * Mount once near the root of a surface (e.g. the admin shell).
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastRecord[]>([]);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = React.useCallback(
    ({ title, description, variant = 'info', duration = 4000 }: ToastOptions) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, title, description, variant, duration }]);
      if (duration > 0) window.setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss]
  );

  const value = React.useMemo<ToastContextValue>(
    () => ({
      toast,
      dismiss,
      success: (title, description) => toast({ title, description, variant: 'success' }),
      error: (title, description) =>
        toast({ title, description, variant: 'error', duration: 6000 }),
    }),
    [toast, dismiss]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted &&
        createPortal(
          <div
            aria-live="polite"
            className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end"
          >
            <AnimatePresence initial={false}>
              {toasts.map((t) => {
                const { Icon, iconClass, role } = VARIANT_META[t.variant];
                return (
                  <motion.div
                    key={t.id}
                    role={role}
                    layout
                    initial={{ opacity: 0, y: 12, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    className="border-border bg-card text-card-foreground pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border p-3.5 shadow-lg"
                  >
                    <Icon className={cn('mt-0.5 size-5 shrink-0', iconClass)} />
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground text-sm font-medium">{t.title}</p>
                      {t.description && (
                        <p className="text-muted-foreground mt-0.5 text-sm text-pretty">
                          {t.description}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => dismiss(t.id)}
                      aria-label="Dismiss notification"
                      className="text-muted-foreground hover:bg-secondary hover:text-foreground -m-1 flex size-7 shrink-0 items-center justify-center rounded-md transition-colors"
                    >
                      <X className="size-4" />
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}
