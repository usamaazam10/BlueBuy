import { cn } from '@/lib/utils';

/** Loading placeholder that mirrors {@link ProductCard}'s footprint. */
export function ProductCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'bg-card border-border flex flex-col overflow-hidden rounded-2xl border',
        className
      )}
      aria-hidden="true"
    >
      <div className="bg-muted aspect-square w-full animate-pulse" />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="bg-muted h-3 w-16 animate-pulse rounded-full" />
        <div className="bg-muted h-4 w-3/4 animate-pulse rounded-full" />
        <div className="bg-muted h-3 w-24 animate-pulse rounded-full" />
        <div className="mt-auto flex items-center gap-2 pt-1">
          <div className="bg-muted h-5 w-16 animate-pulse rounded-full" />
        </div>
        <div className="bg-muted mt-1 h-9 w-full animate-pulse rounded-full" />
      </div>
    </div>
  );
}
