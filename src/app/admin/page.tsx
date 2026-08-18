'use client';

import { BusinessOverview } from '@/components/admin/business/business-overview';

/**
 * Admin dashboard — the business overview.
 *
 * Everything reads real Firestore data through the shared query hooks, and the
 * calculations come from `@/lib/business`, so a figure here is the same figure
 * the detailed reports and CSV exports produce. Metrics that cannot be computed
 * from recorded data render as "Not enough data" rather than as zero.
 */
export default function DashboardPage() {
  return <BusinessOverview />;
}
