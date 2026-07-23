import type { Metadata } from 'next';
import { ShoppingCart } from 'lucide-react';
import { PlaceholderPage } from '@/components/admin/ui/placeholder-page';

export const metadata: Metadata = { title: 'Orders' };

export default function OrdersPage() {
  return (
    <PlaceholderPage
      title="Orders"
      description="Track and fulfil customer orders."
      icon={ShoppingCart}
      breadcrumb={[{ label: 'Admin', href: '/admin' }, { label: 'Orders' }]}
      comingSoon="Order management — statuses, fulfilment and refunds — will live here once checkout is wired up."
    />
  );
}
