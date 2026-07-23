import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCompact } from '@/lib/format';

interface RatingProps {
  value: number;
  reviewCount?: number;
  size?: 'sm' | 'md';
  className?: string;
  showValue?: boolean;
}

/** Accessible star rating with partial-fill support via a clipped overlay. */
export function Rating({
  value,
  reviewCount,
  size = 'sm',
  className,
  showValue = true,
}: RatingProps) {
  const clamped = Math.max(0, Math.min(5, value));
  const percent = (clamped / 5) * 100;
  const starSize = size === 'sm' ? 'size-3.5' : 'size-4';

  return (
    <div
      className={cn('flex items-center gap-1.5', className)}
      role="img"
      aria-label={`Rated ${clamped.toFixed(1)} out of 5${
        reviewCount ? ` from ${reviewCount} reviews` : ''
      }`}
    >
      <span className="relative inline-flex">
        <span className="text-muted-foreground/30 flex gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className={cn(starSize, 'fill-current')} />
          ))}
        </span>
        <span
          className="absolute inset-0 flex gap-0.5 overflow-hidden text-amber-400"
          style={{ width: `${percent}%` }}
          aria-hidden="true"
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className={cn(starSize, 'shrink-0 fill-current')} />
          ))}
        </span>
      </span>
      {showValue && (
        <span className="text-muted-foreground text-xs font-medium">
          {clamped.toFixed(1)}
          {reviewCount !== undefined && (
            <span className="text-muted-foreground/70"> ({formatCompact(reviewCount)})</span>
          )}
        </span>
      )}
    </div>
  );
}
