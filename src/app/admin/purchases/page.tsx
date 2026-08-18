'use client';

import { PurchasesBrowser } from '@/components/admin/business/purchases-browser';

/**
 * Purchase orders and goods receiving — the flow that raises stock and
 * establishes each product's weighted-average cost.
 */
export default function PurchasesPage() {
  return <PurchasesBrowser />;
}
