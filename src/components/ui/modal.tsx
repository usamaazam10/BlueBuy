'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMounted } from '@/hooks/use-mounted';
import { useBodyScrollLock } from '@/hooks/use-body-scroll-lock';
import { useFocusTrap } from '@/hooks/use-focus-trap';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  /** Hide the default close button (e.g. for a custom header). */
  hideCloseButton?: boolean;
  className?: string;
  /** Align the panel to the top instead of centering (good for search). */
  align?: 'center' | 'top';
}

/** Accessible, animated centered dialog rendered in a portal. */
export function Modal({
  open,
  onClose,
  children,
  title,
  hideCloseButton = false,
  className,
  align = 'center',
}: ModalProps) {
  const mounted = useMounted();
  const panelRef = React.useRef<HTMLDivElement>(null);

  useBodyScrollLock(open);
  useFocusTrap(panelRef, open);

  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className={cn(
            'fixed inset-0 z-50 flex justify-center p-4',
            align === 'center' ? 'items-center' : 'items-start pt-[10vh]'
          )}
        >
          <motion.div
            className="bg-foreground/40 absolute inset-0 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              'bg-card text-card-foreground border-border relative z-10 w-full max-w-lg rounded-2xl border shadow-2xl outline-none',
              className
            )}
          >
            {!hideCloseButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="text-muted-foreground hover:bg-secondary hover:text-foreground absolute top-3 right-3 z-10 flex size-9 items-center justify-center rounded-full transition-colors"
              >
                <X className="size-4" />
              </button>
            )}
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
