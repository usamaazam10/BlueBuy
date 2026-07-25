import type { Metadata } from 'next';
import { PageHeader } from '@/components/admin/ui/page-header';
import { NavigationManager } from '@/components/admin/cms/navigation-manager';

export const metadata: Metadata = { title: 'Navigation' };

export default function NavigationCmsPage() {
  return (
    <div>
      <PageHeader
        title="Navigation"
        description="Manage the primary menu items shown in the storefront header."
        breadcrumb={[
          { label: 'Admin', href: '/admin' },
          { label: 'Content' },
          { label: 'Navigation' },
        ]}
      />
      <NavigationManager />
    </div>
  );
}
