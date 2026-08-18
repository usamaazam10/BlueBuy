'use client';

import { ProtectedRoute } from '@/components/auth/protected-route';
import { DeliveryBrowser } from '@/components/admin/business/delivery-browser';

/** Delivery dashboard — the fulfilment pipeline and courier performance. */
export default function DeliveriesPage() {
  return (
    <ProtectedRoute requiredPermission="orders.view">
      <DeliveryBrowser />
    </ProtectedRoute>
  );
}
