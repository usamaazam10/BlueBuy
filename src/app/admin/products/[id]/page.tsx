import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductForm, type ProductFormValues } from '@/components/admin/products/product-form';
import { ADMIN_PRODUCTS, getAdminProductById } from '@/data/admin/products';
import { getProductBySlug } from '@/data/products';
import type { AdminProduct } from '@/data/admin/types';

/** Pre-render an edit page per product (required for `output: export`). */
export function generateStaticParams() {
  return ADMIN_PRODUCTS.map((product) => ({ id: product.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = getAdminProductById(id);
  return { title: product ? `Edit · ${product.title}` : 'Edit product' };
}

/** Builds editor form values, enriching admin data with storefront copy/specs. */
function toFormValues(product: AdminProduct): ProductFormValues {
  const storefront = getProductBySlug(product.slug);
  return {
    title: product.title,
    slug: product.slug,
    shortDescription: storefront?.highlights[0] ?? '',
    description: storefront?.description ?? '',
    price: String(product.price),
    salePrice: product.compareAtPrice ? String(product.price) : '',
    stock: String(product.stock),
    categorySlug: product.category,
    brandId: product.brandId,
    featured: product.featured,
    active: product.status === 'active',
    tags: storefront?.highlights.slice(0, 3).map((h) => h.split(' ')[0].toLowerCase()) ?? [
      product.category,
    ],
    specs: (storefront?.specs ?? []).map((spec, index) => ({
      id: `spec-${index}`,
      label: spec.label,
      value: spec.value,
    })),
    seoTitle: `${product.title} | BlueBuy`,
    seoDescription: storefront?.description.slice(0, 155) ?? '',
    metaKeywords: '',
    images: product.images.map((seed) => ({ id: seed, seed, accent: product.accent })),
  };
}

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = getAdminProductById(id);
  if (!product) notFound();

  return <ProductForm mode="edit" initial={toFormValues(product)} productAccent={product.accent} />;
}
