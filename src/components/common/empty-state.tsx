import * as React from 'react';
import { PackageOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  title?: string;
  description?: string;
  /** Optional custom icon; defaults to an open package. */
  icon?: React.ReactNode;
  /** Optional action (e.g. a "Browse all" link/button). */
  action?: React.ReactNode;
  className?: string;
}

/**
 * Storefront empty state — shown when a query succeeds but returns nothing (no
 * products in the catalogue, no search matches, an empty category). Uses the
 * storefront's pill/rounded-2xl system; the admin has its own tighter-radius
 * `EmptyState` on purpose.
 */
export function EmptyState({
  title = 'Nothing here yet',
  description = 'There are no items to show right now. Please check back soon.',
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'border-border flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed px-6 py-16 text-center',
        className
      )}
    >
      <span className="bg-secondary text-muted-foreground flex size-12 items-center justify-center rounded-full">
        {icon ?? <PackageOpen className="size-6" />}
      </span>
      <div className="flex flex-col gap-1.5">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-muted-foreground max-w-sm text-sm text-pretty">{description}</p>
      </div>
      {action}
    </div>
  );
}
