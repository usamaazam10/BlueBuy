'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, ExternalLink, Loader2, Pencil, Plus, Tag, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { ProductMedia } from '@/components/product/product-media';
import { DataTable, type Column } from '@/components/admin/ui/data-table';
import { Field, Input, Textarea, Switch, Label } from '@/components/admin/ui/control';
import { ActiveBadge } from '@/components/admin/ui/status-badge';
import { EmptyState } from '@/components/admin/ui/empty-state';
import { ConfirmDialog } from '@/components/admin/ui/confirm-dialog';
import { SingleImageUpload } from '@/components/admin/ui/single-image-upload';
import { useToast } from '@/components/ui/toast';
import { BrandRepository, ProductRepository } from '@/repositories';
import { deleteBrandWithImageCleanup, recordReplacedAsset } from '@/services/image-cleanup.service';
import { uploadImage, CloudinaryError, optimizeImageUrl } from '@/services/cloudinary';
import { useProductCounts } from '@/hooks/queries';
import { deriveAccent } from '@/lib/mappers/store';
import { toAppError } from '@/firebase';
import type { Brand } from '@/types/models';

const CLOUDINARY_FOLDER = 'bluebuy/brands';

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
  website: string;
  logoUrl: string | null;
  logoPublicId: string | null;
  logoFile: File | null;
  featured: boolean;
  sortOrder: number;
  active: boolean;
  seoTitle: string;
  seoDescription: string;
  metaKeywords: string;
}

const EMPTY_DRAFT: Draft = {
  name: '',
  slug: '',
  description: '',
  website: '',
  logoUrl: null,
  logoPublicId: null,
  logoFile: null,
  featured: false,
  sortOrder: 0,
  active: true,
  seoTitle: '',
  seoDescription: '',
  metaKeywords: '',
};

/**
 * Brands manager — backed by Firestore via {@link BrandRepository}.
 *
 * Supports full brand editing: logo (Cloudinary upload-on-save with
 * replace/remove), website, featured, display order and SEO metadata. Product
 * counts are computed live ({@link useProductCounts}); deletion is guarded so a
 * brand with assigned products can't be removed (it would orphan those
 * references). Never touches Firestore directly, never keeps mock state.
 */
export function BrandsManager() {
  const router = useRouter();
  const toast = useToast();
  const { byBrand } = useProductCounts();

  const [brands, setBrands] = React.useState<Brand[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [editing, setEditing] = React.useState<Brand | null>(null);
  const [draft, setDraft] = React.useState<Draft>(EMPTY_DRAFT);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [slugEdited, setSlugEdited] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [toDelete, setToDelete] = React.useState<Brand | null>(null);
  const [blocked, setBlocked] = React.useState<{ brand: Brand; count: number } | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  // Load brands from Firestore (via the repository — never Firestore directly).
  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    BrandRepository.list()
      .then((list) => {
        if (!active) return;
        setBrands(
          [...list].sort(
            (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name)
          )
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

  const sortBrands = React.useCallback(
    (list: Brand[]) =>
      [...list].sort(
        (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name)
      ),
    []
  );

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
      logoUrl: brand.logo,
      logoPublicId: brand.logoPublicId,
      logoFile: null,
      featured: brand.featured ?? false,
      sortOrder: brand.sortOrder ?? 0,
      active: brand.active,
      seoTitle: brand.seoTitle ?? '',
      seoDescription: brand.seoDescription ?? '',
      metaKeywords: (brand.metaKeywords ?? []).join(', '),
    });
    setSlugEdited(true);
    setModalOpen(true);
  }

  function handleLogoSelect(file: File) {
    setDraft((d) => ({ ...d, logoFile: file, logoUrl: URL.createObjectURL(file) }));
  }

  function handleLogoRemove() {
    setDraft((d) => ({ ...d, logoFile: null, logoUrl: null, logoPublicId: null }));
  }

  async function save() {
    const name = draft.name.trim();
    if (!name) return;
    const slug = draft.slug.trim() || slugify(name);
    const website = draft.website.trim() || null;

    setSaving(true);
    setUploadProgress(0);
    try {
      let logoUrl = draft.logoUrl;
      let logoPublicId = draft.logoPublicId;
      if (draft.logoFile) {
        const result = await uploadImage(draft.logoFile, {
          folder: CLOUDINARY_FOLDER,
          onProgress: setUploadProgress,
        });
        logoUrl = result.secure_url;
        logoPublicId = result.public_id;
      }

      const metaKeywords = draft.metaKeywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);

      const payload = {
        name,
        slug,
        description: draft.description,
        website,
        logo: logoUrl,
        logoPublicId,
        featured: draft.featured,
        sortOrder: Number.isFinite(draft.sortOrder) ? draft.sortOrder : 0,
        active: draft.active,
        seoTitle: draft.seoTitle.trim(),
        seoDescription: draft.seoDescription.trim(),
        metaKeywords,
      };

      if (editing) {
        await recordReplacedAsset(
          'brand',
          editing.id,
          editing.name,
          editing.logoPublicId,
          editing.logo,
          logoPublicId
        );
        const updated = await BrandRepository.update(editing.id, payload);
        setBrands((prev) => sortBrands(prev.map((b) => (b.id === updated.id ? updated : b))));
        toast.success('Brand updated', `“${updated.name}” was saved.`);
      } else {
        const created = await BrandRepository.create(payload);
        setBrands((prev) => sortBrands([...prev, created]));
        toast.success('Brand created', `“${created.name}” was added.`);
      }
      setModalOpen(false);
    } catch (error) {
      const message = error instanceof CloudinaryError ? error.message : toAppError(error).message;
      toast.error(editing ? 'Update failed' : 'Create failed', message);
    } finally {
      setSaving(false);
    }
  }

  /** Guard deletion: block if any products still reference the brand. */
  async function requestDelete(brand: Brand) {
    setDeletingId(brand.id);
    try {
      const count = await ProductRepository.countByBrand(brand.id);
      if (count > 0) {
        setBlocked({ brand, count });
      } else {
        setToDelete(brand);
      }
    } catch (error) {
      toast.error('Couldn’t check products', toAppError(error).message);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDelete(brand: Brand) {
    setDeletingId(brand.id);
    try {
      await deleteBrandWithImageCleanup(brand.id);
      setBrands((prev) => prev.filter((b) => b.id !== brand.id));
      toast.success('Brand deleted', `“${brand.name}” was removed.`);
    } catch (error) {
      toast.error('Delete failed', toAppError(error).message);
    } finally {
      setDeletingId(null);
    }
  }

  const columns: Column<Brand>[] = [
    {
      key: 'name',
      header: 'Brand',
      cell: (b) => {
        const count = byBrand.get(b.id) ?? 0;
        return (
          <div className="flex items-center gap-3">
            <span className="border-border bg-muted/30 flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border">
              {b.logo ? (
                // eslint-disable-next-line @next/next/no-img-element -- remote Cloudinary src under static export
                <img
                  src={b.logoPublicId ? optimizeImageUrl(b.logoPublicId, { width: 72 }) : b.logo}
                  alt={b.name}
                  className="h-full w-full object-contain p-1"
                  loading="lazy"
                />
              ) : (
                <ProductMedia
                  seed={b.slug}
                  accent={deriveAccent(b.id || b.slug)}
                  className="h-full w-full"
                />
              )}
            </span>
            <div className="min-w-0">
              <p className="text-foreground flex items-center gap-2 truncate font-medium">
                {b.name}
                {b.featured && (
                  <span className="bg-brand/10 text-brand rounded-full px-1.5 py-0.5 text-[10px] font-medium">
                    Featured
                  </span>
                )}
              </p>
              <p className="text-muted-foreground truncate text-xs">
                /{b.slug} · {count} {count === 1 ? 'product' : 'products'}
              </p>
            </div>
          </div>
        );
      },
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
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
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
            onClick={() => void requestDelete(b)}
            disabled={deletingId === b.id}
            aria-label={`Delete ${b.name}`}
            className="text-muted-foreground hover:bg-destructive/10 flex size-8 items-center justify-center rounded-lg transition-colors hover:text-rose-600 disabled:opacity-50 dark:hover:text-rose-400"
          >
            {deletingId === b.id ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
          </button>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
        <p className="text-muted-foreground text-sm">Loading brands…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Couldn’t load brands"
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
        <div className="max-h-[85vh] overflow-y-auto p-6">
          <h2 className="text-foreground mb-4 text-base font-semibold">
            {editing ? 'Edit brand' : 'New brand'}
          </h2>
          <div className="flex flex-col gap-4">
            <Field
              label="Logo"
              htmlFor="brand-logo"
              hint="Displayed on brand listings and product pages."
            >
              <SingleImageUpload
                previewUrl={draft.logoUrl}
                onSelect={handleLogoSelect}
                onRemove={handleLogoRemove}
                onError={(m) => toast.error('Logo', m)}
                uploading={saving && !!draft.logoFile}
                progress={uploadProgress}
                disabled={saving}
                fit="contain"
                label="Upload brand logo"
              />
            </Field>
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
                value={draft.website}
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
            <Field label="Display order" htmlFor="brand-order" hint="Lower numbers appear first.">
              <Input
                id="brand-order"
                type="number"
                min={0}
                value={draft.sortOrder}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, sortOrder: e.target.valueAsNumber || 0 }))
                }
              />
            </Field>

            {/* SEO */}
            <div className="border-border mt-1 border-t pt-4">
              <p className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
                SEO
              </p>
              <div className="flex flex-col gap-4">
                <Field label="SEO title" htmlFor="brand-seo-title" hint="Falls back to the name.">
                  <Input
                    id="brand-seo-title"
                    value={draft.seoTitle}
                    onChange={(e) => setDraft((d) => ({ ...d, seoTitle: e.target.value }))}
                  />
                </Field>
                <Field
                  label="SEO description"
                  htmlFor="brand-seo-desc"
                  hint="Falls back to the description."
                >
                  <Textarea
                    id="brand-seo-desc"
                    value={draft.seoDescription}
                    onChange={(e) => setDraft((d) => ({ ...d, seoDescription: e.target.value }))}
                  />
                </Field>
                <Field
                  label="Meta keywords"
                  htmlFor="brand-keywords"
                  hint="Comma-separated, e.g. audio, premium, wireless."
                >
                  <Input
                    id="brand-keywords"
                    value={draft.metaKeywords}
                    onChange={(e) => setDraft((d) => ({ ...d, metaKeywords: e.target.value }))}
                  />
                </Field>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="brand-featured">Featured</Label>
              <Switch
                id="brand-featured"
                checked={draft.featured}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, featured: v }))}
                aria-label="Featured"
              />
            </div>
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
                'Create brand'
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Normal delete confirm (no products reference it) */}
      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) void handleDelete(toDelete);
        }}
        title={`Delete ${toDelete?.name ?? 'brand'}?`}
        description="This can't be undone. Any logo is queued for Cloudinary cleanup."
        confirmLabel="Delete brand"
      />

      {/* Blocked delete (products still assigned) */}
      <Modal
        open={blocked !== null}
        onClose={() => setBlocked(null)}
        title="Brand in use"
        hideCloseButton
        className="max-w-md"
      >
        <div className="p-6">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <AlertCircle className="size-5" />
            </span>
            <div className="flex flex-col gap-1">
              <h2 className="text-foreground text-base font-semibold">Can’t delete this brand</h2>
              <p className="text-muted-foreground text-sm text-pretty">
                This brand cannot be deleted because {blocked?.count}{' '}
                {blocked?.count === 1 ? 'product is' : 'products are'} still assigned. Reassign or
                remove {blocked?.count === 1 ? 'it' : 'them'} first.
              </p>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              onClick={() => setBlocked(null)}
            >
              Close
            </Button>
            {blocked && (
              <Button asChild variant="brand" size="sm" className="rounded-lg">
                <Link href={`/admin/products?brand=${blocked.brand.id}`}>View products</Link>
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
