'use client';

/**
 * Finance hooks — expenses, expense categories and the cash ledger.
 *
 * Note `useCashLedgerQuery`, which reads the *whole* ledger rather than a
 * period: an opening balance is by definition the net of all prior history, so
 * a period-scoped read cannot produce one. It is cached aggressively for that
 * reason. See BUSINESS_OPERATIONS.md § Performance.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  financeService,
  type RecordCashArgs,
  type RecordExpenseArgs,
} from '@/services/finance.service';
import type { CashTransaction, Expense, ExpenseCategoryDoc } from '@/types/business';
import type { DateRange } from '@/lib/business/date-range';
import { useActor } from '@/hooks/use-actor';
import { queryKeys, rangeToken } from './keys';

/** Expense categories, seeding the defaults on first read. */
export function useExpenseCategoriesQuery() {
  return useQuery<ExpenseCategoryDoc[]>({
    queryKey: queryKeys.expenseCategories,
    queryFn: () => financeService.listCategories(),
    // Reference data: rarely changes, and several forms read it at once.
    staleTime: 5 * 60 * 1000,
  });
}

export function useExpensesQuery(range?: DateRange | null) {
  return useQuery<Expense[]>({
    queryKey: queryKeys.expenses(rangeToken(range)),
    queryFn: () => financeService.listExpenses(range),
  });
}

export function useCashTransactionsQuery(range?: DateRange | null) {
  return useQuery<CashTransaction[]>({
    queryKey: queryKeys.cashTransactions(rangeToken(range)),
    queryFn: () => financeService.listCash(range),
  });
}

/**
 * The entire cash ledger, oldest first.
 *
 * Required for opening/closing balances. Cached for a minute so the several
 * cash-aware panels on a dashboard share one read rather than each issuing
 * their own.
 */
export function useCashLedgerQuery() {
  return useQuery<CashTransaction[]>({
    queryKey: queryKeys.cashLedger,
    queryFn: () => financeService.listAllCash(),
    staleTime: 60 * 1000,
  });
}

/** Create the default expense categories if they don't exist yet. */
export function useSeedExpenseCategories() {
  const queryClient = useQueryClient();
  return useMutation<ExpenseCategoryDoc[], Error, void>({
    mutationFn: () => financeService.ensureCategories(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.expenseCategories });
    },
  });
}

export function useCreateExpenseCategory() {
  const queryClient = useQueryClient();
  const actor = useActor();
  return useMutation<
    ExpenseCategoryDoc,
    Error,
    { key: string; name: string; description: string; isInventoryProcurement: boolean }
  >({
    mutationFn: (input) => financeService.createCategory(input, actor),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.expenseCategories });
    },
  });
}

/** Record an expense (and, unless unpaid, the cash that settled it). */
export function useRecordExpense() {
  const queryClient = useQueryClient();
  const actor = useActor();
  return useMutation<Expense, Error, Omit<RecordExpenseArgs, 'actor'>>({
    mutationFn: (args) => financeService.recordExpense({ ...args, actor }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['expenses'] });
      void queryClient.invalidateQueries({ queryKey: ['cash_transactions'] });
      void queryClient.invalidateQueries({ queryKey: ['audit_logs'] });
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  const actor = useActor();
  return useMutation<void, Error, string>({
    mutationFn: (id) => financeService.deleteExpense(id, actor),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['expenses'] });
      void queryClient.invalidateQueries({ queryKey: ['audit_logs'] });
    },
  });
}

/** Record a manual cash movement. */
export function useRecordCash() {
  const queryClient = useQueryClient();
  const actor = useActor();
  return useMutation<CashTransaction, Error, Omit<RecordCashArgs, 'actor'>>({
    mutationFn: (args) => financeService.recordCash({ ...args, actor }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cash_transactions'] });
      void queryClient.invalidateQueries({ queryKey: ['audit_logs'] });
    },
  });
}
