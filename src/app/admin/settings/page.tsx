import type { Metadata } from 'next';
import { Settings } from 'lucide-react';
import { PlaceholderPage } from '@/components/admin/ui/placeholder-page';

export const metadata: Metadata = { title: 'Settings' };

export default function SettingsPage() {
  return (
    <PlaceholderPage
      title="Settings"
      description="Configure your store, team and preferences."
      icon={Settings}
      breadcrumb={[{ label: 'Admin', href: '/admin' }, { label: 'Settings' }]}
      comingSoon="Store details, tax, shipping and team permissions will be configurable here."
    />
  );
}
