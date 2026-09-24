import type { StoreProduct } from '@/types/store';
import { cn } from '@/lib/utils';
import { ProductCard } from './product-card';

interface ProductShelfProps {
  products: StoreProduct[];
  className?: string;
}

/**
 * A single row of product cards: swipeable (scroll-snap) on phones and
 * tablets, a five-up grid on desktop — so a homepage shelf is always exactly
 * one row, never a tall wall of cards.
 */
export function ProductShelf({ products, className }: ProductShelfProps) {
  return (
    <div
      className={cn(
        '-mx-5 flex snap-x snap-mandatory scroll-px-5 [scrollbar-width:none] gap-4 overflow-x-auto px-5 pt-1 pb-3 sm:-mx-8 sm:scroll-px-8 sm:px-8 lg:mx-0 lg:grid lg:grid-cols-5 lg:overflow-visible lg:px-0 lg:pb-0 [&::-webkit-scrollbar]:hidden',
        className
      )}
    >
      {products.map((product) => (
        <div
          key={product.id}
          className="flex w-[46%] shrink-0 snap-start sm:w-[31%] md:w-[23.5%] lg:w-auto"
        >
          <ProductCard product={product} className="w-full" />
        </div>
      ))}
    </div>
  );
}
