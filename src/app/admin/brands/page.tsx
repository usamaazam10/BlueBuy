import type { Metadata } from 'next';
import { PageHeader } from '@/components/admin/ui/page-header';
import { BrandsManager } from '@/components/admin/brands/brands-manager';

export const metadata: Metadata = { title: 'Brands' };

export default function BrandsPage() {
  return (
    <div>
      <PageHeader
        title="Brands"
        description="Manage the manufacturers behind your products."
        breadcrumb={[{ label: 'Admin', href: '/admin' }, { label: 'Brands' }]}
      />
      <BrandsManager />
    </div>
  );
}
