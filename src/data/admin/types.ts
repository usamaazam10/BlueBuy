/**
 * UI-facing types for the admin dashboard.
 *
 * These deliberately sit apart from the Firestore models in `@/types/models`.
 * The admin is a UI-only prototype backed by local mock data, so these shapes
 * describe exactly what the screens render — nothing more.
 */

export type ProductStatus = 'active' | 'draft' | 'archived';

/** A merchandising brand shown in the Brands manager and product editor. */
export interface Brand {
  id: string;
  slug: string;
  name: string;
  description: string;
  website?: string;
  /** Hex accent used to seed the placeholder logo artwork. */
  accent: string;
  productCount: number;
  active: boolean;
}

/** A catalogue category as edited in the admin (extends the storefront shape). */
export interface AdminCategory {
  id: string;
  slug: string;
  name: string;
  description: string;
  accent: string;
  productCount: number;
  active: boolean;
}

/** The product row/record the admin works with (mock, UI-only). */
export interface AdminProduct {
  id: string;
  slug: string;
  title: string;
  /** Category slug — references an {@link AdminCategory}. */
  category: string;
  /** Brand id — references a {@link Brand}. */
  brandId: string;
  price: number;
  /** Original price; when set the product is shown as on sale. */
  compareAtPrice?: number;
  stock: number;
  status: ProductStatus;
  featured: boolean;
  /** Hex accent used to seed the placeholder product artwork. */
  accent: string;
  /** Placeholder art seeds (no stock photography). */
  images: string[];
  /** ISO timestamp of the last edit. */
  updatedAt: string;
}

export type ActivityKind = 'product' | 'order' | 'category' | 'brand' | 'customer';

/** A single entry in the dashboard's recent-activity feed. */
export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  /** Short headline, e.g. "New product published". */
  title: string;
  /** Secondary detail, e.g. the affected record's name. */
  detail: string;
  /** Human-readable relative time, e.g. "2h ago". */
  time: string;
}
