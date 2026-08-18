'use client';

/**
 * Expenses and cash flow.
 *
 * These two screens are deliberately separate because they record different
 * facts. An **expense** is a cost the business incurred; a **cash transaction**
 * is money that actually moved. Recording an expense usually writes both, but an
 * unpaid invoice writes only the expense — which is what lets the P&L reflect
 * costs as incurred while the cash balance still reconciles to the bank.
 */
import * as React from 'react';
import { ArrowDownLeft, ArrowUpRight, Banknote, Plus, Receipt, Trash2, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/admin/ui/page-header';
import { EmptyState } from '@/components/admin/ui/empty-state';
import { ConfirmDialog } from '@/components/admin/ui/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Field, Input, Select, Textarea } from '@/components/admin/ui/control';
import { useToast } from '@/components/ui/toast';
import { useAuth, can } from '@/lib/auth';
import { useCurrency } from '@/hooks/use-currency';
import {
  useExpenseCategoriesQuery,
  useExpensesQuery,
  useSeedExpenseCategories,
  useRecordExpense,
  useDeleteExpense,
  useCashLedgerQuery,
  useRecordCash,
} from '@/hooks/queries';
import type { CashDirection, Expense, PaymentMethod } from '@/types/business';
import { PAYMENT_METHODS } from '@/types/business';
import {
  cashFlowSummary,
  cashSeries,
  dayKey,
  expenseBreakdown,
  formatDate,
  formatDayLabel,
  transactionsInRange,
} from '@/lib/business';
import { MetricCard } from './metric-card';
import { BreakdownTable } from './breakdown-table';
import { DateRangePicker, useDateRange } from './date-range-picker';
import { ExportButton } from './export-button';
import { LineChart, RankBars } from './charts';

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank transfer',
  card: 'Card',
  mobile_wallet: 'Mobile wallet',
  cheque: 'Cheque',
  other: 'Other',
};

// ──────────────────────────────── Expenses ───────────────────────────────────

export function ExpensesBrowser() {
  const { user } = useAuth();
  const canManage = can(user?.role ?? 'viewer', 'finance.manage');

  const toast = useToast();
  const { formatPrice } = useCurrency();
  const dates = useDateRange('this_month');

  const categoriesQuery = useExpenseCategoriesQuery();
  const expensesQuery = useExpensesQuery(dates.range);
  const seed = useSeedExpenseCategories();
  const remove = useDeleteExpense();

  const [recording, setRecording] = React.useState(false);
  const [deleting, setDeleting] = React.useState<Expense | null>(null);

  const categories = categoriesQuery.data ?? [];
  const expenses = React.useMemo(() => expensesQuery.data ?? [], [expensesQuery.data]);
  const split = React.useMemo(() => expenseBreakdown(expenses), [expenses]);

  const needsSeed = !categoriesQuery.isLoading && categories.length === 0;

  return (
    <div>
      <PageHeader
        title="Expenses"
        description="What the business spends. Stock purchases are tracked separately — they become cost of goods when the stock sells."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker state={dates} />
            <ExportButton
              kind="expenses"
              range={dates.range}
              getRows={() => expenses}
              columns={[
                { header: 'Date', value: (row) => formatDate(row.incurredAt) },
                { header: 'Category', value: (row) => row.categoryName },
                { header: 'Amount', value: (row) => row.amount },
                { header: 'Currency', value: (row) => row.currency },
                { header: 'Method', value: (row) => METHOD_LABELS[row.paymentMethod] },
                { header: 'Description', value: (row) => row.description },
                { header: 'Reference', value: (row) => row.reference },
                {
                  header: 'Inventory purchase',
                  value: (row) => (row.isInventoryProcurement ? 'Yes' : 'No'),
                },
                { header: 'Recorded by', value: (row) => row.createdBy.label },
              ]}
            />
            {canManage && (
              <Button
                size="sm"
                variant="brand"
                className="rounded-lg"
                onClick={() => setRecording(true)}
                disabled={needsSeed}
              >
                <Plus className="size-4" /> Record expense
              </Button>
            )}
          </div>
        }
      />

      {needsSeed && (
        <div className="border-border bg-card mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
          <div>
            <p className="text-foreground text-sm font-medium">Set up expense categories</p>
            <p className="text-muted-foreground text-xs text-pretty">
              Adds the standard categories (advertising, shipping, salaries, rent…). You can rename
              or add to them afterwards.
            </p>
          </div>
          <Button
            size="sm"
            variant="brand"
            className="rounded-lg"
            disabled={seed.isPending}
            onClick={() =>
              seed.mutate(undefined, {
                onSuccess: () => toast.success('Expense categories created.'),
                onError: (error) => toast.error(error.message),
              })
            }
          >
            {seed.isPending ? 'Creating…' : 'Create categories'}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          label="Operating expenses"
          value={formatPrice(split.operating)}
          icon={Receipt}
          caption="Counted against operating profit"
          polarity="lower_is_better"
          loading={expensesQuery.isLoading}
        />
        <MetricCard
          label="Inventory purchases"
          value={formatPrice(split.inventoryProcurement)}
          icon={Wallet}
          caption="Excluded — becomes cost of goods on sale"
          polarity="neutral"
          loading={expensesQuery.isLoading}
        />
        <MetricCard
          label="Entries"
          value={String(split.count)}
          icon={Receipt}
          caption={dates.range.label}
          polarity="neutral"
          loading={expensesQuery.isLoading}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="border-border bg-card rounded-xl border p-5">
          <h2 className="text-foreground mb-4 text-sm font-semibold">By category</h2>
          <RankBars
            rows={split.byCategory.map((group) => ({
              label: group.categoryName,
              value: group.amount,
              hint: `${group.count} entr${group.count === 1 ? 'y' : 'ies'}`,
            }))}
            format={formatPrice}
            slot={2}
            emptyMessage="No expenses in this period."
          />
        </div>

        <div className="border-border bg-card rounded-xl border lg:col-span-2">
          <div className="border-border border-b px-5 py-4">
            <h2 className="text-foreground text-sm font-semibold">Expense records</h2>
          </div>
          <BreakdownTable
            rows={expenses}
            rowKey={(row) => row.id}
            initialRows={15}
            empty={
              <EmptyState
                icon={Receipt}
                title="No expenses recorded"
                description="Record what the business spends to see operating profit and cash flow."
              />
            }
            columns={[
              {
                key: 'date',
                header: 'Date',
                cell: (row) => (
                  <span className="text-muted-foreground text-xs whitespace-nowrap">
                    {formatDate(row.incurredAt)}
                  </span>
                ),
              },
              {
                key: 'category',
                header: 'Category',
                cell: (row) => (
                  <div className="min-w-0">
                    <p className="truncate font-medium">{row.categoryName}</p>
                    {row.description && (
                      <p className="text-muted-foreground truncate text-xs">{row.description}</p>
                    )}
                  </div>
                ),
              },
              {
                key: 'method',
                header: 'Method',
                hideOnMobile: true,
                cell: (row) => (
                  <span className="text-muted-foreground text-xs">
                    {METHOD_LABELS[row.paymentMethod]}
                  </span>
                ),
              },
              {
                key: 'amount',
                header: 'Amount',
                align: 'right',
                cell: (row) => formatPrice(row.amount, row.currency),
              },
              {
                key: 'actions',
                header: '',
                align: 'right',
                cell: (row) =>
                  canManage ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-lg"
                      onClick={() => setDeleting(row)}
                    >
                      <Trash2 className="size-3.5" />
                      <span className="sr-only">Delete expense</span>
                    </Button>
                  ) : null,
              },
            ]}
          />
        </div>
      </div>

      {recording && <RecordExpenseModal onClose={() => setRecording(false)} />}

      {deleting && (
        <ConfirmDialog
          open
          title="Delete this expense?"
          description="The expense record is removed, but any cash entry it created stays in the ledger — the money still moved. To reverse the cash, record a compensating entry."
          confirmLabel="Delete expense"
          tone="destructive"
          onClose={() => setDeleting(null)}
          onConfirm={() =>
            remove.mutate(deleting.id, {
              onSuccess: () => {
                toast.success('Expense deleted.');
                setDeleting(null);
              },
              onError: (error) => {
                toast.error(error.message);
                setDeleting(null);
              },
            })
          }
        />
      )}
    </div>
  );
}

function RecordExpenseModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const { currency } = useCurrency();
  const categoriesQuery = useExpenseCategoriesQuery();
  const record = useRecordExpense();

  const categories = (categoriesQuery.data ?? []).filter((category) => category.active);

  const [amount, setAmount] = React.useState('');
  const [categoryId, setCategoryId] = React.useState('');
  const [incurredAt, setIncurredAt] = React.useState(dayKey(new Date()));
  const [method, setMethod] = React.useState<PaymentMethod>('cash');
  const [description, setDescription] = React.useState('');
  const [reference, setReference] = React.useState('');
  const [paid, setPaid] = React.useState(true);

  const parsed = Number.parseFloat(amount);
  const valid = Number.isFinite(parsed) && parsed > 0 && Boolean(categoryId);

  const selected = categories.find((category) => category.id === categoryId);

  return (
    <Modal open onClose={onClose} title="Record expense">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!valid) return;
          record.mutate(
            {
              amount: parsed,
              currency,
              categoryId,
              incurredAt: new Date(`${incurredAt}T00:00:00`),
              paymentMethod: method,
              description: description.trim(),
              reference: reference.trim(),
              paid,
            },
            {
              onSuccess: () => {
                toast.success('Expense recorded.');
                onClose();
              },
              onError: (error) => toast.error(error.message),
            }
          );
        }}
        className="space-y-4"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={`Amount (${currency})`} required>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              autoFocus
            />
          </Field>
          <Field label="Date" required>
            <Input
              type="date"
              value={incurredAt}
              onChange={(event) => setIncurredAt(event.target.value)}
            />
          </Field>
        </div>

        <Field label="Category" required>
          <Select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">Select a category…</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </Field>

        {selected?.isInventoryProcurement && (
          <p className="text-muted-foreground rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-pretty">
            This category is marked as inventory procurement, so it is excluded from operating
            expenses — the spend becomes cost of goods when the stock sells. For accurate stock
            costs, record it as a purchase order instead.
          </p>
        )}

        <Field label="Payment method">
          <Select
            value={method}
            onChange={(event) => setMethod(event.target.value as PaymentMethod)}
          >
            {PAYMENT_METHODS.map((option) => (
              <option key={option} value={option}>
                {METHOD_LABELS[option]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Description">
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={500}
          />
        </Field>

        <Field label="Reference" hint="Invoice or receipt number.">
          <Input
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            maxLength={120}
          />
        </Field>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={paid}
            onChange={(event) => setPaid(event.target.checked)}
            className="accent-brand mt-0.5 size-4"
          />
          <span>
            <span className="text-foreground font-medium">Already paid</span>
            <span className="text-muted-foreground block text-xs">
              Also records the cash outflow. Uncheck for an unpaid invoice — add the payment later.
            </span>
          </span>
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-lg"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="brand"
            size="sm"
            className="rounded-lg"
            disabled={!valid || record.isPending}
          >
            {record.isPending ? 'Saving…' : 'Record expense'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ──────────────────────────────── Cash flow ──────────────────────────────────

export function CashFlowBrowser() {
  const { user } = useAuth();
  const canManage = can(user?.role ?? 'viewer', 'finance.manage');

  const { formatPrice } = useCurrency();
  const dates = useDateRange('this_month');
  const ledgerQuery = useCashLedgerQuery();

  const [recording, setRecording] = React.useState(false);

  const ledger = React.useMemo(() => ledgerQuery.data ?? [], [ledgerQuery.data]);
  const summary = React.useMemo(() => cashFlowSummary(ledger, dates.range), [ledger, dates.range]);
  const series = React.useMemo(() => cashSeries(ledger, dates.range), [ledger, dates.range]);
  const period = React.useMemo(
    () => transactionsInRange(ledger, dates.range),
    [ledger, dates.range]
  );

  return (
    <div>
      <PageHeader
        title="Cash flow"
        description="Money that actually moved — deliberately different from revenue, which is recognised when an order is placed."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker state={dates} />
            <ExportButton
              kind="cash-flow"
              range={dates.range}
              getRows={() => period}
              columns={[
                { header: 'Date', value: (row) => formatDate(row.occurredAt) },
                {
                  header: 'Direction',
                  value: (row) => (row.direction === 'inflow' ? 'In' : 'Out'),
                },
                { header: 'Amount', value: (row) => row.amount },
                { header: 'Currency', value: (row) => row.currency },
                { header: 'Source', value: (row) => row.source },
                { header: 'Category', value: (row) => row.category },
                { header: 'Method', value: (row) => METHOD_LABELS[row.paymentMethod] },
                { header: 'Description', value: (row) => row.description },
                { header: 'Reference', value: (row) => row.reference.label },
                { header: 'Recorded by', value: (row) => row.createdBy.label },
              ]}
            />
            {canManage && (
              <Button
                size="sm"
                variant="brand"
                className="rounded-lg"
                onClick={() => setRecording(true)}
              >
                <Plus className="size-4" /> Record cash
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Opening balance"
          value={formatPrice(summary.openingBalance)}
          icon={Banknote}
          caption="Net of everything before this period"
          polarity="neutral"
          loading={ledgerQuery.isLoading}
        />
        <MetricCard
          label="Money in"
          value={formatPrice(summary.inflows)}
          icon={ArrowDownLeft}
          caption="Cash received"
          loading={ledgerQuery.isLoading}
        />
        <MetricCard
          label="Money out"
          value={formatPrice(summary.outflows)}
          icon={ArrowUpRight}
          caption="Cash paid"
          polarity="lower_is_better"
          loading={ledgerQuery.isLoading}
        />
        <MetricCard
          label="Net cash flow"
          value={formatPrice(summary.netCashFlow)}
          icon={Wallet}
          caption="In − out"
          loading={ledgerQuery.isLoading}
        />
        <MetricCard
          label="Closing balance"
          value={formatPrice(summary.closingBalance)}
          icon={Banknote}
          caption="Opening + net"
          polarity="neutral"
          loading={ledgerQuery.isLoading}
          emphasis
        />
      </div>

      <div className="border-border bg-card mt-6 rounded-xl border p-5">
        <h2 className="text-foreground mb-2 text-sm font-semibold">Money in and out</h2>
        <LineChart
          labels={series.map((point) => formatDayLabel(point.dayKey))}
          series={[
            { label: 'Money in', values: series.map((point) => point.inflow), slot: 1 },
            { label: 'Money out', values: series.map((point) => point.outflow), slot: 2 },
          ]}
          format={formatPrice}
          ariaLabel={`Daily cash in and out, ${dates.range.label}`}
          emptyMessage="No cash movement in this period."
        />
      </div>

      <div className="border-border bg-card mt-6 rounded-xl border">
        <div className="border-border border-b px-5 py-4">
          <h2 className="text-foreground text-sm font-semibold">Transactions</h2>
          <p className="text-muted-foreground text-xs">
            Append-only. Corrections are made by recording a reversing entry.
          </p>
        </div>
        <BreakdownTable
          rows={period}
          rowKey={(row) => row.id}
          initialRows={20}
          empty={
            <EmptyState
              icon={Wallet}
              title="No cash movement in this period"
              description="Record customer payments, supplier payments and expenses to build a cash picture."
            />
          }
          columns={[
            {
              key: 'date',
              header: 'Date',
              cell: (row) => (
                <span className="text-muted-foreground text-xs whitespace-nowrap">
                  {formatDate(row.occurredAt)}
                </span>
              ),
            },
            {
              key: 'description',
              header: 'Description',
              cell: (row) => (
                <div className="min-w-0">
                  <p className="truncate font-medium">{row.category || row.source}</p>
                  {row.description && (
                    <p className="text-muted-foreground truncate text-xs">{row.description}</p>
                  )}
                </div>
              ),
            },
            {
              key: 'method',
              header: 'Method',
              hideOnMobile: true,
              cell: (row) => (
                <span className="text-muted-foreground text-xs">
                  {METHOD_LABELS[row.paymentMethod]}
                </span>
              ),
            },
            {
              key: 'amount',
              header: 'Amount',
              align: 'right',
              cell: (row) => (
                <span
                  className={
                    row.direction === 'inflow'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }
                >
                  {row.direction === 'inflow' ? '+' : '−'}
                  {formatPrice(row.amount, row.currency)}
                </span>
              ),
            },
          ]}
        />
      </div>

      {recording && <RecordCashModal onClose={() => setRecording(false)} />}
    </div>
  );
}

function RecordCashModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const { currency } = useCurrency();
  const record = useRecordCash();

  const [direction, setDirection] = React.useState<CashDirection>('inflow');
  const [amount, setAmount] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [occurredAt, setOccurredAt] = React.useState(dayKey(new Date()));
  const [method, setMethod] = React.useState<PaymentMethod>('cash');
  const [reference, setReference] = React.useState('');

  const parsed = Number.parseFloat(amount);
  const valid = Number.isFinite(parsed) && parsed > 0;

  return (
    <Modal open onClose={onClose} title="Record a cash movement">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!valid) return;
          record.mutate(
            {
              direction,
              amount: parsed,
              currency,
              category: category.trim(),
              description: description.trim(),
              occurredAt: new Date(`${occurredAt}T00:00:00`),
              paymentMethod: method,
              reference: reference.trim(),
            },
            {
              onSuccess: () => {
                toast.success('Cash entry recorded.');
                onClose();
              },
              onError: (error) => toast.error(error.message),
            }
          );
        }}
        className="space-y-4"
      >
        <p className="text-muted-foreground text-sm text-pretty">
          Use this for movements that aren’t already captured elsewhere — owner drawings, capital
          put in, other income. Customer payments, supplier payments and expenses record their own
          cash entries.
        </p>

        <Field label="Direction" required>
          <Select
            value={direction}
            onChange={(event) => setDirection(event.target.value as CashDirection)}
          >
            <option value="inflow">Money in</option>
            <option value="outflow">Money out</option>
          </Select>
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={`Amount (${currency})`} required>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              autoFocus
            />
          </Field>
          <Field label="Date" required>
            <Input
              type="date"
              value={occurredAt}
              onChange={(event) => setOccurredAt(event.target.value)}
            />
          </Field>
        </div>

        <Field label="Category" hint="e.g. Owner drawings, Capital injection">
          <Input
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            maxLength={120}
          />
        </Field>

        <Field label="Payment method">
          <Select
            value={method}
            onChange={(event) => setMethod(event.target.value as PaymentMethod)}
          >
            {PAYMENT_METHODS.map((option) => (
              <option key={option} value={option}>
                {METHOD_LABELS[option]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Description">
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={500}
          />
        </Field>

        <Field label="Reference">
          <Input
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            maxLength={120}
          />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-lg"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="brand"
            size="sm"
            className="rounded-lg"
            disabled={!valid || record.isPending}
          >
            {record.isPending ? 'Saving…' : 'Record entry'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
