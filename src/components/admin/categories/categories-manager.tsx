'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, FolderTree, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Field, Input, Textarea, Switch, Label } from '@/components/admin/ui/control';
import { ActiveBadge } from '@/components/admin/ui/status-badge';
import { EmptyState } from '@/components/admin/ui/empty-state';
import { ConfirmDialog } from '@/components/admin/ui/confirm-dialog';
import { SingleImageUpload } from '@/components/admin/ui/single-image-upload';
import { useToast } from '@/components/ui/toast';
import { CategoryRepository, ProductRepository } from '@/repositories';
import {
  deleteCategoryWithImageCleanup,
  recordReplacedAsset,
} from '@/services/image-cleanup.service';
import { uploadImage, CloudinaryError, optimizeImageUrl } from '@/services/cloudinary';
import { useProductCounts } from '@/hooks/queries';
import { deriveAccent } from '@/lib/mappers/store';
import { toAppError } from '@/firebase';
import type { Category } from '@/types/models';

const CLOUDINARY_FOLDER = 'bluebuy/categories';

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
  /** Existing Cloudinary URL (edit) or object URL (new pick), or null. */
  imageUrl: string | null;
  /** Existing Cloudinary publicId, or null. */
  imagePublicId: string | null;
  /** A newly picked local file awaiting upload on save. */
  imageFile: File | null;
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
  imageUrl: null,
  imagePublicId: null,
  imageFile: null,
  featured: false,
  sortOrder: 0,
  active: true,
  seoTitle: '',
  seoDescription: '',
  metaKeywords: '',
};

/**
 * Categories manager — backed by Firestore via {@link CategoryRepository}.
 *
 * Supports full category editing: image (Cloudinary upload-on-save with
 * replace/remove), featured, display order and SEO metadata. Product counts are
 * computed live from the catalogue ({@link useProductCounts}); deletion is
 * guarded so a category with assigned products can't be removed (it would orphan
 * those references). Never touches Firestore directly, never keeps mock state.
 */
export function CategoriesManager() {
  const router = useRouter();
  const toast = useToast();
  const { byCategory } = useProductCounts();

  const [categories, setCategories] = React.useState<Category[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [editing, setEditing] = React.useState<Category | null>(null);
  const [draft, setDraft] = React.useState<Draft>(EMPTY_DRAFT);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [slugEdited, setSlugEdited] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [toDelete, setToDelete] = React.useState<Category | null>(null);
  const [blocked, setBlocked] = React.useState<{ category: Category; count: number } | null>(null);
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
      imageUrl: category.image,
      imagePublicId: category.imagePublicId,
      imageFile: null,
      featured: category.featured ?? false,
      sortOrder: category.sortOrder ?? 0,
      active: category.active,
      seoTitle: category.seoTitle ?? '',
      seoDescription: category.seoDescription ?? '',
      metaKeywords: (category.metaKeywords ?? []).join(', '),
    });
    setSlugEdited(true);
    setModalOpen(true);
  }

  function handleImageSelect(file: File) {
    setDraft((d) => ({ ...d, imageFile: file, imageUrl: URL.createObjectURL(file) }));
  }

  function handleImageRemove() {
    setDraft((d) => ({ ...d, imageFile: null, imageUrl: null, imagePublicId: null }));
  }

  async function save() {
    const name = draft.name.trim();
    if (!name) return;
    const slug = draft.slug.trim() || slugify(name);

    setSaving(true);
    setUploadProgress(0);
    try {
      // Upload a newly picked image first (upload-on-save), then persist the doc.
      let imageUrl = draft.imageUrl;
      let imagePublicId = draft.imagePublicId;
      if (draft.imageFile) {
        const result = await uploadImage(draft.imageFile, {
          folder: CLOUDINARY_FOLDER,
          onProgress: setUploadProgress,
        });
        imageUrl = result.secure_url;
        imagePublicId = result.public_id;
      }

      const metaKeywords = draft.metaKeywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);

      const payload = {
        name,
        slug,
        description: draft.description,
        image: imageUrl,
        imagePublicId,
        featured: draft.featured,
        sortOrder: Number.isFinite(draft.sortOrder) ? draft.sortOrder : 0,
        active: draft.active,
        seoTitle: draft.seoTitle.trim(),
        seoDescription: draft.seoDescription.trim(),
        metaKeywords,
      };

      if (editing) {
        // Record the previous image for cleanup if it was replaced or removed.
        await recordReplacedAsset(
          'category',
          editing.id,
          editing.name,
          editing.imagePublicId,
          editing.image,
          imagePublicId
        );
        const updated = await CategoryRepository.update(editing.id, payload);
        setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        toast.success('Category updated', `“${updated.name}” was saved.`);
      } else {
        const created = await CategoryRepository.create({
          ...payload,
          parentId: null,
          productCount: 0,
        });
        setCategories((prev) => [created, ...prev]);
        toast.success('Category created', `“${created.name}” was added.`);
      }
      setModalOpen(false);
    } catch (error) {
      const message = error instanceof CloudinaryError ? error.message : toAppError(error).message;
      toast.error(editing ? 'Update failed' : 'Create failed', message);
    } finally {
      setSaving(false);
    }
  }

  /** Guard deletion: block if any products still reference the category. */
  async function requestDelete(category: Category) {
    setDeletingId(category.id);
    try {
      const count = await ProductRepository.countByCategory(category.id);
      if (count > 0) {
        setBlocked({ category, count });
      } else {
        setToDelete(category);
      }
    } catch (error) {
      toast.error('Couldn’t check products', toAppError(error).message);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDelete(category: Category) {
    setDeletingId(category.id);
    try {
      await deleteCategoryWithImageCleanup(category.id);
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
            const count = byCategory.get(category.id) ?? 0;
            return (
              <div
                key={category.id}
                className="border-border bg-card flex flex-col overflow-hidden rounded-xl border"
              >
                {/* Image / accent header */}
                <div className="bg-muted/40 relative aspect-[16/9] overflow-hidden">
                  {category.image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- remote Cloudinary src under static export
                    <img
                      src={
                        category.imagePublicId
                          ? optimizeImageUrl(category.imagePublicId, { width: 640 })
                          : category.image
                      }
                      alt={category.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="absolute inset-0"
                      style={{
                        background: `linear-gradient(135deg, ${accent}26, ${accent}0d)`,
                      }}
                    />
                  )}
                  <span className="absolute top-2 right-2">
                    <ActiveBadge active={category.active} />
                  </span>
                  {category.featured && (
                    <span className="bg-brand text-brand-foreground absolute top-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-medium">
                      Featured
                    </span>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <h3 className="text-foreground text-sm font-semibold">{category.name}</h3>
                  <p className="text-muted-foreground mt-1 line-clamp-2 flex-1 text-sm">
                    {category.description}
                  </p>
                  <div className="border-border mt-4 flex items-center justify-between border-t pt-3">
                    <span className="text-muted-foreground text-xs">
                      {count} {count === 1 ? 'product' : 'products'}
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
                        onClick={() => void requestDelete(category)}
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
        <div className="max-h-[85vh] overflow-y-auto p-6">
          <h2 className="text-foreground mb-4 text-base font-semibold">
            {editing ? 'Edit category' : 'New category'}
          </h2>
          <div className="flex flex-col gap-4">
            <Field label="Image" htmlFor="cat-image" hint="Shown on category cards and listings.">
              <SingleImageUpload
                previewUrl={draft.imageUrl}
                onSelect={handleImageSelect}
                onRemove={handleImageRemove}
                onError={(m) => toast.error('Image', m)}
                uploading={saving && !!draft.imageFile}
                progress={uploadProgress}
                disabled={saving}
                fit="cover"
                label="Upload category image"
              />
            </Field>
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
            <Field label="Display order" htmlFor="cat-order" hint="Lower numbers appear first.">
              <Input
                id="cat-order"
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
                <Field label="SEO title" htmlFor="cat-seo-title" hint="Falls back to the name.">
                  <Input
                    id="cat-seo-title"
                    value={draft.seoTitle}
                    onChange={(e) => setDraft((d) => ({ ...d, seoTitle: e.target.value }))}
                  />
                </Field>
                <Field
                  label="SEO description"
                  htmlFor="cat-seo-desc"
                  hint="Falls back to the description."
                >
                  <Textarea
                    id="cat-seo-desc"
                    value={draft.seoDescription}
                    onChange={(e) => setDraft((d) => ({ ...d, seoDescription: e.target.value }))}
                  />
                </Field>
                <Field
                  label="Meta keywords"
                  htmlFor="cat-keywords"
                  hint="Comma-separated, e.g. audio, headphones, earbuds."
                >
                  <Input
                    id="cat-keywords"
                    value={draft.metaKeywords}
                    onChange={(e) => setDraft((d) => ({ ...d, metaKeywords: e.target.value }))}
                  />
                </Field>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="cat-featured">Featured</Label>
              <Switch
                id="cat-featured"
                checked={draft.featured}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, featured: v }))}
                aria-label="Featured"
              />
            </div>
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

      {/* Normal delete confirm (no products reference it) */}
      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) void handleDelete(toDelete);
        }}
        title={`Delete ${toDelete?.name ?? 'category'}?`}
        description="This can't be undone. Any image is queued for Cloudinary cleanup."
        confirmLabel="Delete category"
      />

      {/* Blocked delete (products still assigned) */}
      <Modal
        open={blocked !== null}
        onClose={() => setBlocked(null)}
        title="Category in use"
        hideCloseButton
        className="max-w-md"
      >
        <div className="p-6">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <AlertCircle className="size-5" />
            </span>
            <div className="flex flex-col gap-1">
              <h2 className="text-foreground text-base font-semibold">
                Can’t delete this category
              </h2>
              <p className="text-muted-foreground text-sm text-pretty">
                This category cannot be deleted because {blocked?.count}{' '}
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
                <Link href={`/admin/products?category=${blocked.category.id}`}>View products</Link>
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
