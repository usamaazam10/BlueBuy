'use client';

import { ProtectedRoute } from '@/components/auth/protected-route';
import { CustomersBrowser } from '@/components/admin/business/customers-browser';

/**
 * Customer analytics, inferred from guest checkout data — BlueBuy has no
 * customer accounts, so customers are matched on contact details.
 */
export default function CustomersPage() {
  return (
    <ProtectedRoute requiredPermission="customers.view">
      <CustomersBrowser />
    </ProtectedRoute>
  );
}
