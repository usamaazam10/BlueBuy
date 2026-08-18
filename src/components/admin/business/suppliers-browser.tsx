'use client';

/**
 * Supplier management.
 *
 * Deleting is intentionally restrictive: the repository refuses while purchase
 * orders reference the supplier, so procurement history can never point at a
 * missing record. Deactivating is offered instead, which keeps the supplier out
 * of new purchase orders while leaving history readable.
 */
import * as React from 'react';
import { Building2, Pencil, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/admin/ui/page-header';
import { EmptyState } from '@/components/admin/ui/empty-state';
import { ConfirmDialog } from '@/components/admin/ui/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Field, Input, Switch, Textarea } from '@/components/admin/ui/control';
import { useToast } from '@/components/ui/toast';
import { useAuth, can } from '@/lib/auth';
import {
  useSuppliersQuery,
  useCreateSupplier,
  useUpdateSupplier,
  useDeleteSupplier,
} from '@/hooks/queries';
import type { Supplier } from '@/types/business';
import { BreakdownTable } from './breakdown-table';

export function SuppliersBrowser() {
  const { user } = useAuth();
  const canManage = can(user?.role ?? 'viewer', 'purchases.manage');

  const toast = useToast();
  const suppliersQuery = useSuppliersQuery();
  const remove = useDeleteSupplier();

  const [editing, setEditing] = React.useState<Supplier | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [deleting, setDeleting] = React.useState<Supplier | null>(null);

  const suppliers = suppliersQuery.data ?? [];

  return (
    <div>
      <PageHeader
        title="Suppliers"
        description="Who you buy stock from. Purchase orders snapshot the name, so history survives changes here."
        actions={
          canManage ? (
            <Button
              size="sm"
              variant="brand"
              className="rounded-lg"
              onClick={() => setCreating(true)}
            >
              <Plus className="size-4" /> Add supplier
            </Button>
          ) : null
        }
      />

      <div className="border-border bg-card rounded-xl border">
        <BreakdownTable
          rows={suppliers}
          rowKey={(row) => row.id}
          empty={
            <EmptyState
              icon={Building2}
              title="No suppliers yet"
              description="Add the businesses you buy stock from, then raise purchase orders against them."
              action={
                canManage ? (
                  <Button
                    size="sm"
                    variant="brand"
                    className="rounded-lg"
                    onClick={() => setCreating(true)}
                  >
                    <Plus className="size-4" /> Add your first supplier
                  </Button>
                ) : undefined
              }
            />
          }
          columns={[
            {
              key: 'name',
              header: 'Supplier',
              cell: (row) => (
                <div className="min-w-0">
                  <p className="truncate font-medium">{row.name}</p>
                  {row.contactPerson && (
                    <p className="text-muted-foreground truncate text-xs">{row.contactPerson}</p>
                  )}
                </div>
              ),
            },
            {
              key: 'contact',
              header: 'Contact',
              hideOnMobile: true,
              cell: (row) => (
                <div className="text-muted-foreground text-xs">
                  {row.phone && <p>{row.phone}</p>}
                  {row.email && <p className="truncate">{row.email}</p>}
                  {!row.phone && !row.email && <p>—</p>}
                </div>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              cell: (row) => (
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    row.active
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {row.active ? 'Active' : 'Inactive'}
                </span>
              ),
            },
            {
              key: 'actions',
              header: '',
              align: 'right',
              cell: (row) =>
                canManage ? (
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-lg"
                      onClick={() => setEditing(row)}
                    >
                      <Pencil className="size-3.5" />
                      <span className="sr-only">Edit {row.name}</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-lg"
                      onClick={() => setDeleting(row)}
                    >
                      <Trash2 className="size-3.5" />
                      <span className="sr-only">Delete {row.name}</span>
                    </Button>
                  </div>
                ) : null,
            },
          ]}
        />
      </div>

      {(creating || editing) && (
        <SupplierModal
          supplier={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          open
          title={`Delete ${deleting.name}?`}
          description="This cannot be undone. If the supplier has purchase orders, deletion is blocked — mark them inactive instead so history stays intact."
          confirmLabel="Delete supplier"
          tone="destructive"
          onClose={() => setDeleting(null)}
          onConfirm={() => {
            remove.mutate(deleting.id, {
              onSuccess: () => {
                toast.success('Supplier deleted.');
                setDeleting(null);
              },
              onError: (error) => {
                toast.error(error.message);
                setDeleting(null);
              },
            });
          }}
        />
      )}
    </div>
  );
}

function SupplierModal({ supplier, onClose }: { supplier: Supplier | null; onClose: () => void }) {
  const toast = useToast();
  const create = useCreateSupplier();
  const update = useUpdateSupplier();

  const [form, setForm] = React.useState({
    name: supplier?.name ?? '',
    contactPerson: supplier?.contactPerson ?? '',
    phone: supplier?.phone ?? '',
    email: supplier?.email ?? '',
    address: supplier?.address ?? '',
    notes: supplier?.notes ?? '',
    active: supplier?.active ?? true,
  });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const pending = create.isPending || update.isPending;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return;

    const handlers = {
      onSuccess: () => {
        toast.success(supplier ? 'Supplier updated.' : 'Supplier added.');
        onClose();
      },
      onError: (error: Error) => toast.error(error.message),
    };

    if (supplier) update.mutate({ id: supplier.id, input: form }, handlers);
    else create.mutate(form, handlers);
  };

  return (
    <Modal open onClose={onClose} title={supplier ? `Edit ${supplier.name}` : 'Add supplier'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Name" required>
          <Input
            value={form.name}
            onChange={(event) => set('name', event.target.value)}
            maxLength={160}
            autoFocus
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Contact person">
            <Input
              value={form.contactPerson}
              onChange={(event) => set('contactPerson', event.target.value)}
              maxLength={120}
            />
          </Field>
          <Field label="Phone">
            <Input
              value={form.phone}
              onChange={(event) => set('phone', event.target.value)}
              maxLength={40}
            />
          </Field>
        </div>

        <Field label="Email">
          <Input
            type="email"
            value={form.email}
            onChange={(event) => set('email', event.target.value)}
            maxLength={200}
          />
        </Field>

        <Field label="Address">
          <Textarea
            value={form.address}
            onChange={(event) => set('address', event.target.value)}
            maxLength={500}
          />
        </Field>

        <Field label="Notes">
          <Textarea
            value={form.notes}
            onChange={(event) => set('notes', event.target.value)}
            maxLength={2000}
          />
        </Field>

        <div className="flex items-start gap-3">
          <Switch
            id="supplier-active"
            checked={form.active}
            onCheckedChange={(checked) => set('active', checked)}
            aria-label="Active"
          />
          <label htmlFor="supplier-active" className="cursor-pointer">
            <span className="text-foreground text-sm font-medium">Active</span>
            <span className="text-muted-foreground block text-xs">
              Inactive suppliers are hidden from new purchase orders.
            </span>
          </label>
        </div>

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
            disabled={!form.name.trim() || pending}
          >
            {pending ? 'Saving…' : supplier ? 'Save changes' : 'Add supplier'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
