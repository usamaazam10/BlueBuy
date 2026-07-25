'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, FolderTree, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Field, Input, Textarea, Switch, Label } from '@/components/admin/ui/control';
import { ActiveBadge } from '@/components/admin/ui/status-badge';
import { EmptyState } from '@/components/admin/ui/empty-state';
import { ConfirmDialog } from '@/components/admin/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { CategoryRepository } from '@/repositories';
import { deriveAccent } from '@/lib/mappers/store';
import { toAppError } from '@/firebase';
import type { Category } from '@/types/models';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

interface Draft {
  name: string;
  slug: string;
  description: string;
  active: boolean;
}

const EMPTY_DRAFT: Draft = { name: '', slug: '', description: '', active: true };

/**
 * Categories manager — backed by Firestore via {@link CategoryRepository}.
 * Loads the full collection (active + inactive) on mount, and every
 * create/edit/delete/toggle is persisted (never Firestore directly, never local
 * mock state). Mirrors the products admin's load/error/toast conventions.
 */
export function CategoriesManager() {
  const router = useRouter();
  const toast = useToast();

  const [categories, setCategories] = React.useState<Category[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [editing, setEditing] = React.useState<Category | null>(null);
  const [draft, setDraft] = React.useState<Draft>(EMPTY_DRAFT);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [slugEdited, setSlugEdited] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [toDelete, setToDelete] = React.useState<Category | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  // Load categories from Firestore (via the repository — never Firestore directly).
  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    CategoryRepository.list()
      .then((list) => {
        if (!active) return;
        setCategories(
          [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
        );
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
  }, []);

  function openCreate() {
    setEditing(null);
    setDraft(EMPTY_DRAFT);
    setSlugEdited(false);
    setModalOpen(true);
  }

  function openEdit(category: Category) {
    setEditing(category);
    setDraft({
      name: category.name,
      slug: category.slug,
      description: category.description,
      active: category.active,
    });
    setSlugEdited(true);
    setModalOpen(true);
  }

  async function save() {
    const name = draft.name.trim();
    if (!name) return;
    const slug = draft.slug.trim() || slugify(name);

    setSaving(true);
    try {
      if (editing) {
        const updated = await CategoryRepository.update(editing.id, {
          name,
          slug,
          description: draft.description,
          active: draft.active,
        });
        setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        toast.success('Category updated', `“${updated.name}” was saved.`);
      } else {
        const created = await CategoryRepository.create({
          name,
          slug,
          description: draft.description,
          active: draft.active,
          image: null,
          parentId: null,
          productCount: 0,
          sortOrder: 0,
        });
        setCategories((prev) => [created, ...prev]);
        toast.success('Category created', `“${created.name}” was added.`);
      }
      setModalOpen(false);
    } catch (error) {
      toast.error(editing ? 'Update failed' : 'Create failed', toAppError(error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(category: Category) {
    setDeletingId(category.id);
    try {
      await CategoryRepository.remove(category.id);
      setCategories((prev) => prev.filter((c) => c.id !== category.id));
      toast.success('Category deleted', `“${category.name}” was removed.`);
    } catch (error) {
      toast.error('Delete failed', toAppError(error).message);
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
        <p className="text-muted-foreground text-sm">Loading categories…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Couldn’t load categories"
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
      <div className="mb-4 flex justify-end">
        <Button size="sm" variant="brand" className="rounded-lg" onClick={openCreate}>
          <Plus className="size-4" /> Add category
        </Button>
      </div>

      {categories.length === 0 ? (
        <div className="border-border bg-card rounded-xl border">
          <EmptyState
            icon={FolderTree}
            title="No categories yet"
            description="Create your first category to start organising products."
            action={
              <Button size="sm" variant="brand" className="rounded-lg" onClick={openCreate}>
                Add category
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => {
            const accent = deriveAccent(category.id || category.slug);
            return (
              <div
                key={category.id}
                className="border-border bg-card flex flex-col rounded-xl border p-5"
              >
                <div className="flex items-start justify-between">
                  <span
                    className="flex size-9 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${accent}1a`, color: accent }}
                  >
                    <FolderTree className="size-4.5" />
                  </span>
                  <ActiveBadge active={category.active} />
                </div>
                <h3 className="text-foreground mt-3 text-sm font-semibold">{category.name}</h3>
                <p className="text-muted-foreground mt-1 line-clamp-2 flex-1 text-sm">
                  {category.description}
                </p>
                <div className="border-border mt-4 flex items-center justify-between border-t pt-3">
                  <span className="text-muted-foreground text-xs">
                    {category.productCount} {category.productCount === 1 ? 'product' : 'products'}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(category)}
                      aria-label={`Edit ${category.name}`}
                      className="text-muted-foreground hover:bg-secondary hover:text-foreground flex size-8 items-center justify-center rounded-lg transition-colors"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setToDelete(category)}
                      disabled={deletingId === category.id}
                      aria-label={`Delete ${category.name}`}
                      className="text-muted-foreground hover:bg-destructive/10 flex size-8 items-center justify-center rounded-lg transition-colors hover:text-rose-600 disabled:opacity-50 dark:hover:text-rose-400"
                    >
                      {deletingId === category.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit category' : 'New category'}
      >
        <div className="p-6">
          <h2 className="text-foreground mb-4 text-base font-semibold">
            {editing ? 'Edit category' : 'New category'}
          </h2>
          <div className="flex flex-col gap-4">
            <Field label="Name" htmlFor="cat-name" required>
              <Input
                id="cat-name"
                value={draft.name}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    name: e.target.value,
                    slug: slugEdited ? d.slug : slugify(e.target.value),
                  }))
                }
                placeholder="e.g. Audio"
              />
            </Field>
            <Field label="Slug" htmlFor="cat-slug">
              <Input
                id="cat-slug"
                value={draft.slug}
                onChange={(e) => {
                  setSlugEdited(true);
                  setDraft((d) => ({ ...d, slug: slugify(e.target.value) }));
                }}
                placeholder="audio"
              />
            </Field>
            <Field label="Description" htmlFor="cat-desc">
              <Textarea
                id="cat-desc"
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                placeholder="Headphones and earbuds tuned for lifelike sound."
              />
            </Field>
            <div className="flex items-center justify-between">
              <Label htmlFor="cat-active">Active</Label>
              <Switch
                id="cat-active"
                checked={draft.active}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, active: v }))}
                aria-label="Active"
              />
            </div>
          </div>
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
              disabled={saving || !draft.name.trim()}
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Saving…
                </>
              ) : editing ? (
                'Save changes'
              ) : (
                'Create category'
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
        title={`Delete ${toDelete?.name ?? 'category'}?`}
        description="Products in this category won't be deleted, but they'll become uncategorised. This can't be undone."
        confirmLabel="Delete category"
      />
    </>
  );
}
