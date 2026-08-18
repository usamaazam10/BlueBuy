/**
 * Finance repositories — expenses, expense categories and the cash ledger.
 *
 * Two deliberate asymmetries:
 *
 *  - **Expenses are editable, cash entries are not.** An expense is a
 *    description of something that happened and may be corrected (wrong
 *    category, typo in the amount). A cash transaction is a record that money
 *    moved; correcting one means writing a reversing entry, never mutating the
 *    original. `CashRepository` therefore exposes no update or delete.
 *
 *  - **Deleting an expense does not delete its cash entry.** Accounting history
 *    survives the description being removed — see BUSINESS_OPERATIONS.md
 *    § Data integrity.
 */
import {
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { getDb, AppError, withAppError } from '@/firebase';
import { COLLECTIONS } from '@/types/models';
import {
  DEFAULT_EXPENSE_CATEGORIES,
  type CashTransaction,
  type Expense,
  type ExpenseCategoryDoc,
} from '@/types/business';
import {
  cashTransactionCreateSchema,
  expenseCategoryCreateSchema,
  expenseCategoryUpdateSchema,
  expenseCreateSchema,
  expenseUpdateSchema,
  type CashTransactionCreateInput,
  type ExpenseCategoryCreateInput,
  type ExpenseCreateInput,
  type ExpenseUpdateInput,
} from '@/lib/validations';
import type { DateRange } from '@/lib/business/date-range';
import {
  collectionRef,
  fromSnapshot,
  pruneUndefined,
  queryIn,
  rangeConstraints,
  DEFAULT_QUERY_LIMIT,
} from './shared';

// ────────────────────────── Expense categories ───────────────────────────────

export const ExpenseCategoryRepository = {
  /** All categories, in display order. */
  async list(): Promise<ExpenseCategoryDoc[]> {
    return withAppError(async () => {
      const snap = await getDocs(
        query(collectionRef(COLLECTIONS.expenseCategories), orderBy('sortOrder', 'asc'))
      );
      return snap.docs.map((d) => fromSnapshot<ExpenseCategoryDoc>(d));
    }, 'list expense categories');
  },

  async create(input: ExpenseCategoryCreateInput): Promise<ExpenseCategoryDoc> {
    const data = expenseCategoryCreateSchema.parse(input);
    return withAppError(async () => {
      const ref = await addDoc(collectionRef(COLLECTIONS.expenseCategories), {
        ...pruneUndefined(data),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      const created = await getDoc(ref);
      return fromSnapshot<ExpenseCategoryDoc>(created as QueryDocumentSnapshot<DocumentData>);
    }, 'create expense category');
  },

  async update(
    id: string,
    input: Partial<ExpenseCategoryCreateInput>
  ): Promise<ExpenseCategoryDoc> {
    const data = expenseCategoryUpdateSchema.parse(input);
    return withAppError(async () => {
      const ref = doc(getDb(), COLLECTIONS.expenseCategories, id);
      await updateDoc(ref, { ...pruneUndefined(data), updatedAt: serverTimestamp() });
      const updated = await getDoc(ref);
      if (!updated.exists()) throw new AppError('not-found', 'That category no longer exists.');
      return fromSnapshot<ExpenseCategoryDoc>(updated);
    }, 'update expense category');
  },

  /**
   * Seed the default categories, idempotently.
   *
   * Categories already present (matched on their stable `key`) are left exactly
   * as they are, including any edits the owner made — so this is safe to run
   * repeatedly and safe to run on an existing store.
   */
  async seedDefaults(): Promise<{ created: number; skipped: number }> {
    return withAppError(async () => {
      const existing = await this.list();
      const keys = new Set(existing.map((category) => category.key));

      const missing = DEFAULT_EXPENSE_CATEGORIES.filter((category) => !keys.has(category.key));
      if (missing.length === 0) return { created: 0, skipped: existing.length };

      const batch = writeBatch(getDb());
      missing.forEach((category, index) => {
        batch.set(doc(collectionRef(COLLECTIONS.expenseCategories)), {
          ...category,
          sortOrder: existing.length + index,
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();

      return { created: missing.length, skipped: existing.length };
    }, 'seed expense categories');
  },
};

// ──────────────────────────────── Expenses ───────────────────────────────────

export const ExpenseRepository = {
  /** Expenses in a period, newest first. */
  async list(range?: DateRange | null, max = DEFAULT_QUERY_LIMIT): Promise<Expense[]> {
    return withAppError(async () => {
      const snap = await getDocs(
        queryIn(COLLECTIONS.expenses, rangeConstraints('incurredAt', range, max))
      );
      return snap.docs.map((d) => fromSnapshot<Expense>(d));
    }, 'list expenses');
  },

  async getById(id: string): Promise<Expense | null> {
    return withAppError(async () => {
      const snapshot = await getDoc(doc(getDb(), COLLECTIONS.expenses, id));
      return snapshot.exists() ? fromSnapshot<Expense>(snapshot) : null;
    }, 'load expense');
  },

  async create(input: ExpenseCreateInput): Promise<Expense> {
    const data = expenseCreateSchema.parse(input);
    return withAppError(async () => {
      const ref = await addDoc(collectionRef(COLLECTIONS.expenses), {
        ...pruneUndefined(data),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      const created = await getDoc(ref);
      return fromSnapshot<Expense>(created as QueryDocumentSnapshot<DocumentData>);
    }, 'record expense');
  },

  async update(id: string, input: ExpenseUpdateInput): Promise<Expense> {
    const data = expenseUpdateSchema.parse(input);
    return withAppError(async () => {
      const ref = doc(getDb(), COLLECTIONS.expenses, id);
      await updateDoc(ref, { ...pruneUndefined(data), updatedAt: serverTimestamp() });
      const updated = await getDoc(ref);
      if (!updated.exists()) throw new AppError('not-found', 'That expense no longer exists.');
      return fromSnapshot<Expense>(updated);
    }, 'update expense');
  },

  /**
   * Delete an expense record. Any cash entry it generated is deliberately left
   * in the ledger — the money still moved, and silently unwinding it would make
   * the cash balance disagree with the bank.
   */
  async remove(id: string): Promise<void> {
    return withAppError(async () => {
      await deleteDoc(doc(getDb(), COLLECTIONS.expenses, id));
    }, 'delete expense');
  },
};

// ────────────────────────────── Cash ledger ──────────────────────────────────

export const CashRepository = {
  /**
   * Cash transactions in a period, newest first.
   *
   * Note the deliberate lack of `update`/`remove`: the ledger is append-only.
   */
  async list(range?: DateRange | null, max = DEFAULT_QUERY_LIMIT): Promise<CashTransaction[]> {
    return withAppError(async () => {
      const snap = await getDocs(
        queryIn(COLLECTIONS.cashTransactions, rangeConstraints('occurredAt', range, max))
      );
      return snap.docs.map((d) => fromSnapshot<CashTransaction>(d));
    }, 'list cash transactions');
  },

  /**
   * Every cash transaction, oldest first.
   *
   * Needed to compute an opening balance, which is by definition the net of all
   * prior history. See BUSINESS_OPERATIONS.md § Performance for the snapshot
   * strategy if this ledger ever grows beyond a comfortable single read.
   */
  async listAll(max = DEFAULT_QUERY_LIMIT * 5): Promise<CashTransaction[]> {
    return withAppError(async () => {
      const snap = await getDocs(
        query(collectionRef(COLLECTIONS.cashTransactions), orderBy('occurredAt', 'asc'), limit(max))
      );
      return snap.docs.map((d) => fromSnapshot<CashTransaction>(d));
    }, 'list cash transactions');
  },

  /** Entries tied to a specific source document (an order, a purchase, …). */
  async listForReference(kind: string, id: string): Promise<CashTransaction[]> {
    return withAppError(async () => {
      const snap = await getDocs(
        query(
          collectionRef(COLLECTIONS.cashTransactions),
          where('reference.kind', '==', kind),
          where('reference.id', '==', id)
        )
      );
      return snap.docs.map((d) => fromSnapshot<CashTransaction>(d));
    }, 'list cash transactions');
  },

  /** Append a cash entry. There is no counterpart update or delete by design. */
  async create(input: CashTransactionCreateInput): Promise<CashTransaction> {
    const data = cashTransactionCreateSchema.parse(input);
    return withAppError(async () => {
      const ref = await addDoc(collectionRef(COLLECTIONS.cashTransactions), {
        ...pruneUndefined(data),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      const created = await getDoc(ref);
      return fromSnapshot<CashTransaction>(created as QueryDocumentSnapshot<DocumentData>);
    }, 'record cash transaction');
  },
};

export type ExpenseRepositoryType = typeof ExpenseRepository;
export type ExpenseCategoryRepositoryType = typeof ExpenseCategoryRepository;
export type CashRepositoryType = typeof CashRepository;
