'use client';

import { ProtectedRoute } from '@/components/auth/protected-route';
import { PerformanceBrowser } from '@/components/admin/business/performance-browser';

/**
 * Product, category and brand performance — views, sales, margin and stock in
 * one place, plus the ranked lists worth acting on.
 */
export default function PerformancePage() {
  return (
    <ProtectedRoute requiredPermission="catalog.view">
      <PerformanceBrowser />
    </ProtectedRoute>
  );
}
