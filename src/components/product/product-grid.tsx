import type { StoreProduct } from '@/types/store';
import { cn } from '@/lib/utils';
import { Stagger, StaggerItem } from '@/components/common/motion';
import { ProductCard } from './product-card';

interface ProductGridProps {
  products: StoreProduct[];
  className?: string;
}

export function ProductGrid({ products, className }: ProductGridProps) {
  return (
    <Stagger
      trigger="mount"
      className={cn(
        'grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
        className
      )}
    >
      {products.map((product) => (
        <StaggerItem key={product.id} className="flex">
          <ProductCard product={product} className="w-full" />
        </StaggerItem>
      ))}
    </Stagger>
  );
}
