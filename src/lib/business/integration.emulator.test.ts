/**
 * Integration harness — drives the REAL repositories against the Firestore
 * emulator to verify the documented business rules actually hold.
 */
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { doc, getDoc, getDocs, collection, setDoc, deleteDoc } from 'firebase/firestore';
import { getDb } from '@/firebase';
import { COLLECTIONS } from '@/types/models';
import { OrderRepository } from '@/repositories/order.repository';
import { PurchaseRepository } from '@/repositories/purchase.repository';
import { InventoryMovementRepository } from '@/repositories/inventory-movement.repository';
import type { ActorRef } from '@/types/business';

const actor: ActorRef = { uid: 'admin1', email: 'a@b.c', label: 'Admin' };
const db = () => getDb();

async function wipe(name: string) {
  const snap = await getDocs(collection(db(), name));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
}

async function seedProduct(id: string, over: Record<string, unknown> = {}) {
  await setDoc(doc(db(), COLLECTIONS.products, id), {
    slug: id,
    title: `Product ${id}`,
    description: '',
    shortDescription: '',
    price: 1000,
    salePrice: null,
    currency: 'PKR',
    categoryId: 'c1',
    brandId: 'b1',
    gallery: [],
    thumbnail: '',
    rating: 0,
    reviewCount: 0,
    stock: 0,
    tags: [],
    specifications: [],
    featured: false,
    active: true,
    seoTitle: '',
    seoDescription: '',
    metaKeywords: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  });
}

async function stockOf(id: string) {
  const s = await getDoc(doc(db(), COLLECTIONS.products, id));
  return s.data() as { stock: number; averageCost?: number | null };
}

async function movementsFor(productId: string) {
  const snap = await getDocs(collection(db(), COLLECTIONS.inventoryMovements));
  return snap.docs.map((d) => d.data()).filter((m) => m.productId === productId);
}

async function ledgerNet(productId: string) {
  return (await movementsFor(productId)).reduce((s, m) => s + (m.quantityChange ?? 0), 0);
}

async function makePO(
  id: string,
  items: { productId: string; quantity: number; unitCost: number }[]
) {
  await setDoc(doc(db(), COLLECTIONS.purchaseOrders, id), {
    purchaseOrderNumber: id,
    supplierId: 's1',
    supplierName: 'Supplier One',
    status: 'ordered',
    items: items.map((i) => ({
      productId: i.productId,
      title: `Product ${i.productId}`,
      slug: i.productId,
      quantity: i.quantity,
      quantityReceived: 0,
      unitCost: i.unitCost,
      lineTotal: i.unitCost * i.quantity,
    })),
    subtotal: 0,
    shippingCost: 0,
    taxAmount: 0,
    total: 0,
    currency: 'PKR',
    orderedAt: new Date(),
    expectedDeliveryAt: null,
    actualDeliveryAt: null,
    notes: '',
    createdBy: actor,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function orderInput(items: { productId: string; quantity: number; unitPrice: number }[]) {
  return {
    customer: {
      fullName: 'Test Buyer',
      phone: '03001234567',
      city: 'Karachi',
      address: '1 Test St',
    },
    items: items.map((i) => ({
      productId: i.productId,
      slug: i.productId,
      title: `Product ${i.productId}`,
      accent: '#ffffff',
      unitPrice: i.unitPrice,
      quantity: i.quantity,
      lineTotal: i.unitPrice * i.quantity,
    })),
    subtotal: items.reduce((s, i) => s + i.unitPrice * i.quantity, 0),
    shipping: 0,
    discount: 0,
    total: items.reduce((s, i) => s + i.unitPrice * i.quantity, 0),
    currency: 'PKR',
  };
}

beforeAll(() => {
  expect(process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATORS).toBe('true');
});

beforeEach(async () => {
  await Promise.all([
    wipe(COLLECTIONS.products),
    wipe(COLLECTIONS.orders),
    wipe(COLLECTIONS.inventoryMovements),
    wipe(COLLECTIONS.purchaseOrders),
    wipe(COLLECTIONS.purchaseReceipts),
  ]);
});

describe('§5 purchase lifecycle → stock', () => {
  it('draft raises no stock and refuses receiving', async () => {
    await seedProduct('p1', { stock: 0 });
    await setDoc(doc(db(), COLLECTIONS.purchaseOrders, 'PO-D'), {
      purchaseOrderNumber: 'PO-D',
      supplierId: 's1',
      supplierName: 'S',
      status: 'draft',
      items: [
        {
          productId: 'p1',
          title: 'Product p1',
          slug: 'p1',
          quantity: 5,
          quantityReceived: 0,
          unitCost: 100,
          lineTotal: 500,
        },
      ],
      subtotal: 500,
      shippingCost: 0,
      taxAmount: 0,
      total: 500,
      currency: 'PKR',
      orderedAt: null,
      expectedDeliveryAt: null,
      actualDeliveryAt: null,
      notes: '',
      createdBy: actor,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect((await stockOf('p1')).stock).toBe(0);
    await expect(
      PurchaseRepository.receive(
        {
          purchaseOrderId: 'PO-D',
          lines: [{ productId: 'p1', quantity: 5, unitCost: 100 }],
          receivedAt: new Date(),
          notes: '',
        },
        actor
      )
    ).rejects.toThrow();
    expect((await stockOf('p1')).stock).toBe(0);
  });

  it('ordered raises no stock until goods are received', async () => {
    await seedProduct('p1', { stock: 0 });
    await makePO('PO-1', [{ productId: 'p1', quantity: 10, unitCost: 100 }]);
    expect((await stockOf('p1')).stock).toBe(0);
  });

  it('partial receipt raises only the received quantity, once', async () => {
    await seedProduct('p1', { stock: 0 });
    await makePO('PO-2', [{ productId: 'p1', quantity: 10, unitCost: 100 }]);
    const r = await PurchaseRepository.receive(
      {
        purchaseOrderId: 'PO-2',
        lines: [{ productId: 'p1', quantity: 4, unitCost: 100 }],
        receivedAt: new Date(),
        notes: '',
      },
      actor
    );
    expect(r.fullyReceived).toBe(false);
    expect(r.purchaseOrder.status).toBe('partially_received');
    expect((await stockOf('p1')).stock).toBe(4);
    expect(await ledgerNet('p1')).toBe(4);

    await PurchaseRepository.receive(
      {
        purchaseOrderId: 'PO-2',
        lines: [{ productId: 'p1', quantity: 6, unitCost: 100 }],
        receivedAt: new Date(),
        notes: '',
      },
      actor
    );
    expect((await stockOf('p1')).stock).toBe(10);
    const po = await PurchaseRepository.getById('PO-2');
    expect(po?.status).toBe('received');
  });

  it('over-receiving is rejected and writes nothing', async () => {
    await seedProduct('p1', { stock: 0 });
    await makePO('PO-3', [{ productId: 'p1', quantity: 5, unitCost: 100 }]);
    await expect(
      PurchaseRepository.receive(
        {
          purchaseOrderId: 'PO-3',
          lines: [{ productId: 'p1', quantity: 6, unitCost: 100 }],
          receivedAt: new Date(),
          notes: '',
        },
        actor
      )
    ).rejects.toThrow();
    expect((await stockOf('p1')).stock).toBe(0);
    expect(await ledgerNet('p1')).toBe(0);
  });
});

describe('§6 weighted average cost', () => {
  it('10×100 then 10×200 → average 150', async () => {
    await seedProduct('p1', { stock: 0 });
    await makePO('PO-A', [{ productId: 'p1', quantity: 10, unitCost: 100 }]);
    await PurchaseRepository.receive(
      {
        purchaseOrderId: 'PO-A',
        lines: [{ productId: 'p1', quantity: 10, unitCost: 100 }],
        receivedAt: new Date(),
        notes: '',
      },
      actor
    );
    expect((await stockOf('p1')).averageCost).toBe(100);

    await makePO('PO-B', [{ productId: 'p1', quantity: 10, unitCost: 200 }]);
    await PurchaseRepository.receive(
      {
        purchaseOrderId: 'PO-B',
        lines: [{ productId: 'p1', quantity: 10, unitCost: 200 }],
        receivedAt: new Date(),
        notes: '',
      },
      actor
    );
    const after = await stockOf('p1');
    expect(after.stock).toBe(20);
    expect(after.averageCost).toBe(150);
  });
});

describe('§3 order → inventory', () => {
  it('placing an order decrements stock exactly once', async () => {
    await seedProduct('p1', { stock: 10 });
    await OrderRepository.create(
      'BB-1',
      orderInput([{ productId: 'p1', quantity: 3, unitPrice: 1000 }])
    );
    expect((await stockOf('p1')).stock).toBe(7);
  });

  it('status changes do NOT decrement again', async () => {
    await seedProduct('p1', { stock: 10 });
    await OrderRepository.create(
      'BB-2',
      orderInput([{ productId: 'p1', quantity: 3, unitPrice: 1000 }])
    );
    for (const s of ['confirmed', 'packed', 'shipped', 'delivered'] as const) {
      await OrderRepository.updateStatus('BB-2', s);
    }
    expect((await stockOf('p1')).stock).toBe(7);
  });

  it('overselling is refused and nothing is written', async () => {
    await seedProduct('p1', { stock: 2 });
    await expect(
      OrderRepository.create(
        'BB-3',
        orderInput([{ productId: 'p1', quantity: 5, unitPrice: 1000 }])
      )
    ).rejects.toThrow();
    expect((await stockOf('p1')).stock).toBe(2);
    const o = await getDoc(doc(db(), COLLECTIONS.orders, 'BB-3'));
    expect(o.exists()).toBe(false);
  });

  it('§15 concurrent buyers cannot both take the last unit', async () => {
    await seedProduct('p1', { stock: 1 });
    const results = await Promise.allSettled([
      OrderRepository.create(
        'BB-C1',
        orderInput([{ productId: 'p1', quantity: 1, unitPrice: 1000 }])
      ),
      OrderRepository.create(
        'BB-C2',
        orderInput([{ productId: 'p1', quantity: 1, unitPrice: 1000 }])
      ),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    expect(ok).toBe(1);
    expect((await stockOf('p1')).stock).toBe(0);
  });

  it('§15 receiving the same PO twice concurrently does not double-raise stock', async () => {
    await seedProduct('p1', { stock: 0 });
    await makePO('PO-R', [{ productId: 'p1', quantity: 5, unitCost: 100 }]);
    const line = {
      purchaseOrderId: 'PO-R',
      lines: [{ productId: 'p1', quantity: 5, unitCost: 100 }],
      receivedAt: new Date(),
      notes: '',
    };
    const results = await Promise.allSettled([
      PurchaseRepository.receive(line, actor),
      PurchaseRepository.receive(line, actor),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    expect(ok).toBe(1);
    expect((await stockOf('p1')).stock).toBe(5);
  });
});

describe('§4 cancellation / return — LEDGER RECONCILIATION', () => {
  it('cancel restores stock, and is idempotent', async () => {
    await seedProduct('p1', { stock: 10 });
    await OrderRepository.create(
      'BB-X',
      orderInput([{ productId: 'p1', quantity: 3, unitPrice: 1000 }])
    );
    expect((await stockOf('p1')).stock).toBe(7);
    await OrderRepository.closeWithRestock('BB-X', 'cancelled', actor, 'Order cancelled');
    expect((await stockOf('p1')).stock).toBe(10);
    const second = await OrderRepository.closeWithRestock(
      'BB-X',
      'cancelled',
      actor,
      'Order cancelled'
    );
    expect(second.restoredUnits).toBe(0);
    expect((await stockOf('p1')).stock).toBe(10);
  });

  it('cancel before cost capture keeps the ledger balanced (regression)', async () => {
    await seedProduct('p1', { stock: 0 });
    await makePO('PO-L', [{ productId: 'p1', quantity: 10, unitCost: 100 }]);
    await PurchaseRepository.receive(
      {
        purchaseOrderId: 'PO-L',
        lines: [{ productId: 'p1', quantity: 10, unitCost: 100 }],
        receivedAt: new Date(),
        notes: '',
      },
      actor
    );
    expect(await ledgerNet('p1')).toBe(10);
    expect((await stockOf('p1')).stock).toBe(10);

    // Customer orders 3 → stock 7. Checkout writes NO ledger entry.
    await OrderRepository.create(
      'BB-Y',
      orderInput([{ productId: 'p1', quantity: 3, unitPrice: 1000 }])
    );
    expect((await stockOf('p1')).stock).toBe(7);

    // Admin cancels BEFORE capturing costs → restore writes +3 with no matching -3.
    await OrderRepository.closeWithRestock('BB-Y', 'cancelled', actor, 'Order cancelled');

    const stock = (await stockOf('p1')).stock;
    const ledger = await ledgerNet('p1');
    console.log(`AFTER CANCEL → stock=${stock} ledgerNet=${ledger} drift=${stock - ledger}`);
    expect(stock).toBe(10);
    expect(ledger).toBe(10);
  });

  it('§12 full timeline reconciles: receive → sell → capture → return', async () => {
    await seedProduct('p1', { stock: 0 });
    await makePO('PO-T', [{ productId: 'p1', quantity: 20, unitCost: 100 }]);
    await PurchaseRepository.receive(
      {
        purchaseOrderId: 'PO-T',
        lines: [{ productId: 'p1', quantity: 20, unitCost: 100 }],
        receivedAt: new Date(),
        notes: '',
      },
      actor
    );
    await OrderRepository.create(
      'BB-T',
      orderInput([{ productId: 'p1', quantity: 5, unitPrice: 1000 }])
    );
    await OrderRepository.recordSaleMovements('BB-T', actor);
    expect(await ledgerNet('p1')).toBe(15);
    expect((await stockOf('p1')).stock).toBe(15);

    await InventoryMovementRepository.adjust(
      {
        productId: 'p1',
        currentQuantity: 15,
        newQuantity: 13,
        type: 'damaged',
        reason: 'Water damage',
        notes: '',
      },
      actor
    );
    expect((await stockOf('p1')).stock).toBe(13);
    expect(await ledgerNet('p1')).toBe(13);

    // A return is only reachable from a delivered order — walk the real path.
    for (const s of ['confirmed', 'packed', 'shipped', 'delivered'] as const) {
      await OrderRepository.updateStatus('BB-T', s);
    }
    await OrderRepository.closeWithRestock('BB-T', 'returned', actor, 'Customer return');
    const stock = (await stockOf('p1')).stock;
    const ledger = await ledgerNet('p1');
    console.log(`TIMELINE → stock=${stock} ledgerNet=${ledger}`);
    expect(stock).toBe(18);
    expect(ledger).toBe(18);
  });
});

describe('§4 return disposition + transition guard', () => {
  it('refuses to close an order into a status its lifecycle forbids', async () => {
    await seedProduct('p1', { stock: 10 });
    await OrderRepository.create(
      'BB-G',
      orderInput([{ productId: 'p1', quantity: 2, unitPrice: 1000 }])
    );
    await expect(
      OrderRepository.closeWithRestock('BB-G', 'returned', actor, 'Customer return')
    ).rejects.toThrow(/Can't move an order/);
    // Nothing changed: the whole close is one transaction.
    expect((await stockOf('p1')).stock).toBe(8);
    expect(await ledgerNet('p1')).toBe(0);
  });

  it('a non-restocking return records the sale but does NOT return units to stock', async () => {
    await seedProduct('p1', { stock: 0 });
    await makePO('PO-D2', [{ productId: 'p1', quantity: 10, unitCost: 100 }]);
    await PurchaseRepository.receive(
      {
        purchaseOrderId: 'PO-D2',
        lines: [{ productId: 'p1', quantity: 10, unitCost: 100 }],
        receivedAt: new Date(),
        notes: '',
      },
      actor
    );
    await OrderRepository.create(
      'BB-D',
      orderInput([{ productId: 'p1', quantity: 4, unitPrice: 1000 }])
    );
    for (const s of ['confirmed', 'packed', 'shipped', 'delivered'] as const) {
      await OrderRepository.updateStatus('BB-D', s);
    }
    await OrderRepository.closeWithRestock('BB-D', 'returned', actor, 'Returned damaged', false);

    const stock = (await stockOf('p1')).stock;
    const ledger = await ledgerNet('p1');
    console.log(`DAMAGED RETURN -> stock=${stock} ledgerNet=${ledger}`);
    expect(stock).toBe(6);
    expect(ledger).toBe(6);
  });
});
