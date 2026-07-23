import type { Metadata } from 'next';
import { PageHeader } from '@/components/admin/ui/page-header';
import { CategoriesManager } from '@/components/admin/categories/categories-manager';

export const metadata: Metadata = { title: 'Categories' };

export default function CategoriesPage() {
  return (
    <div>
      <PageHeader
        title="Categories"
        description="Group products into browsable collections."
        breadcrumb={[{ label: 'Admin', href: '/admin' }, { label: 'Categories' }]}
      />
      <CategoriesManager />
    </div>
  );
}
