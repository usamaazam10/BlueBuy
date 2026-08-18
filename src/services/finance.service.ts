/**
 * FinanceService — expenses and the cash ledger.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Recording an expense optionally records the cash that paid for it.
 *
 * These are two different facts: *the business incurred a cost* (the expense)
 * and *money left the account* (the cash entry). Usually they happen together,
 * so {@link recordExpense} writes both by default — but an unpaid invoice can be
 * recorded as an expense with `paid: false`, and the cash entry added later when
 * it is actually settled.
 *
 * Keeping them separable is what lets the cash balance reconcile to a bank
 * statement while the P&L still reflects costs as they were incurred.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { CashRepository, ExpenseCategoryRepository, ExpenseRepository } from '@/repositories';
import type {
  ActorRef,
  CashDirection,
  CashTransaction,
  Expense,
  ExpenseCategoryDoc,
  PaymentMethod,
} from '@/types/business';
import type { DateRange } from '@/lib/business/date-range';
import { AppError } from '@/firebase';
import { auditService } from './audit.service';

/** What the expense form collects. */
export interface RecordExpenseArgs {
  amount: number;
  currency: string;
  categoryId: string;
  incurredAt: Date;
  paymentMethod: PaymentMethod;
  description: string;
  reference: string;
  /** When true (default), also records the matching cash outflow. */
  paid: boolean;
  actor: ActorRef;
}

/** What the manual cash form collects. */
export interface RecordCashArgs {
  direction: CashDirection;
  amount: number;
  currency: string;
  category: string;
  description: string;
  occurredAt: Date;
  paymentMethod: PaymentMethod;
  reference: string;
  actor: ActorRef;
}

export const financeService = {
  // ───────────────────────────── Categories ────────────────────────────────

  async listCategories(): Promise<ExpenseCategoryDoc[]> {
    return ExpenseCategoryRepository.list();
  },

  /**
   * Ensure the default categories exist. Safe to call repeatedly — existing
   * categories (including ones the owner renamed) are left untouched.
   */
  async ensureCategories(): Promise<ExpenseCategoryDoc[]> {
    await ExpenseCategoryRepository.seedDefaults();
    return ExpenseCategoryRepository.list();
  },

  async createCategory(
    input: { key: string; name: string; description: string; isInventoryProcurement: boolean },
    actor: ActorRef
  ): Promise<ExpenseCategoryDoc> {
    const category = await ExpenseCategoryRepository.create({
      ...input,
      sortOrder: 999,
      active: true,
    });
    await auditService.record({
      action: 'settings.updated',
      entity: 'settings',
      entityId: category.id,
      entityLabel: category.name,
      summary: `Added expense category “${category.name}”`,
      actor,
      after: { ...input },
    });
    return category;
  },

  // ────────────────────────────── Expenses ─────────────────────────────────

  async listExpenses(range?: DateRange | null): Promise<Expense[]> {
    return ExpenseRepository.list(range);
  },

  /**
   * Record an expense, and (unless it is unpaid) the cash that settled it.
   *
   * The category's `isInventoryProcurement` flag is snapshotted onto the expense
   * so the P&L can exclude stock purchases from operating expenses even if the
   * category is reclassified later.
   */
  async recordExpense(args: RecordExpenseArgs): Promise<Expense> {
    if (args.amount <= 0) {
      throw new AppError('invalid-argument', 'Enter an amount greater than zero.');
    }

    const categories = await ExpenseCategoryRepository.list();
    const category = categories.find((entry) => entry.id === args.categoryId);
    if (!category) {
      throw new AppError('not-found', 'That expense category no longer exists.');
    }

    const expense = await ExpenseRepository.create({
      amount: args.amount,
      currency: args.currency,
      categoryId: category.id,
      categoryName: category.name,
      isInventoryProcurement: category.isInventoryProcurement,
      incurredAt: args.incurredAt,
      paymentMethod: args.paymentMethod,
      description: args.description,
      reference: args.reference,
      attachmentUrl: null,
      createdBy: args.actor,
    });

    if (args.paid) {
      await CashRepository.create({
        direction: 'outflow',
        amount: args.amount,
        currency: args.currency,
        source: 'expense',
        category: category.name,
        description: args.description || `${category.name} expense`,
        occurredAt: args.incurredAt,
        paymentMethod: args.paymentMethod,
        reference: { kind: 'expense', id: expense.id, label: args.reference || category.name },
        createdBy: args.actor,
      });
    }

    await auditService.record({
      action: 'expense.created',
      entity: 'expense',
      entityId: expense.id,
      entityLabel: category.name,
      summary: `Recorded ${args.amount} ${args.currency} of ${category.name}${args.paid ? '' : ' (unpaid)'}`,
      actor: args.actor,
      after: {
        amount: args.amount,
        category: category.name,
        paid: args.paid,
        paymentMethod: args.paymentMethod,
      },
    });

    return expense;
  },

  /**
   * Delete an expense record.
   *
   * Any cash entry it produced stays in the ledger: the money really did move,
   * and removing it would make the cash balance disagree with the bank. To
   * reverse the cash, record a compensating entry.
   */
  async deleteExpense(id: string, actor: ActorRef): Promise<void> {
    const expense = await ExpenseRepository.getById(id);
    await ExpenseRepository.remove(id);

    await auditService.record({
      action: 'expense.deleted',
      entity: 'expense',
      entityId: id,
      entityLabel: expense?.categoryName ?? 'Expense',
      summary: expense
        ? `Deleted a ${expense.amount} ${expense.currency} ${expense.categoryName} expense (any cash entry was kept)`
        : 'Deleted an expense',
      actor,
      before: expense ? { amount: expense.amount, category: expense.categoryName } : null,
    });
  },

  // ───────────────────────────── Cash ledger ───────────────────────────────

  async listCash(range?: DateRange | null): Promise<CashTransaction[]> {
    return CashRepository.list(range);
  },

  /** Every entry, oldest first — needed to compute an opening balance. */
  async listAllCash(): Promise<CashTransaction[]> {
    return CashRepository.listAll();
  },

  /** Record a cash movement by hand (owner drawings, capital, other income). */
  async recordCash(args: RecordCashArgs): Promise<CashTransaction> {
    if (args.amount <= 0) {
      throw new AppError('invalid-argument', 'Enter an amount greater than zero.');
    }

    const transaction = await CashRepository.create({
      direction: args.direction,
      amount: args.amount,
      currency: args.currency,
      source: args.direction === 'inflow' ? 'other_income' : 'manual',
      category: args.category,
      description: args.description,
      occurredAt: args.occurredAt,
      paymentMethod: args.paymentMethod,
      reference: { kind: 'manual', id: '', label: args.reference },
      createdBy: args.actor,
    });

    await auditService.record({
      action: 'cash.recorded',
      entity: 'cash_transaction',
      entityId: transaction.id,
      entityLabel: args.category || 'Manual entry',
      summary: `${args.direction === 'inflow' ? 'Money in' : 'Money out'}: ${args.amount} ${args.currency} — ${args.category || 'manual entry'}`,
      actor: args.actor,
      after: {
        direction: args.direction,
        amount: args.amount,
        category: args.category,
        paymentMethod: args.paymentMethod,
      },
    });

    return transaction;
  },
};

export type FinanceService = typeof financeService;
