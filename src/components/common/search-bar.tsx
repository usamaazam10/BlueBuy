'use client';

import * as React from 'react';
import Link from 'next/link';
import { Search, ArrowRight } from 'lucide-react';
import type { Product } from '@/types';
import { PRODUCTS } from '@/data/products';
import { formatPrice } from '@/lib/format';
import { Modal } from '@/components/ui/modal';
import { ProductMedia } from '@/components/product/product-media';

function filterProducts(query: string): Product[] {
  const q = query.trim().toLowerCase();
  if (!q) return PRODUCTS.slice(0, 5);
  return PRODUCTS.filter(
    (p) =>
      p.title.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q)
  ).slice(0, 6);
}

interface SearchBarProps {
  open: boolean;
  onClose: () => void;
}

/** Command-palette style search over the local product catalogue. */
export function SearchBar({ open, onClose }: SearchBarProps) {
  const [query, setQuery] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const results = React.useMemo(() => filterProducts(query), [query]);

  React.useEffect(() => {
    if (open) {
      setQuery('');
      // Focus the input shortly after the modal mounts.
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} align="top" title="Search products" hideCloseButton>
      <div className="border-border flex items-center gap-3 border-b px-4">
        <Search className="text-muted-foreground size-5 shrink-0" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for products, categories..."
          aria-label="Search products"
          className="placeholder:text-muted-foreground h-14 w-full bg-transparent text-base outline-none"
        />
        <kbd className="text-muted-foreground border-border hidden rounded border px-1.5 py-0.5 text-[11px] font-medium sm:inline-block">
          Esc
        </kbd>
      </div>

      <div className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
        {results.length === 0 ? (
          <p className="text-muted-foreground px-3 py-10 text-center text-sm">
            No products match “{query}”.
          </p>
        ) : (
          <ul className="flex flex-col">
            {results.map((product) => (
              <li key={product.id}>
                <Link
                  href={`/product/${product.slug}`}
                  onClick={onClose}
                  className="hover:bg-secondary focus-visible:bg-secondary group flex items-center gap-3 rounded-xl px-3 py-2.5 outline-none"
                >
                  <ProductMedia
                    seed={product.images[0]}
                    accent={product.accent}
                    className="size-11 shrink-0 rounded-lg"
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{product.title}</span>
                    <span className="text-muted-foreground text-xs capitalize">
                      {product.category.replace('-', ' ')} · {formatPrice(product.price)}
                    </span>
                  </span>
                  <ArrowRight className="text-muted-foreground size-4 opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
