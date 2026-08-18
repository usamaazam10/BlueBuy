'use client';

import { ProtectedRoute } from '@/components/auth/protected-route';
import { ProfitBrowser } from '@/components/admin/business/profit-browser';

/** Profitability — the P&L and where margin actually comes from. */
export default function ProfitPage() {
  return (
    <ProtectedRoute requiredPermission="finance.view">
      <ProfitBrowser />
    </ProtectedRoute>
  );
}
