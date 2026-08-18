'use client';

import { ProtectedRoute } from '@/components/auth/protected-route';
import { SalesBrowser } from '@/components/admin/business/sales-browser';

/** Sales report — units, revenue and breakdowns by product, category and brand. */
export default function SalesPage() {
  return (
    <ProtectedRoute requiredPermission="sales.view">
      <SalesBrowser />
    </ProtectedRoute>
  );
}
