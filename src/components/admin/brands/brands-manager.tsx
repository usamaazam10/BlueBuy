'use client';

import * as React from 'react';
import { ExternalLink, Pencil, Plus, Tag, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { ProductMedia } from '@/components/product/product-media';
import { DataTable, type Column } from '@/components/admin/ui/data-table';
import { Field, Input, Textarea, Switch, Label } from '@/components/admin/ui/control';
import { ActiveBadge } from '@/components/admin/ui/status-badge';
import { EmptyState } from '@/components/admin/ui/empty-state';
import { ConfirmDialog } from '@/components/admin/ui/confirm-dialog';
import { BRANDS } from '@/data/admin/brands';
import type { Brand } from '@/data/admin/types';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

type Draft = Pick<Brand, 'name' | 'slug' | 'description' | 'website' | 'active'>;

const EMPTY_DRAFT: Draft = { name: '', slug: '', description: '', website: '', active: true };

export function BrandsManager() {
  const [brands, setBrands] = React.useState<Brand[]>(BRANDS);
  const [editing, setEditing] = React.useState<Brand | null>(null);
  const [draft, setDraft] = React.useState<Draft>(EMPTY_DRAFT);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [slugEdited, setSlugEdited] = React.useState(false);
  const [toDelete, setToDelete] = React.useState<Brand | null>(null);

  function openCreate() {
    setEditing(null);
    setDraft(EMPTY_DRAFT);
    setSlugEdited(false);
    setModalOpen(true);
  }

  function openEdit(brand: Brand) {
    setEditing(brand);
    setDraft({
      name: brand.name,
      slug: brand.slug,
      description: brand.description,
      website: brand.website ?? '',
      active: brand.active,
    });
    setSlugEdited(true);
    setModalOpen(true);
  }

  function save() {
    if (!draft.name.trim()) return;
    if (editing) {
      setBrands((prev) => prev.map((b) => (b.id === editing.id ? { ...b, ...draft } : b)));
    } else {
      setBrands((prev) => [
        {
          id: `brand-${Date.now()}`,
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

  const columns: Column<Brand>[] = [
    {
      key: 'name',
      header: 'Brand',
      cell: (b) => (
        <div className="flex items-center gap-3">
          <span className="border-border size-9 shrink-0 overflow-hidden rounded-lg border">
            <ProductMedia seed={b.slug} accent={b.accent} className="h-full w-full" />
          </span>
          <div className="min-w-0">
            <p className="text-foreground truncate font-medium">{b.name}</p>
            <p className="text-muted-foreground truncate text-xs">/{b.slug}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'website',
      header: 'Website',
      hideOnMobile: true,
      cell: (b) =>
        b.website ? (
          <a
            href={b.website}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
          >
            {b.website.replace(/^https?:\/\//, '')}
            <ExternalLink className="size-3.5" />
          </a>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'products',
      header: 'Products',
      align: 'right',
      hideOnMobile: true,
      cell: (b) => <span className="text-muted-foreground tabular-nums">{b.productCount}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (b) => <ActiveBadge active={b.active} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      className: 'w-24',
      cell: (b) => (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => openEdit(b)}
            aria-label={`Edit ${b.name}`}
            className="text-muted-foreground hover:bg-secondary hover:text-foreground flex size-8 items-center justify-center rounded-lg transition-colors"
          >
            <Pencil className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setToDelete(b)}
            aria-label={`Delete ${b.name}`}
            className="text-muted-foreground hover:bg-destructive/10 flex size-8 items-center justify-center rounded-lg transition-colors hover:text-rose-600 dark:hover:text-rose-400"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button size="sm" variant="brand" className="rounded-lg" onClick={openCreate}>
          <Plus className="size-4" /> Add brand
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={brands}
        rowKey={(b) => b.id}
        onRowClick={(b) => openEdit(b)}
        empty={
          <EmptyState
            icon={Tag}
            title="No brands yet"
            description="Register your first brand to assign it to products."
            action={
              <Button size="sm" variant="brand" className="rounded-lg" onClick={openCreate}>
                Add brand
              </Button>
            }
          />
        }
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit brand' : 'New brand'}
      >
        <div className="p-6">
          <h2 className="text-foreground mb-4 text-base font-semibold">
            {editing ? 'Edit brand' : 'New brand'}
          </h2>
          <div className="flex flex-col gap-4">
            <Field label="Name" htmlFor="brand-name" required>
              <Input
                id="brand-name"
                value={draft.name}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    name: e.target.value,
                    slug: slugEdited ? d.slug : slugify(e.target.value),
                  }))
                }
                placeholder="e.g. Aura Audio"
              />
            </Field>
            <Field label="Slug" htmlFor="brand-slug">
              <Input
                id="brand-slug"
                value={draft.slug}
                onChange={(e) => {
                  setSlugEdited(true);
                  setDraft((d) => ({ ...d, slug: slugify(e.target.value) }));
                }}
                placeholder="aura"
              />
            </Field>
            <Field label="Website" htmlFor="brand-website">
              <Input
                id="brand-website"
                type="url"
                value={draft.website ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, website: e.target.value }))}
                placeholder="https://brand.example.com"
              />
            </Field>
            <Field label="Description" htmlFor="brand-desc">
              <Textarea
                id="brand-desc"
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                placeholder="Premium headphones and earbuds tuned for lifelike sound."
              />
            </Field>
            <div className="flex items-center justify-between">
              <Label htmlFor="brand-active">Active</Label>
              <Switch
                id="brand-active"
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
              {editing ? 'Save changes' : 'Create brand'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) setBrands((prev) => prev.filter((b) => b.id !== toDelete.id));
        }}
        title={`Delete ${toDelete?.name ?? 'brand'}?`}
        description="Products assigned to this brand will keep their data but lose the brand link."
        confirmLabel="Delete brand"
      />
    </>
  );
}
