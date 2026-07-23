import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Optional call-to-action (e.g. an "Add product" button). */
  action?: React.ReactNode;
  className?: string;
}

/** Centered empty/zero-data placeholder used across tables and lists. */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center px-6 py-16 text-center', className)}
    >
      <div className="border-border bg-secondary text-muted-foreground flex size-12 items-center justify-center rounded-xl border">
        <Icon className="size-6" />
      </div>
      <h3 className="text-foreground mt-4 text-sm font-semibold">{title}</h3>
      {description && (
        <p className="text-muted-foreground mt-1 max-w-sm text-sm text-pretty">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
