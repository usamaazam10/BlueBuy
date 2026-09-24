import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ShelfHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Optional "View all" destination. */
  href?: string;
  linkLabel?: string;
  /** Leading icon/visual rendered before the title. */
  icon?: React.ReactNode;
  className?: string;
}

/**
 * Compact, left-aligned section header for homepage product shelves: a bold
 * title with an optional one-line description, and a "View all" link on the
 * right — the marketplace pattern shoppers scan quickly.
 */
export function ShelfHeader({
  title,
  description,
  href,
  linkLabel = 'View all',
  icon,
  className,
}: ShelfHeaderProps) {
  return (
    <div className={cn('flex items-end justify-between gap-4', className)}>
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="font-display flex items-center gap-2.5 text-xl font-bold tracking-tight sm:text-2xl">
          {icon}
          {title}
        </h2>
        {description && (
          <p className="text-muted-foreground line-clamp-1 text-sm sm:text-[0.94rem]">
            {description}
          </p>
        )}
      </div>
      {href && (
        <Link
          href={href}
          className="text-brand hover:bg-brand/10 focus-visible:ring-ring group flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors outline-none focus-visible:ring-2"
        >
          {linkLabel}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}
