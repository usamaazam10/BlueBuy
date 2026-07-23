import type { Metadata } from 'next';
import { ProductForm, EMPTY_PRODUCT } from '@/components/admin/products/product-form';

export const metadata: Metadata = { title: 'New product' };

export default function NewProductPage() {
  return <ProductForm mode="create" initial={EMPTY_PRODUCT} />;
}
