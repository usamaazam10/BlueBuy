import type { Metadata } from 'next';
import { PageHeader } from '@/components/admin/ui/page-header';
import { OrdersBrowser } from '@/components/admin/orders';

export const metadata: Metadata = { title: 'Orders' };

export default function OrdersPage() {
  return (
    <div>
      <PageHeader
        title="Orders"
        description="Track and fulfil customer orders — search, filter and update status."
        breadcrumb={[{ label: 'Admin', href: '/admin' }, { label: 'Orders' }]}
      />
      <OrdersBrowser />
    </div>
  );
}
