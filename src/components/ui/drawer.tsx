'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMounted } from '@/hooks/use-mounted';
import { useBodyScrollLock } from '@/hooks/use-body-scroll-lock';
import { useFocusTrap } from '@/hooks/use-focus-trap';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  side?: 'left' | 'right';
  className?: string;
}

/** Accessible, animated slide-over panel rendered in a portal. */
export function Drawer({ open, onClose, children, title, side = 'right', className }: DrawerProps) {
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

  const offscreen = side === 'right' ? '100%' : '-100%';

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div
            className="bg-foreground/40 absolute inset-0 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.aside
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            initial={{ x: offscreen }}
            animate={{ x: 0 }}
            exit={{ x: offscreen }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              'bg-card text-card-foreground border-border absolute inset-y-0 flex w-full max-w-sm flex-col shadow-2xl outline-none',
              side === 'right' ? 'right-0 border-l' : 'left-0 border-r',
              className
            )}
          >
            {title && (
              <header className="border-border flex items-center justify-between border-b px-5 py-4">
                <h2 className="text-base font-semibold">{title}</h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close panel"
                  className="text-muted-foreground hover:bg-secondary hover:text-foreground flex size-9 items-center justify-center rounded-full transition-colors"
                >
                  <X className="size-4" />
                </button>
              </header>
            )}
            {children}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
