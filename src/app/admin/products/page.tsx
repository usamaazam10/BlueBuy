import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/admin/ui/page-header';
import { ProductsBrowser } from '@/components/admin/products/products-browser';

export const metadata: Metadata = { title: 'Products' };

export default function ProductsPage() {
  return (
    <div>
      <PageHeader
        title="Products"
        description="Manage your catalogue — search, filter and edit listings."
        breadcrumb={[{ label: 'Admin', href: '/admin' }, { label: 'Products' }]}
        actions={
          <Button asChild size="sm" variant="brand" className="rounded-lg">
            <Link href="/admin/products/new">
              <Plus className="size-4" /> Add product
            </Link>
          </Button>
        }
      />
      <Suspense fallback={null}>
        <ProductsBrowser />
      </Suspense>
    </div>
  );
}
