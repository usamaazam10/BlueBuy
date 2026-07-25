import type { Metadata } from 'next';
import { PageHeader } from '@/components/admin/ui/page-header';
import { BannersManager } from '@/components/admin/cms/banners-manager';

export const metadata: Metadata = { title: 'Banners' };

export default function BannersCmsPage() {
  return (
    <div>
      <PageHeader
        title="Banners"
        description="Announcement banners shown at the top of the storefront."
        breadcrumb={[
          { label: 'Admin', href: '/admin' },
          { label: 'Content' },
          { label: 'Banners' },
        ]}
      />
      <BannersManager />
    </div>
  );
}
