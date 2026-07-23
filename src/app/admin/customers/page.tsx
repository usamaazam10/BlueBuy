import type { Metadata } from 'next';
import { Users } from 'lucide-react';
import { PlaceholderPage } from '@/components/admin/ui/placeholder-page';

export const metadata: Metadata = { title: 'Customers' };

export default function CustomersPage() {
  return (
    <PlaceholderPage
      title="Customers"
      description="View and manage customer accounts."
      icon={Users}
      breadcrumb={[{ label: 'Admin', href: '/admin' }, { label: 'Customers' }]}
      comingSoon="Customer profiles, order history and segments will appear here in a future release."
    />
  );
}
