'use client';

import { AlertTriangle, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ErrorStateProps {
  /** Short heading. */
  title?: string;
  /** Friendly, non-technical explanation. */
  description?: string;
  /** When provided, renders a "Try again" button wired to it. */
  onRetry?: () => void;
  className?: string;
}

/**
 * Friendly, reusable failure state for data that couldn't load (e.g. Firestore
 * was unreachable). Never surfaces raw error text — the repository layer already
 * normalises errors; here we just reassure and offer a retry.
 */
export function ErrorState({
  title = 'Something went wrong',
  description = 'We couldn’t load this right now. Please check your connection and try again.',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'border-border flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed px-6 py-16 text-center',
        className
      )}
    >
      <span className="bg-destructive/10 text-destructive flex size-12 items-center justify-center rounded-full">
        <AlertTriangle className="size-6" />
      </span>
      <div className="flex flex-col gap-1.5">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-muted-foreground max-w-sm text-sm text-pretty">{description}</p>
      </div>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} className="mt-1">
          <RotateCcw className="size-4" /> Try again
        </Button>
      )}
    </div>
  );
}
