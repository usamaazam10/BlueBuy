'use client';

import { InventoryBrowser } from '@/components/admin/business/inventory-browser';

/**
 * Inventory dashboard: stock positions, valuation, manual adjustments and the
 * append-only movement ledger.
 */
export default function InventoryPage() {
  return <InventoryBrowser />;
}
