import { cn } from '@/lib/utils';
import { ProductCardSkeleton } from './product-card-skeleton';

interface ProductGridSkeletonProps {
  /** How many card skeletons to render. */
  count?: number;
  className?: string;
}

/** A grid of {@link ProductCardSkeleton}s matching {@link ProductGrid}'s layout. */
export function ProductGridSkeleton({ count = 8, className }: ProductGridSkeletonProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
        className
      )}
      role="status"
      aria-label="Loading products"
    >
      {Array.from({ length: count }).map((_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </div>
  );
}
