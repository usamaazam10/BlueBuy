'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Switch } from '@/components/admin/ui/control';
import { EmptyState } from '@/components/admin/ui/empty-state';
import { ConfirmDialog } from '@/components/admin/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { toAppError } from '@/firebase';

/** Shape every CMS collection item shares. */
interface CmsItem {
  id: string;
  sortOrder: number;
  active: boolean;
}

/** The subset of a repository this manager drives. */
interface CollectionRepo<TItem, TCreate, TUpdate> {
  list(): Promise<TItem[]>;
  create(input: TCreate): Promise<TItem>;
  update(id: string, input: TUpdate): Promise<TItem>;
  remove(id: string): Promise<void>;
}

interface CmsCollectionManagerProps<TItem extends CmsItem, TDraft, TCreate, TUpdate> {
  repository: CollectionRepo<TItem, TCreate, TUpdate>;
  /** Storefront React Query key to invalidate after every mutation. */
  queryKey: readonly unknown[];
  /** Singular noun for copy, e.g. "menu item". */
  entityName: string;
  addLabel: string;
  emptyIcon: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
  /** A blank draft for the create modal. */
  emptyDraft: TDraft;
  /** Draft ← existing item (for editing). */
  toDraft: (item: TItem) => TDraft;
  /** Create payload ← draft (sortOrder is supplied). */
  toCreate: (draft: TDraft, sortOrder: number) => TCreate;
  /** Update payload ← draft. */
  toUpdate: (draft: TDraft) => TUpdate;
  /** Whether the draft is savable. */
  isValid: (draft: TDraft) => boolean;
  /** Renders the modal form fields. */
  renderForm: (draft: TDraft, set: (patch: Partial<TDraft>) => void) => React.ReactNode;
  /** Renders a row's read-only summary. */
  renderSummary: (item: TItem) => React.ReactNode;
  /** Optional one-click seed of sensible defaults when the collection is empty. */
  seed?: TCreate[];
}

/**
 * A reusable admin manager for an ordered CMS collection (navigation, banners,
 * social links). Handles loading/error states, a create/edit modal, per-row
 * active toggle, drag-free reorder (up/down, persisted as `sortOrder`), delete
 * with confirmation, an optional "load defaults" seed, and cache invalidation so
 * the storefront reflects every change. Individual pages supply only the
 * entity-specific form and row summary.
 */
export function CmsCollectionManager<TItem extends CmsItem, TDraft, TCreate, TUpdate>({
  repository,
  queryKey,
  entityName,
  addLabel,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  emptyDraft,
  toDraft,
  toCreate,
  toUpdate,
  isValid,
  renderForm,
  renderSummary,
  seed,
}: CmsCollectionManagerProps<TItem, TDraft, TCreate, TUpdate>) {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [items, setItems] = React.useState<TItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [editing, setEditing] = React.useState<TItem | null>(null);
  const [draft, setDraft] = React.useState<TDraft>(emptyDraft);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [seeding, setSeeding] = React.useState(false);
  const [toDelete, setToDelete] = React.useState<TItem | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    repository
      .list()
      .then((list) => {
        if (active) setItems(list);
      })
      .catch((error: unknown) => {
        if (active) setLoadError(toAppError(error).message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey });
  }

  function setPatch(patch: Partial<TDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function openCreate() {
    setEditing(null);
    setDraft(emptyDraft);
    setModalOpen(true);
  }

  function openEdit(item: TItem) {
    setEditing(item);
    setDraft(toDraft(item));
    setModalOpen(true);
  }

  async function save() {
    if (!isValid(draft)) return;
    setSaving(true);
    try {
      if (editing) {
        const updated = await repository.update(editing.id, toUpdate(draft));
        setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        toast.success(`${capitalize(entityName)} updated`);
      } else {
        const nextOrder = items.reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1;
        const created = await repository.create(toCreate(draft, nextOrder));
        setItems((prev) => [...prev, created]);
        toast.success(`${capitalize(entityName)} created`);
      }
      invalidate();
      setModalOpen(false);
    } catch (error) {
      toast.error(editing ? 'Update failed' : 'Create failed', toAppError(error).message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item: TItem) {
    setBusyId(item.id);
    try {
      const updated = await repository.update(item.id, { active: !item.active } as TUpdate);
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      invalidate();
    } catch (error) {
      toast.error('Update failed', toAppError(error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const a = items[index];
    const b = items[target];
    // Optimistically swap in the list, then persist both sortOrders.
    const swapped = [...items];
    [swapped[index], swapped[target]] = [swapped[target], swapped[index]];
    setItems(swapped);
    setBusyId(a.id);
    try {
      await Promise.all([
        repository.update(a.id, { sortOrder: b.sortOrder } as TUpdate),
        repository.update(b.id, { sortOrder: a.sortOrder } as TUpdate),
      ]);
      const fresh = await repository.list();
      setItems(fresh);
      invalidate();
    } catch (error) {
      toast.error('Reorder failed', toAppError(error).message);
      setItems(items);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(item: TItem) {
    setBusyId(item.id);
    try {
      await repository.remove(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      invalidate();
      toast.success(`${capitalize(entityName)} deleted`);
    } catch (error) {
      toast.error('Delete failed', toAppError(error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function seedDefaults() {
    if (!seed) return;
    setSeeding(true);
    try {
      const created: TItem[] = [];
      for (const input of seed) {
        created.push(await repository.create(input));
      }
      setItems((prev) => [...prev, ...created]);
      invalidate();
      toast.success('Defaults added');
    } catch (error) {
      toast.error('Couldn’t add defaults', toAppError(error).message);
    } finally {
      setSeeding(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Couldn’t load content"
        description={loadError}
        action={
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg"
            onClick={() => router.refresh()}
          >
            Retry
          </Button>
        }
      />
    );
  }

  return (
    <>
      <div className="mb-4 flex justify-end gap-2">
        {seed && items.length === 0 && (
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg"
            onClick={seedDefaults}
            disabled={seeding}
          >
            {seeding ? <Loader2 className="size-4 animate-spin" /> : null} Load defaults
          </Button>
        )}
        <Button size="sm" variant="brand" className="rounded-lg" onClick={openCreate}>
          <Plus className="size-4" /> {addLabel}
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="border-border bg-card rounded-xl border">
          <EmptyState
            icon={emptyIcon}
            title={emptyTitle}
            description={emptyDescription}
            action={
              <Button size="sm" variant="brand" className="rounded-lg" onClick={openCreate}>
                {addLabel}
              </Button>
            }
          />
        </div>
      ) : (
        <ul className="border-border bg-card divide-border divide-y overflow-hidden rounded-xl border">
          {items.map((item, index) => (
            <li key={item.id} className="flex items-center gap-3 p-3 sm:p-4">
              <div className="flex shrink-0 flex-col">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0 || busyId != null}
                  aria-label="Move up"
                  className="text-muted-foreground hover:text-foreground flex size-5 items-center justify-center transition-colors disabled:opacity-30"
                >
                  <ChevronUp className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === items.length - 1 || busyId != null}
                  aria-label="Move down"
                  className="text-muted-foreground hover:text-foreground flex size-5 items-center justify-center transition-colors disabled:opacity-30"
                >
                  <ChevronDown className="size-4" />
                </button>
              </div>

              <div className="min-w-0 flex-1">{renderSummary(item)}</div>

              <div className="flex shrink-0 items-center gap-1">
                <Switch
                  checked={item.active}
                  onCheckedChange={() => toggleActive(item)}
                  disabled={busyId === item.id}
                  aria-label={item.active ? 'Deactivate' : 'Activate'}
                />
                <button
                  type="button"
                  onClick={() => openEdit(item)}
                  aria-label={`Edit ${entityName}`}
                  className="text-muted-foreground hover:bg-secondary hover:text-foreground flex size-8 items-center justify-center rounded-lg transition-colors"
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setToDelete(item)}
                  disabled={busyId === item.id}
                  aria-label={`Delete ${entityName}`}
                  className="text-muted-foreground hover:bg-destructive/10 flex size-8 items-center justify-center rounded-lg transition-colors hover:text-rose-600 disabled:opacity-50 dark:hover:text-rose-400"
                >
                  {busyId === item.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit ${entityName}` : `New ${entityName}`}
      >
        <div className="p-6">
          <h2 className="text-foreground mb-4 text-base font-semibold">
            {editing ? `Edit ${entityName}` : `New ${entityName}`}
          </h2>
          <div className="flex flex-col gap-4">{renderForm(draft, setPatch)}</div>
          <div className="mt-6 flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              onClick={() => setModalOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              variant="brand"
              size="sm"
              className="rounded-lg"
              onClick={save}
              disabled={saving || !isValid(draft)}
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Saving…
                </>
              ) : editing ? (
                'Save changes'
              ) : (
                `Create ${entityName}`
              )}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) void handleDelete(toDelete);
        }}
        title={`Delete this ${entityName}?`}
        description="This can't be undone."
        confirmLabel="Delete"
      />
    </>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
