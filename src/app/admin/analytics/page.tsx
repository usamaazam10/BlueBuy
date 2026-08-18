'use client';

import { ProtectedRoute } from '@/components/auth/protected-route';
import { AnalyticsBrowser } from '@/components/admin/business/analytics-browser';

/**
 * Website analytics — traffic, the conversion funnel and search behaviour,
 * measured from BlueBuy's own storefront events.
 */
export default function AnalyticsPage() {
  return (
    <ProtectedRoute requiredPermission="analytics.view">
      <AnalyticsBrowser />
    </ProtectedRoute>
  );
}
