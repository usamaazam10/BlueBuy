/**
 * Profitability — the P&L, computed once and used everywhere.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * The statement, in order. Each line is labelled exactly as it is calculated:
 *
 *     Net sales                (gross sales − discounts − refunds)
 *   − Cost of goods sold       (captured per order at fulfilment, WAC basis)
 *   ─────────────────────────
 *   = Gross profit
 *   − Operating expenses       (expenses collection, excluding inventory buys)
 *   ─────────────────────────
 *   = Operating profit
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Two rules this module exists to enforce:
 *
 * 1. **Inventory purchases are not an operating expense.** Money spent on stock
 *    becomes COGS when that stock is *sold*, not when it is bought. Expenses
 *    flagged `isInventoryProcurement` are therefore excluded from operating
 *    expenses — including them would double-count against COGS and understate
 *    profit, sometimes wildly.
 *
 * 2. **Profit is not reported when its inputs are unknown.** If any revenue
 *    order in the period lacks a cost snapshot, gross profit is not a fact — it
 *    is a guess. `dataQuality` says so, and the UI must render "insufficient
 *    cost data" instead of a number.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import type { Order } from '@/types/order';
import type { Expense } from '@/types/business';
import type { DateRange } from './date-range';
import { isWithin } from './date-range';
import { cogsSummary, salesMetrics, type CogsSummary, type SalesMetrics } from './sales';
import { percentOf, roundMoney } from './metrics';

/** Expenses whose `incurredAt` falls inside a range. */
export function expensesInRange(expenses: readonly Expense[], range: DateRange): Expense[] {
  return expenses.filter((expense) => isWithin(expense.incurredAt, range));
}

/** Operating-expense breakdown by category. */
export interface ExpenseGroup {
  categoryId: string;
  categoryName: string;
  amount: number;
  count: number;
}

/** Split of a period's spending into operating vs. inventory procurement. */
export interface ExpenseBreakdown {
  /** Spend that belongs in the P&L as an operating cost. */
  operating: number;
  /** Spend on stock — excluded from operating expenses (becomes COGS on sale). */
  inventoryProcurement: number;
  /** operating + inventoryProcurement. */
  total: number;
  byCategory: ExpenseGroup[];
  count: number;
}

export function expenseBreakdown(expenses: readonly Expense[]): ExpenseBreakdown {
  let operating = 0;
  let procurement = 0;
  const groups = new Map<string, ExpenseGroup>();

  for (const expense of expenses) {
    const amount = Math.abs(expense.amount || 0);
    if (expense.isInventoryProcurement) procurement += amount;
    else operating += amount;

    const key = expense.categoryId || 'uncategorised';
    const entry = groups.get(key) ?? {
      categoryId: key,
      categoryName: expense.categoryName || 'Uncategorised',
      amount: 0,
      count: 0,
    };
    entry.amount += amount;
    entry.count += 1;
    groups.set(key, entry);
  }

  return {
    operating: roundMoney(operating),
    inventoryProcurement: roundMoney(procurement),
    total: roundMoney(operating + procurement),
    count: expenses.length,
    byCategory: [...groups.values()]
      .map((group) => ({ ...group, amount: roundMoney(group.amount) }))
      .sort((a, b) => b.amount - a.amount),
  };
}

/**
 * How trustworthy a profit figure is.
 *
 * `complete`   — every revenue order has a full cost snapshot; profit is a fact.
 * `partial`    — some orders are costed; the figure understates COGS.
 * `unavailable`— nothing is costed; no profit figure may be shown at all.
 */
export type ProfitDataQuality = 'complete' | 'partial' | 'unavailable';

export interface ProfitAndLoss {
  sales: SalesMetrics;
  cogs: CogsSummary;
  expenses: ExpenseBreakdown;

  /** Net sales − COGS, or `null` when no cost data exists. */
  grossProfit: number | null;
  /** Gross profit ÷ net sales × 100, or `null`. */
  grossMarginPercent: number | null;
  /** Gross profit − operating expenses, or `null` when gross profit is unknown. */
  operatingProfit: number | null;
  /** Operating profit ÷ net sales × 100, or `null`. */
  operatingMarginPercent: number | null;

  dataQuality: ProfitDataQuality;
  /** Human explanation when data quality is not `complete`. */
  dataNote: string | null;
}

/**
 * Build the P&L for a period.
 *
 * @param orders   Orders already filtered to the period (any status; cancelled
 *                 and returned are excluded internally).
 * @param expenses Expenses already filtered to the period.
 */
export function profitAndLoss(
  orders: readonly Order[],
  expenses: readonly Expense[]
): ProfitAndLoss {
  const sales = salesMetrics(orders);
  const cogs = cogsSummary(orders);
  const expenseSplit = expenseBreakdown(expenses);

  const hasAnyCost = cogs.costedOrders + cogs.partialOrders > 0;

  let dataQuality: ProfitDataQuality;
  let dataNote: string | null = null;

  if (sales.orderCount === 0) {
    // No sales at all is a complete picture, not a data gap.
    dataQuality = 'complete';
  } else if (!hasAnyCost) {
    dataQuality = 'unavailable';
    dataNote =
      'No cost data recorded for this period’s orders. Record purchase costs, then capture costs on orders to see profit.';
  } else if (!cogs.complete) {
    dataQuality = 'partial';
    const missing = cogs.uncostedOrders + cogs.partialOrders;
    dataNote = `${missing} of ${sales.orderCount} orders have no complete cost basis, so cost of goods is understated.`;
  } else {
    dataQuality = 'complete';
  }

  const grossProfit =
    dataQuality === 'unavailable' ? null : roundMoney(sales.netSales - cogs.total);
  const grossMargin = grossProfit === null ? null : percentOf(grossProfit, sales.netSales);
  const operatingProfit =
    grossProfit === null ? null : roundMoney(grossProfit - expenseSplit.operating);
  const operatingMargin =
    operatingProfit === null ? null : percentOf(operatingProfit, sales.netSales);

  return {
    sales,
    cogs,
    expenses: expenseSplit,
    grossProfit,
    grossMarginPercent: grossMargin,
    operatingProfit,
    operatingMarginPercent: operatingMargin,
    dataQuality,
    dataNote,
  };
}

/**
 * Whether a period has enough underlying activity to justify comparing it with
 * the previous one. Used to decide if a KPI card shows a trend at all.
 */
export function hasComparableActivity(
  orders: readonly Order[],
  expenses: readonly Expense[]
): boolean {
  return orders.length > 0 || expenses.length > 0;
}
