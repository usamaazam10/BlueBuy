/**
 * OrderService — the domain orchestration layer for orders.
 *
 * Where {@link OrderRepository} is pure Firestore data access, the service owns
 * the *business* logic around an order:
 *  - turning cart lines into an order's item snapshots,
 *  - pricing the order through the shared engine + checkout config (so the
 *    totals stored match the checkout summary exactly),
 *  - generating the human-facing order number, and
 *  - the WhatsApp handoff link.
 *
 * Hooks (`@/hooks/queries/use-orders`) and components call the service; they
 * never touch the repository or Firestore directly. Inventory is decremented
 * atomically with order creation inside the repository transaction, so calling
 * {@link placeOrder} is all it takes to both record the order and reduce stock.
 */
import type { CartItem } from '@/types/cart';
import type { CreateOrderInput, Order, OrderItem, OrderStatus } from '@/types/order';
import type { CheckoutCustomerInput } from '@/lib/validations';
import { OrderRepository } from '@/repositories';
import { calculateTotals, lineSubtotal } from '@/lib/cart/pricing';
import { getActiveCurrency } from '@/lib/format';
import { CHECKOUT_PRICING_CONFIG, buildWhatsAppUrl } from '@/lib/order';
import { checkoutCustomerSchema } from '@/lib/validations';

/** Arguments to place an order — the cart contents plus who's buying. */
export interface PlaceOrderArgs {
  customer: CheckoutCustomerInput;
  items: CartItem[];
  /**
   * ISO 4217 code to record the order in. Defaults to the store's configured
   * currency (`site_settings`) — the same one checkout displayed prices in.
   */
  currency?: string;
}

/**
 * Generate a human-friendly, reasonably-unique order number, e.g.
 * `BB-260725-4F7A`. Date-prefixed for at-a-glance recency; the random suffix
 * keeps same-day orders distinct. The repository transaction is the final
 * guard against the (astronomically unlikely) collision.
 */
function generateOrderId(now: Date = new Date()): string {
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `BB-${yy}${mm}${dd}-${suffix}`;
}

/** Map a cart line into an immutable order item snapshot. */
function toOrderItem(item: CartItem): OrderItem {
  return {
    productId: item.id,
    slug: item.slug,
    title: item.title,
    image: item.image,
    accent: item.accent,
    unitPrice: item.unitPrice,
    quantity: item.quantity,
    lineTotal: lineSubtotal(item),
  };
}

/** Build the validated create payload from cart lines + priced totals. */
function buildCreateInput(
  customer: CheckoutCustomerInput,
  items: CartItem[],
  currency: string
): CreateOrderInput {
  const totals = calculateTotals(items, CHECKOUT_PRICING_CONFIG);
  return {
    customer,
    items: items.map(toOrderItem),
    subtotal: totals.subtotal,
    shipping: totals.shipping,
    discount: totals.discount,
    total: totals.total,
    currency,
  };
}

export const orderService = {
  /**
   * Place an order: validate the customer, price the cart, generate an order
   * number, then create the order and decrement stock atomically. Resolves to
   * the stored {@link Order}; rejects with an `AppError` on insufficient stock
   * or invalid input.
   */
  async placeOrder({ customer, items, currency }: PlaceOrderArgs): Promise<Order> {
    if (items.length === 0) {
      // Guard the obvious case with a friendly message before hitting Firestore.
      throw new Error('Your cart is empty.');
    }
    const parsedCustomer = checkoutCustomerSchema.parse(customer);
    const input = buildCreateInput(parsedCustomer, items, currency ?? getActiveCurrency());
    const orderId = generateOrderId();
    return OrderRepository.create(orderId, input);
  },

  /** List every order, newest first (admin). */
  async list(): Promise<Order[]> {
    return OrderRepository.list();
  },

  /** Fetch a single order by its number/id. */
  async getById(id: string): Promise<Order | null> {
    return OrderRepository.getById(id);
  },

  /** Update an order's fulfilment status (admin-only in practice). */
  async updateStatus(id: string, status: OrderStatus): Promise<Order> {
    return OrderRepository.updateStatus(id, status);
  },

  /** Build the pre-filled WhatsApp handoff link for an order. */
  whatsAppUrl(order: Order): string {
    return buildWhatsAppUrl(order);
  },
};

export type OrderService = typeof orderService;
