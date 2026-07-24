import type { Metadata } from 'next';
import { ADMIN_PRODUCTS } from '@/data/admin/products';
import { EditProductClient } from '@/components/admin/products/edit-product-client';

/**
 * Pre-render an edit page per known product id (required for `output: export`).
 *
 * Note: this enumerates the *seeded* catalogue ids. Products created at runtime
 * in Firestore get a new id that isn't in this list, so a hard navigation to
 * their edit URL isn't statically generated — an inherent static-export
 * trade-off. In-app navigation (client routing) still works. See
 * PRODUCT_MANAGEMENT.md. Actual product data is loaded live by EditProductClient.
 */
export function generateStaticParams() {
  return ADMIN_PRODUCTS.map((product) => ({ id: product.id }));
}

export const metadata: Metadata = { title: 'Edit product' };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditProductClient id={id} />;
}
