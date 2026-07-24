'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Breadcrumb } from '@/components/admin/ui/breadcrumb';
import { Field, Input, Select, Switch, Label } from '@/components/admin/ui/control';
import { RichTextEditor } from '@/components/admin/ui/rich-text-editor';
import { ImageUploader, type GalleryImage } from '@/components/admin/ui/image-uploader';
import { ADMIN_CATEGORIES } from '@/data/admin/categories';
import { BRANDS } from '@/data/admin/brands';
import { useToast } from '@/components/ui/toast';
import { ProductRepository } from '@/repositories';
import { uploadImage, CloudinaryError, type CloudinaryUploadResult } from '@/services/cloudinary';
import {
  formToProductInput,
  galleryToProductImages,
  validateProductForm,
  type ProductFormErrors,
} from './product-mappers';
import { EMPTY_PRODUCT, type ProductFormValues } from './product-form.types';

export { EMPTY_PRODUCT };
export type { ProductFormValues };

const CLOUDINARY_FOLDER = 'bluebuy/products';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/** Immutably patch a gallery image by id. */
function patchImage(
  images: GalleryImage[],
  id: string,
  patch: Partial<GalleryImage>
): GalleryImage[] {
  return images.map((image) => (image.id === id ? { ...image, ...patch } : image));
}

/** A titled panel used to group form fields. */
function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border bg-card rounded-xl border">
      <div className="border-border border-b px-5 py-4">
        <h2 className="text-foreground text-sm font-semibold">{title}</h2>
        {description && <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>}
      </div>
      <div className="flex flex-col gap-4 p-5">{children}</div>
    </section>
  );
}

interface ProductFormProps {
  mode: 'create' | 'edit';
  initial: ProductFormValues;
  /** Firestore document id — required in edit mode. */
  productId?: string;
}

export function ProductForm({ mode, initial, productId }: ProductFormProps) {
  const router = useRouter();
  const toast = useToast();

  const [values, setValues] = React.useState<ProductFormValues>(() => ({
    ...initial,
    categorySlug: initial.categorySlug || ADMIN_CATEGORIES[0]?.slug || '',
    brandId: initial.brandId || BRANDS[0]?.id || '',
  }));
  const [slugEdited, setSlugEdited] = React.useState(mode === 'edit');
  const [tagDraft, setTagDraft] = React.useState('');
  const [errors, setErrors] = React.useState<ProductFormErrors>({});
  const [submitting, setSubmitting] = React.useState(false);

  function set<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (key in prev ? { ...prev, [key]: undefined } : prev));
  }

  // Auto-generate slug from the title until the user edits the slug directly.
  function onTitleChange(title: string) {
    setValues((prev) => ({
      ...prev,
      title,
      slug: slugEdited ? prev.slug : slugify(title),
    }));
    setErrors((prev) => ({ ...prev, title: undefined, slug: undefined }));
  }

  function addTag(raw: string) {
    const tag = raw.trim();
    if (!tag || values.tags.includes(tag)) return;
    set('tags', [...values.tags, tag]);
  }

  function updateSpec(id: string, patch: Partial<ProductFormValues['specs'][number]>) {
    set(
      'specs',
      values.specs.map((spec) => (spec.id === id ? { ...spec, ...patch } : spec))
    );
  }

  const thumbnail = values.images[0];

  /**
   * Publish/save flow: validate → upload pending images to Cloudinary (with
   * progress) → persist the product via the repository → toast + redirect.
   */
  async function handleSubmit(intent: 'draft' | 'publish') {
    const nextValues = { ...values, active: intent === 'publish' };

    // 1) Fail fast on client-side field errors.
    const fieldErrors = validateProductForm(nextValues);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      toast.error('Please fix the highlighted fields.');
      return;
    }
    setErrors({});
    setSubmitting(true);

    try {
      // 2) Guard against duplicate slugs before doing any upload work.
      const slug = nextValues.slug.trim();
      if (await ProductRepository.slugExists(slug, productId)) {
        setErrors({ slug: 'That slug is already in use.' });
        toast.error('Slug already in use', 'Choose a different slug and try again.');
        return;
      }

      // 3) Upload any pending (new) images, reporting per-image progress. Fresh
      //    results are tracked locally so the gallery isn't built from stale state.
      const uploadedById = new Map<string, CloudinaryUploadResult>();
      const pending = values.images.filter((image) => image.file && image.status !== 'uploaded');
      for (const image of pending) {
        if (!image.file) continue;
        setValues((prev) => ({
          ...prev,
          images: patchImage(prev.images, image.id, {
            status: 'uploading',
            progress: 0,
            error: undefined,
          }),
        }));
        try {
          const result = await uploadImage(image.file, {
            folder: CLOUDINARY_FOLDER,
            onProgress: (percent) =>
              setValues((prev) => ({
                ...prev,
                images: patchImage(prev.images, image.id, { progress: percent }),
              })),
          });
          uploadedById.set(image.id, result);
          setValues((prev) => ({
            ...prev,
            images: patchImage(prev.images, image.id, {
              status: 'uploaded',
              uploaded: result,
              progress: 100,
            }),
          }));
        } catch (error) {
          const message =
            error instanceof CloudinaryError ? error.message : 'The image could not be uploaded.';
          setValues((prev) => ({
            ...prev,
            images: patchImage(prev.images, image.id, { status: 'error', error: message }),
          }));
          throw new Error(message);
        }
      }

      // 4) Assemble the gallery in display order, merging just-uploaded results
      //    with any images that were already on Cloudinary (edit mode).
      const finalImages: GalleryImage[] = values.images.map((image) => {
        const fresh = uploadedById.get(image.id);
        return fresh
          ? { ...image, uploaded: fresh, status: 'uploaded' as const, progress: 100 }
          : image;
      });
      const gallery = galleryToProductImages(finalImages);
      const payload = formToProductInput(nextValues, gallery);

      // 5) Persist through the repository (never Firestore directly).
      if (mode === 'edit' && productId) {
        await ProductRepository.update(productId, payload);
      } else {
        await ProductRepository.create(payload);
      }

      toast.success(
        intent === 'publish' ? 'Product published' : 'Draft saved',
        `“${nextValues.title}” was saved successfully.`
      );
      router.push('/admin/products');
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Something went wrong. Please try again.';
      toast.error('Could not save product', message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={(e) => e.preventDefault()}
      aria-label={mode === 'create' ? 'Create product' : 'Edit product'}
      aria-busy={submitting}
    >
      {/* Header / sticky action bar */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <Breadcrumb
            items={[
              { label: 'Admin', href: '/admin' },
              { label: 'Products', href: '/admin/products' },
              { label: mode === 'create' ? 'New product' : values.title || 'Edit product' },
            ]}
          />
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">
            {mode === 'create' ? 'New product' : values.title || 'Edit product'}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="rounded-lg" disabled={submitting}>
            <Link href="/admin/products">Cancel</Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-lg"
            onClick={() => handleSubmit('draft')}
            disabled={submitting}
          >
            Save draft
          </Button>
          <Button
            type="button"
            variant="brand"
            size="sm"
            className="rounded-lg"
            onClick={() => handleSubmit('publish')}
            disabled={submitting}
          >
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {submitting ? 'Publishing…' : 'Publish'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Section title="General">
            <Field label="Title" htmlFor="title" required error={errors.title}>
              <Input
                id="title"
                value={values.title}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder="e.g. Aura Wireless Headphones"
                disabled={submitting}
              />
            </Field>
            <Field label="Slug" htmlFor="slug" hint="Used in the product URL." error={errors.slug}>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">/product/</span>
                <Input
                  id="slug"
                  value={values.slug}
                  onChange={(e) => {
                    setSlugEdited(true);
                    set('slug', slugify(e.target.value));
                  }}
                  placeholder="aura-wireless-headphones"
                  disabled={submitting}
                />
              </div>
            </Field>
            <Field
              label="Short description"
              htmlFor="shortDescription"
              hint="A one-line summary for cards and search results."
            >
              <Input
                id="shortDescription"
                value={values.shortDescription}
                onChange={(e) => set('shortDescription', e.target.value)}
                placeholder="Over-ear headphones with adaptive noise cancellation."
                disabled={submitting}
              />
            </Field>
            <Field label="Description" htmlFor="description">
              <RichTextEditor
                id="description"
                value={values.description}
                onChange={(v) => set('description', v)}
                placeholder="Describe the product in detail…"
              />
            </Field>
          </Section>

          <Section title="Media" description="Upload a thumbnail and gallery images.">
            <ImageUploader
              images={values.images}
              onChange={(images) => set('images', images)}
              onError={(message) => toast.error(message)}
              disabled={submitting}
            />
          </Section>

          <Section title="Pricing">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Price" htmlFor="price" required error={errors.price}>
                <div className="relative">
                  <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 text-sm">
                    $
                  </span>
                  <Input
                    id="price"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={values.price}
                    onChange={(e) => set('price', e.target.value)}
                    placeholder="0.00"
                    className="pl-7"
                    disabled={submitting}
                  />
                </div>
              </Field>
              <Field
                label="Sale price"
                htmlFor="salePrice"
                hint="Leave blank if not on sale."
                error={errors.salePrice}
              >
                <div className="relative">
                  <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 text-sm">
                    $
                  </span>
                  <Input
                    id="salePrice"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={values.salePrice}
                    onChange={(e) => set('salePrice', e.target.value)}
                    placeholder="0.00"
                    className="pl-7"
                    disabled={submitting}
                  />
                </div>
              </Field>
            </div>
          </Section>

          <Section
            title="Specifications"
            description="Technical details shown on the product page."
          >
            <div className="flex flex-col gap-2">
              {values.specs.map((spec) => (
                <div key={spec.id} className="flex items-center gap-2">
                  <Input
                    aria-label="Specification label"
                    value={spec.label}
                    onChange={(e) => updateSpec(spec.id, { label: e.target.value })}
                    placeholder="Label (e.g. Battery)"
                    className="flex-1"
                    disabled={submitting}
                  />
                  <Input
                    aria-label="Specification value"
                    value={spec.value}
                    onChange={(e) => updateSpec(spec.id, { value: e.target.value })}
                    placeholder="Value (e.g. 40 hours)"
                    className="flex-1"
                    disabled={submitting}
                  />
                  <button
                    type="button"
                    aria-label="Remove specification"
                    onClick={() =>
                      set(
                        'specs',
                        values.specs.filter((s) => s.id !== spec.id)
                      )
                    }
                    className="text-muted-foreground hover:bg-secondary hover:text-foreground flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-lg"
                onClick={() =>
                  set('specs', [
                    ...values.specs,
                    { id: `spec-${Date.now()}`, label: '', value: '' },
                  ])
                }
              >
                <Plus className="size-4" /> Add specification
              </Button>
            </div>
          </Section>

          <Section
            title="Search engine listing"
            description="How this product appears in search results."
          >
            <Field
              label="SEO title"
              htmlFor="seoTitle"
              hint={`${values.seoTitle.length}/60 characters`}
            >
              <Input
                id="seoTitle"
                value={values.seoTitle}
                onChange={(e) => set('seoTitle', e.target.value)}
                maxLength={70}
                placeholder="Aura Wireless Headphones | BlueBuy"
                disabled={submitting}
              />
            </Field>
            <Field
              label="Meta description"
              htmlFor="seoDescription"
              hint={`${values.seoDescription.length}/160 characters`}
            >
              <Input
                id="seoDescription"
                value={values.seoDescription}
                onChange={(e) => set('seoDescription', e.target.value)}
                maxLength={180}
                placeholder="Premium over-ear headphones with adaptive noise cancellation…"
                disabled={submitting}
              />
            </Field>
            <Field label="Meta keywords" htmlFor="metaKeywords" hint="Comma-separated.">
              <Input
                id="metaKeywords"
                value={values.metaKeywords}
                onChange={(e) => set('metaKeywords', e.target.value)}
                placeholder="headphones, wireless, noise cancelling"
                disabled={submitting}
              />
            </Field>
          </Section>
        </div>

        {/* Sidebar column */}
        <div className="flex flex-col gap-6">
          <Section title="Status">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="active">Active</Label>
                <p className="text-muted-foreground text-xs">Visible in the storefront.</p>
              </div>
              <Switch
                id="active"
                checked={values.active}
                onCheckedChange={(v) => set('active', v)}
                disabled={submitting}
                aria-label="Active"
              />
            </div>
            <div className="border-border border-t" />
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="featured">Featured</Label>
                <p className="text-muted-foreground text-xs">Highlight on the homepage.</p>
              </div>
              <Switch
                id="featured"
                checked={values.featured}
                onCheckedChange={(v) => set('featured', v)}
                disabled={submitting}
                aria-label="Featured"
              />
            </div>
          </Section>

          <Section title="Organization">
            <Field label="Category" htmlFor="category" error={errors.categorySlug}>
              <Select
                id="category"
                value={values.categorySlug}
                onChange={(e) => set('categorySlug', e.target.value)}
                disabled={submitting}
              >
                {ADMIN_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Brand" htmlFor="brand" error={errors.brandId}>
              <Select
                id="brand"
                value={values.brandId}
                onChange={(e) => set('brandId', e.target.value)}
                disabled={submitting}
              >
                {BRANDS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Stock" htmlFor="stock">
              <Input
                id="stock"
                type="number"
                min="0"
                inputMode="numeric"
                value={values.stock}
                onChange={(e) => set('stock', e.target.value)}
                placeholder="0"
                disabled={submitting}
              />
            </Field>
            <Field label="Tags" htmlFor="tags" hint="Press Enter to add.">
              <Input
                id="tags"
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    addTag(tagDraft);
                    setTagDraft('');
                  }
                }}
                placeholder="Add a tag…"
                disabled={submitting}
              />
              {values.tags.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {values.tags.map((tag) => (
                    <span
                      key={tag}
                      className="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs"
                    >
                      {tag}
                      <button
                        type="button"
                        aria-label={`Remove ${tag}`}
                        onClick={() =>
                          set(
                            'tags',
                            values.tags.filter((t) => t !== tag)
                          )
                        }
                        className="hover:text-foreground text-muted-foreground"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </Field>
          </Section>

          <Section title="Thumbnail">
            <div className="border-border bg-muted/30 relative aspect-square overflow-hidden rounded-lg border">
              {thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element -- object URL / remote Cloudinary src under static export
                <img
                  src={thumbnail.previewUrl}
                  alt={thumbnail.alt}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-1 text-center text-xs">
                  <span>No image yet</span>
                  <span className="text-[11px]">The first gallery image is used.</span>
                </div>
              )}
            </div>
          </Section>
        </div>
      </div>

      {/* Footer actions (mirrors the top bar for long forms) */}
      <div className="border-border mt-6 flex items-center justify-end gap-2 border-t pt-6">
        <Button asChild variant="ghost" size="sm" className="rounded-lg" disabled={submitting}>
          <Link href="/admin/products">Cancel</Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-lg"
          onClick={() => handleSubmit('draft')}
          disabled={submitting}
        >
          Save draft
        </Button>
        <Button
          type="button"
          variant="brand"
          size="sm"
          className="rounded-lg"
          onClick={() => handleSubmit('publish')}
          disabled={submitting}
        >
          {submitting && <Loader2 className="size-4 animate-spin" />}
          {submitting ? 'Publishing…' : 'Publish'}
        </Button>
      </div>
    </form>
  );
}
