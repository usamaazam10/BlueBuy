/**
 * Customer analytics, derived from guest checkout data.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * There are no customer accounts.
 *
 * BlueBuy's checkout is guest-only, so a "customer" is inferred by matching
 * orders on contact details. Phone is the identity key (email is optional at
 * checkout and often absent), normalised to digits so `0300-1234567` and
 * `03001234567` are one person rather than two.
 *
 * This is an inference, not a fact. Two people sharing a phone read as one
 * customer, and one person using two numbers reads as two. The UI says so —
 * `CustomerStats.inferred` exists to keep that caveat attached to the numbers.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Privacy
 *
 * Aggregate figures never carry contact details. A customer row exposes a name
 * and city — enough for the owner to recognise a regular — plus a masked phone.
 * The full number stays on the order, where it is needed to actually deliver.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import type { Order } from '@/types/order';
import { isRevenueOrder } from './sales';
import type { DateRange } from './date-range';
import { isWithin, toMillis } from './date-range';
import { roundMoney, safeDivide } from './metrics';

/**
 * Stable 32-bit FNV-1a hash. Not cryptographic — its only job is to turn a
 * contact detail into a short, stable, non-obvious token.
 */
function hashToken(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

/**
 * Identity key for an order: a hash of the phone digits, else of the email.
 *
 * **Hashed deliberately.** The key is rendered into DOM attributes and written
 * into CSV exports, so putting a raw phone number in it would scatter customer
 * contact details across places nobody expects them. Grouping only needs the key
 * to be stable and equal for the same person, not readable.
 */
export function customerKey(order: Order): string {
  const digits = (order.customer.phone ?? '').replace(/\D/g, '');
  if (digits.length >= 7) return `p_${hashToken(digits)}`;
  const email = (order.customer.email ?? '').trim().toLowerCase();
  return email ? `e_${hashToken(email)}` : `o_${order.id}`;
}

/**
 * Mask a phone for display: last 4 digits only.
 * Enough to disambiguate two customers with the same name, without putting a
 * full contact list on screen.
 */
export function maskPhone(phone: string): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length < 4) return '••••';
  return `••••${digits.slice(-4)}`;
}

/** One inferred customer. */
export interface CustomerRow {
  key: string;
  name: string;
  city: string;
  maskedPhone: string;
  orders: number;
  units: number;
  /** Total order value, less refunds. */
  revenue: number;
  averageOrderValue: number | null;
  firstOrderAt: number | null;
  lastOrderAt: number | null;
  /** True when they ordered more than once — the returning-customer definition. */
  returning: boolean;
}

/** Build the customer list from orders. Non-revenue orders are excluded. */
export function customerRows(orders: readonly Order[]): CustomerRow[] {
  const groups = new Map<
    string,
    {
      name: string;
      city: string;
      phone: string;
      orders: number;
      units: number;
      revenue: number;
      first: number | null;
      last: number | null;
    }
  >();

  for (const order of orders) {
    if (!isRevenueOrder(order)) continue;

    const key = customerKey(order);
    const placedAt = toMillis(order.createdAt);
    const entry = groups.get(key) ?? {
      name: order.customer.fullName,
      city: order.customer.city,
      phone: order.customer.phone ?? '',
      orders: 0,
      units: 0,
      revenue: 0,
      first: placedAt,
      last: placedAt,
    };

    entry.orders += 1;
    entry.units += order.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
    entry.revenue += (order.total || 0) - (order.refundedAmount || 0);

    if (placedAt !== null) {
      entry.first = entry.first === null ? placedAt : Math.min(entry.first, placedAt);
      entry.last = entry.last === null ? placedAt : Math.max(entry.last, placedAt);
      // The most recent order carries the freshest name/city spelling.
      if (placedAt === entry.last) {
        entry.name = order.customer.fullName;
        entry.city = order.customer.city;
      }
    }

    groups.set(key, entry);
  }

  return [...groups.entries()]
    .map(([key, entry]) => {
      const revenue = roundMoney(entry.revenue);
      const average = safeDivide(revenue, entry.orders);
      return {
        key,
        name: entry.name,
        city: entry.city,
        maskedPhone: maskPhone(entry.phone),
        orders: entry.orders,
        units: entry.units,
        revenue,
        averageOrderValue: average === null ? null : roundMoney(average),
        firstOrderAt: entry.first,
        lastOrderAt: entry.last,
        returning: entry.orders > 1,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

export interface CustomerStats {
  totalCustomers: number;
  /** First-ever order fell inside the period. */
  newCustomers: number;
  /** Ordered in the period and had ordered before it. */
  returningCustomers: number;
  /** Share of customers who have ordered more than once, 0–100, or `null`. */
  repeatRate: number | null;
  averageOrdersPerCustomer: number | null;
  averageOrderValue: number | null;
  /**
   * Mean revenue per customer to date. Labelled "revenue per customer" rather
   * than lifetime value: LTV projects future spend, and there is nowhere near
   * enough history here to project anything.
   */
  revenuePerCustomer: number | null;
  /** Always true — customers are inferred from contact details, not accounts. */
  inferred: true;
}

/**
 * Customer statistics for a period.
 *
 * @param allOrders Every order (needed to tell a genuinely new customer from
 *                  one who has ordered before the period began).
 * @param range     The reporting period.
 */
export function customerStats(allOrders: readonly Order[], range: DateRange): CustomerStats {
  const inPeriod = allOrders.filter(
    (order) => isRevenueOrder(order) && isWithin(order.createdAt, range)
  );
  const rowsAllTime = customerRows(allOrders);
  const firstOrderByKey = new Map(rowsAllTime.map((row) => [row.key, row.firstOrderAt]));

  const activeKeys = new Set(inPeriod.map(customerKey));

  let newCustomers = 0;
  let returningCustomers = 0;
  for (const key of activeKeys) {
    const first = firstOrderByKey.get(key);
    if (first !== null && first !== undefined && isWithin(new Date(first), range))
      newCustomers += 1;
    else returningCustomers += 1;
  }

  const periodRows = customerRows(inPeriod);
  const revenue = periodRows.reduce((sum, row) => sum + row.revenue, 0);
  const orderCount = inPeriod.length;

  const repeat = rowsAllTime.filter((row) => row.returning).length;

  return {
    totalCustomers: activeKeys.size,
    newCustomers,
    returningCustomers,
    repeatRate:
      rowsAllTime.length === 0
        ? null
        : Math.round(((repeat / rowsAllTime.length) * 100 + Number.EPSILON) * 10) / 10,
    averageOrdersPerCustomer:
      activeKeys.size === 0
        ? null
        : Math.round((orderCount / activeKeys.size + Number.EPSILON) * 100) / 100,
    averageOrderValue: orderCount === 0 ? null : roundMoney(revenue / orderCount),
    revenuePerCustomer: activeKeys.size === 0 ? null : roundMoney(revenue / activeKeys.size),
    inferred: true,
  };
}
