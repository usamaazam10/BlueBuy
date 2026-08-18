/**
 * Weighted-average costing.
 *
 * These tests are the specification for BlueBuy's cost basis. The most
 * important ones are the `null` cases: unknown cost must never collapse to zero,
 * because that silently turns an unmeasured product into a 100%-margin one.
 */
import { describe, expect, it } from 'vitest';
import type { Product } from '@/types/models';
import { applyReceipt, costBasis, inventoryValue, lineCost, marginPercent } from './costing';

/** Minimal product stub — only the fields the costing functions read. */
function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    stock: 10,
    averageCost: null,
    lastPurchaseCost: null,
    costPrice: null,
    ...overrides,
  } as Product;
}

describe('costBasis', () => {
  it('prefers the weighted average over every other source', () => {
    const basis = costBasis(product({ averageCost: 12, lastPurchaseCost: 20, costPrice: 30 }));
    expect(basis).toEqual({ unitCost: 12, source: 'weighted_average' });
  });

  it('falls back to the last purchase cost, then the manual cost', () => {
    expect(costBasis(product({ lastPurchaseCost: 20, costPrice: 30 }))).toEqual({
      unitCost: 20,
      source: 'last_purchase',
    });
    expect(costBasis(product({ costPrice: 30 }))).toEqual({ unitCost: 30, source: 'manual' });
  });

  it('returns null when no cost has ever been recorded', () => {
    expect(costBasis(product())).toBeNull();
  });

  it('treats a recorded zero cost as a real cost, not as unknown', () => {
    // Free samples genuinely cost nothing; that is different from not knowing.
    expect(costBasis(product({ averageCost: 0 }))).toEqual({
      unitCost: 0,
      source: 'weighted_average',
    });
  });
});

describe('applyReceipt', () => {
  it('averages the existing stock with the newly received units', () => {
    // 10 units @ 100 + 10 units @ 200 → 20 units @ 150.
    const result = applyReceipt(10, 100, 10, 200);
    expect(result).toEqual({ averageCost: 150, stockAfter: 20, establishedBasis: false });
  });

  it('weights by quantity rather than averaging the two prices', () => {
    // 90 units @ 10 + 10 units @ 110 → (900 + 1100) / 100 = 20, not 60.
    const result = applyReceipt(90, 10, 10, 110);
    expect(result.averageCost).toBe(20);
    expect(result.stockAfter).toBe(100);
  });

  it('adopts the receipt cost when no basis existed, and flags it', () => {
    const result = applyReceipt(5, null, 5, 40);
    expect(result).toEqual({ averageCost: 40, stockAfter: 10, establishedBasis: true });
  });

  it('sets the cost outright when there was no stock on hand', () => {
    expect(applyReceipt(0, null, 25, 8).averageCost).toBe(8);
    // An existing average with zero stock must not drag the new cost around.
    expect(applyReceipt(0, 999, 25, 8).averageCost).toBe(8);
  });

  it('rounds to money precision rather than leaking float drift', () => {
    // (1×0.1 + 2×0.2) / 3 = 0.16666… → 0.17
    expect(applyReceipt(1, 0.1, 2, 0.2).averageCost).toBe(0.17);
  });

  it('is order independent for the same set of receipts', () => {
    const a = applyReceipt(0, null, 10, 5);
    const ab = applyReceipt(a.stockAfter, a.averageCost, 30, 9);

    const b = applyReceipt(0, null, 30, 9);
    const ba = applyReceipt(b.stockAfter, b.averageCost, 10, 5);

    expect(ab.averageCost).toBe(ba.averageCost);
    expect(ab.stockAfter).toBe(ba.stockAfter);
  });

  it('ignores a zero-quantity receipt', () => {
    const result = applyReceipt(10, 100, 0, 999);
    expect(result).toEqual({ averageCost: 100, stockAfter: 10, establishedBasis: false });
  });
});

describe('valuation', () => {
  it('values stock at the cost basis', () => {
    expect(inventoryValue(product({ stock: 4, averageCost: 12.5 }))).toBe(50);
  });

  it('returns null — not zero — when the product has no cost basis', () => {
    expect(inventoryValue(product({ stock: 100 }))).toBeNull();
    expect(lineCost(product(), 3)).toBeNull();
  });

  it('never values negative stock as negative money', () => {
    expect(inventoryValue(product({ stock: -5, averageCost: 10 }))).toBe(0);
  });
});

describe('marginPercent', () => {
  it('computes margin against the selling price', () => {
    expect(marginPercent(200, 150)).toBe(25);
  });

  it('returns null when cost is unknown or price is zero', () => {
    expect(marginPercent(200, null)).toBeNull();
    expect(marginPercent(0, 10)).toBeNull();
  });

  it('reports a negative margin when sold below cost', () => {
    expect(marginPercent(100, 150)).toBe(-50);
  });
});
