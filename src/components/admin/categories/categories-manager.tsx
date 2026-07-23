'use client';

import * as React from 'react';
import { FolderTree, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Field, Input, Textarea, Switch, Label } from '@/components/admin/ui/control';
import { ActiveBadge } from '@/components/admin/ui/status-badge';
import { EmptyState } from '@/components/admin/ui/empty-state';
import { ConfirmDialog } from '@/components/admin/ui/confirm-dialog';
import { ADMIN_CATEGORIES } from '@/data/admin/categories';
import type { AdminCategory } from '@/data/admin/types';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

type Draft = Pick<AdminCategory, 'name' | 'slug' | 'description' | 'active'>;

const EMPTY_DRAFT: Draft = { name: '', slug: '', description: '', active: true };

export function CategoriesManager() {
  const [categories, setCategories] = React.useState<AdminCategory[]>(ADMIN_CATEGORIES);
  const [editing, setEditing] = React.useState<AdminCategory | null>(null);
  const [draft, setDraft] = React.useState<Draft>(EMPTY_DRAFT);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [slugEdited, setSlugEdited] = React.useState(false);
  const [toDelete, setToDelete] = React.useState<AdminCategory | null>(null);

  function openCreate() {
    setEditing(null);
    setDraft(EMPTY_DRAFT);
    setSlugEdited(false);
    setModalOpen(true);
  }

  function openEdit(category: AdminCategory) {
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

  function save() {
    if (!draft.name.trim()) return;
    if (editing) {
      setCategories((prev) => prev.map((c) => (c.id === editing.id ? { ...c, ...draft } : c)));
    } else {
      setCategories((prev) => [
        {
          id: `cat-${Date.now()}`,
          accent: '#6366f1',
          productCount: 0,
          ...draft,
          slug: draft.slug || slugify(draft.name),
        },
        ...prev,
      ]);
    }
    setModalOpen(false);
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
          {categories.map((category) => (
            <div
              key={category.id}
              className="border-border bg-card flex flex-col rounded-xl border p-5"
            >
              <div className="flex items-start justify-between">
                <span
                  className="flex size-9 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${category.accent}1a`, color: category.accent }}
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
                    aria-label={`Delete ${category.name}`}
                    className="text-muted-foreground hover:bg-destructive/10 flex size-8 items-center justify-center rounded-lg transition-colors hover:text-rose-600 dark:hover:text-rose-400"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
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
            >
              Cancel
            </Button>
            <Button variant="brand" size="sm" className="rounded-lg" onClick={save}>
              {editing ? 'Save changes' : 'Create category'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) setCategories((prev) => prev.filter((c) => c.id !== toDelete.id));
        }}
        title={`Delete ${toDelete?.name ?? 'category'}?`}
        description="Products in this category won't be deleted, but they'll become uncategorised."
        confirmLabel="Delete category"
      />
    </>
  );
}
