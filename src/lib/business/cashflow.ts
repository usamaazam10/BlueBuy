/**
 * Cash flow — **actual money movement**, deliberately separate from revenue.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Revenue is not cash. An order placed today on cash-on-delivery produces
 * revenue today and cash only when the courier hands the money over. A purchase
 * order raises no cash movement at all until it is paid for. This module never
 * reads orders — it reads the `cash_transactions` ledger, which records money
 * that genuinely moved.
 *
 * Balances:
 *   opening  = net of every transaction strictly before the period
 *   net      = inflows − outflows within the period
 *   closing  = opening + net
 *
 * Because the opening balance is derived by replaying the whole ledger, it is
 * exact but O(n) in transactions. That is comfortable for a store recording tens
 * of entries a week; see BUSINESS_OPERATIONS.md § Performance for the monthly
 * snapshot strategy to adopt if the ledger grows large.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import type { CashDirection, CashTransaction, PaymentMethod } from '@/types/business';
import type { DateRange } from './date-range';
import { dayKey, eachDayKey, isWithin, toDate, toMillis } from './date-range';
import { roundMoney } from './metrics';

/** Signed value of a transaction: positive for inflow, negative for outflow. */
export function signedAmount(transaction: CashTransaction): number {
  const amount = Math.abs(transaction.amount || 0);
  return transaction.direction === 'inflow' ? amount : -amount;
}

/** Transactions that fall inside a range, by when the money actually moved. */
export function transactionsInRange(
  transactions: readonly CashTransaction[],
  range: DateRange
): CashTransaction[] {
  return transactions.filter((t) => isWithin(t.occurredAt, range));
}

/** Net of every transaction strictly before a moment — the opening balance. */
export function balanceBefore(transactions: readonly CashTransaction[], before: Date): number {
  const cutoff = before.getTime();
  let balance = 0;
  for (const transaction of transactions) {
    const millis = toMillis(transaction.occurredAt);
    if (millis === null || millis >= cutoff) continue;
    balance += signedAmount(transaction);
  }
  return roundMoney(balance);
}

/** A grouped slice of cash movement. */
export interface CashGroup {
  key: string;
  label: string;
  inflow: number;
  outflow: number;
  net: number;
  count: number;
}

/** Headline cash figures for a period. */
export interface CashFlowSummary {
  openingBalance: number;
  inflows: number;
  outflows: number;
  /** inflows − outflows. */
  netCashFlow: number;
  closingBalance: number;
  transactionCount: number;
  /** Inflow/outflow split by `source`. */
  bySource: CashGroup[];
  /** Inflow/outflow split by payment method. */
  byMethod: CashGroup[];
  /** Free-text category split (expense categories, "Customer payment", …). */
  byCategory: CashGroup[];
}

function group(
  transactions: readonly CashTransaction[],
  keyOf: (t: CashTransaction) => { key: string; label: string }
): CashGroup[] {
  const groups = new Map<string, CashGroup>();
  for (const transaction of transactions) {
    const { key, label } = keyOf(transaction);
    let entry = groups.get(key);
    if (!entry) {
      entry = { key, label, inflow: 0, outflow: 0, net: 0, count: 0 };
      groups.set(key, entry);
    }
    const amount = Math.abs(transaction.amount || 0);
    if (transaction.direction === 'inflow') entry.inflow += amount;
    else entry.outflow += amount;
    entry.count += 1;
  }

  return [...groups.values()]
    .map((entry) => ({
      ...entry,
      inflow: roundMoney(entry.inflow),
      outflow: roundMoney(entry.outflow),
      net: roundMoney(entry.inflow - entry.outflow),
    }))
    .sort((a, b) => b.inflow + b.outflow - (a.inflow + a.outflow));
}

/** Readable labels for the ledger's machine-readable enums. */
const SOURCE_LABELS: Record<string, string> = {
  sale: 'Customer payments',
  purchase: 'Supplier purchases',
  expense: 'Operating expenses',
  refund: 'Refunds',
  other_income: 'Other income',
  manual: 'Manual entry',
};

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank transfer',
  card: 'Card',
  mobile_wallet: 'Mobile wallet',
  cheque: 'Cheque',
  other: 'Other',
};

export function cashSourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

export function paymentMethodLabel(method: string): string {
  return METHOD_LABELS[method as PaymentMethod] ?? method;
}

/**
 * Summarise cash for a period.
 *
 * @param allTransactions Every transaction (needed for the opening balance).
 * @param range           The reporting period.
 */
export function cashFlowSummary(
  allTransactions: readonly CashTransaction[],
  range: DateRange
): CashFlowSummary {
  const period = transactionsInRange(allTransactions, range);
  const openingBalance = balanceBefore(allTransactions, range.start);

  let inflows = 0;
  let outflows = 0;
  for (const transaction of period) {
    const amount = Math.abs(transaction.amount || 0);
    if (transaction.direction === 'inflow') inflows += amount;
    else outflows += amount;
  }

  const netCashFlow = roundMoney(inflows - outflows);

  return {
    openingBalance,
    inflows: roundMoney(inflows),
    outflows: roundMoney(outflows),
    netCashFlow,
    closingBalance: roundMoney(openingBalance + netCashFlow),
    transactionCount: period.length,
    bySource: group(period, (t) => ({ key: t.source, label: cashSourceLabel(t.source) })),
    byMethod: group(period, (t) => ({
      key: t.paymentMethod,
      label: paymentMethodLabel(t.paymentMethod),
    })),
    byCategory: group(period, (t) => ({
      key: t.category || 'uncategorised',
      label: t.category || 'Uncategorised',
    })),
  };
}

/** One day of the cash chart, including the running balance. */
export interface CashPoint {
  dayKey: string;
  inflow: number;
  outflow: number;
  net: number;
  /** Closing balance at the end of that day. */
  balance: number;
}

/**
 * Daily cash series with a running balance, seeded from the opening balance so
 * the line starts where the business actually stood.
 */
export function cashSeries(
  allTransactions: readonly CashTransaction[],
  range: DateRange
): CashPoint[] {
  const buckets = new Map<string, { inflow: number; outflow: number }>();
  for (const key of eachDayKey(range)) buckets.set(key, { inflow: 0, outflow: 0 });

  for (const transaction of transactionsInRange(allTransactions, range)) {
    const date = toDate(transaction.occurredAt);
    if (!date) continue;
    const bucket = buckets.get(dayKey(date));
    if (!bucket) continue;
    const amount = Math.abs(transaction.amount || 0);
    if (transaction.direction === 'inflow') bucket.inflow += amount;
    else bucket.outflow += amount;
  }

  let balance = balanceBefore(allTransactions, range.start);
  const points: CashPoint[] = [];
  for (const [key, bucket] of buckets) {
    const net = bucket.inflow - bucket.outflow;
    balance += net;
    points.push({
      dayKey: key,
      inflow: roundMoney(bucket.inflow),
      outflow: roundMoney(bucket.outflow),
      net: roundMoney(net),
      balance: roundMoney(balance),
    });
  }
  return points;
}

/** Build the ledger entry shape for a cash movement of a given direction. */
export function directionLabel(direction: CashDirection): string {
  return direction === 'inflow' ? 'Money in' : 'Money out';
}
