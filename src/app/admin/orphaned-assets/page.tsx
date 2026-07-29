import type { Metadata } from 'next';
import { PageHeader } from '@/components/admin/ui/page-header';
import { OrphanedAssetsManager } from '@/components/admin/orphaned-assets/orphaned-assets-manager';

export const metadata: Metadata = { title: 'Media cleanup' };

export default function OrphanedAssetsPage() {
  return (
    <div>
      <PageHeader
        title="Media cleanup"
        description="Cloudinary assets left behind when products, categories or brands were deleted or their images replaced."
        breadcrumb={[{ label: 'Admin', href: '/admin' }, { label: 'Media cleanup' }]}
      />
      <OrphanedAssetsManager />
    </div>
  );
}
