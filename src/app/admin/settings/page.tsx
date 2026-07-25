import type { Metadata } from 'next';
import { PageHeader } from '@/components/admin/ui/page-header';
import { SiteSettingsForm } from '@/components/admin/cms/site-settings-form';

export const metadata: Metadata = { title: 'Settings' };

export default function SettingsPage() {
  return (
    <div>
      <PageHeader
        title="Site settings"
        description="Store identity, branding, support details and regional defaults."
        breadcrumb={[{ label: 'Admin', href: '/admin' }, { label: 'Settings' }]}
      />
      <SiteSettingsForm />
    </div>
  );
}
