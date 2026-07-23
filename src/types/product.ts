export type ProductBadge = 'New' | 'Sale' | 'Bestseller' | 'Limited';

export interface ProductSpec {
  label: string;
  value: string;
}

export interface Product {
  id: string;
  slug: string;
  title: string;
  price: number;
  /** Original price, shown struck-through when a product is on sale. */
  compareAtPrice?: number;
  category: string;
  /** Average rating, 0–5. */
  rating: number;
  reviewCount: number;
  description: string;
  /** Placeholder media seeds — no stock images are used (see ProductMedia). */
  images: string[];
  badge?: ProductBadge;
  stock: number;
  /** Accent color (hex) used to generate the product's placeholder artwork. */
  accent: string;
  specs: ProductSpec[];
  /** Short marketing highlights shown on the details page. */
  highlights: string[];
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string;
  accent: string;
  /** Number of products, precomputed for display. */
  count: number;
}
