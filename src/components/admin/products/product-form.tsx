'use client';

import * as React from 'react';
import Link from 'next/link';
import { Check, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Breadcrumb } from '@/components/admin/ui/breadcrumb';
import { Field, Input, Select, Switch, Label } from '@/components/admin/ui/control';
import { RichTextEditor } from '@/components/admin/ui/rich-text-editor';
import { ImageUploader, type UploaderImage } from '@/components/admin/ui/image-uploader';
import { ProductMedia } from '@/components/product/product-media';
import { ADMIN_CATEGORIES } from '@/data/admin/categories';
import { BRANDS } from '@/data/admin/brands';
import { cn } from '@/lib/utils';

export interface ProductSpecRow {
  id: string;
  label: string;
  value: string;
}

export interface ProductFormValues {
  title: string;
  slug: string;
  shortDescription: string;
  description: string;
  price: string;
  salePrice: string;
  stock: string;
  categorySlug: string;
  brandId: string;
  featured: boolean;
  active: boolean;
  tags: string[];
  specs: ProductSpecRow[];
  seoTitle: string;
  seoDescription: string;
  metaKeywords: string;
  images: UploaderImage[];
}

export const EMPTY_PRODUCT: ProductFormValues = {
  title: '',
  slug: '',
  shortDescription: '',
  description: '',
  price: '',
  salePrice: '',
  stock: '',
  categorySlug: ADMIN_CATEGORIES[0]?.slug ?? '',
  brandId: BRANDS[0]?.id ?? '',
  featured: false,
  active: true,
  tags: [],
  specs: [{ id: 'spec-0', label: '', value: '' }],
  seoTitle: '',
  seoDescription: '',
  metaKeywords: '',
  images: [],
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
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
  productAccent?: string;
}

export function ProductForm({ mode, initial, productAccent = '#6366f1' }: ProductFormProps) {
  const [values, setValues] = React.useState<ProductFormValues>(initial);
  const [slugEdited, setSlugEdited] = React.useState(mode === 'edit');
  const [tagDraft, setTagDraft] = React.useState('');
  const [saved, setSaved] = React.useState<string | null>(null);

  function set<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  // Auto-generate slug from the title until the user edits the slug directly.
  function onTitleChange(title: string) {
    setValues((prev) => ({
      ...prev,
      title,
      slug: slugEdited ? prev.slug : slugify(title),
    }));
  }

  function addTag(raw: string) {
    const tag = raw.trim();
    if (!tag || values.tags.includes(tag)) return;
    set('tags', [...values.tags, tag]);
  }

  function updateSpec(id: string, patch: Partial<ProductSpecRow>) {
    set(
      'specs',
      values.specs.map((spec) => (spec.id === id ? { ...spec, ...patch } : spec))
    );
  }

  const thumbnail = values.images[0];

  // UI-only: no persistence. Surface an ephemeral confirmation instead.
  function handleSubmit(intent: 'draft' | 'publish') {
    setValues((prev) => ({ ...prev, active: intent === 'publish' }));
    setSaved(intent === 'publish' ? 'Product published' : 'Draft saved');
    window.setTimeout(() => setSaved(null), 2500);
  }

  return (
    <form
      onSubmit={(e) => e.preventDefault()}
      aria-label={mode === 'create' ? 'Create product' : 'Edit product'}
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
          {saved && (
            <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              <Check className="size-4" /> {saved}
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-lg"
            onClick={() => handleSubmit('draft')}
          >
            Save draft
          </Button>
          <Button
            type="button"
            variant="brand"
            size="sm"
            className="rounded-lg"
            onClick={() => handleSubmit('publish')}
          >
            Publish
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Section title="General">
            <Field label="Title" htmlFor="title" required>
              <Input
                id="title"
                value={values.title}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder="e.g. Aura Wireless Headphones"
              />
            </Field>
            <Field label="Slug" htmlFor="slug" hint="Used in the product URL.">
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
              accent={productAccent}
            />
          </Section>

          <Section title="Pricing">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Price" htmlFor="price" required>
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
                  />
                </div>
              </Field>
              <Field label="Sale price" htmlFor="salePrice" hint="Leave blank if not on sale.">
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
                  />
                  <Input
                    aria-label="Specification value"
                    value={spec.value}
                    onChange={(e) => updateSpec(spec.id, { value: e.target.value })}
                    placeholder="Value (e.g. 40 hours)"
                    className="flex-1"
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
              />
            </Field>
            <Field label="Meta keywords" htmlFor="metaKeywords" hint="Comma-separated.">
              <Input
                id="metaKeywords"
                value={values.metaKeywords}
                onChange={(e) => set('metaKeywords', e.target.value)}
                placeholder="headphones, wireless, noise cancelling"
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
                aria-label="Featured"
              />
            </div>
          </Section>

          <Section title="Organization">
            <Field label="Category" htmlFor="category">
              <Select
                id="category"
                value={values.categorySlug}
                onChange={(e) => set('categorySlug', e.target.value)}
              >
                {ADMIN_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Brand" htmlFor="brand">
              <Select
                id="brand"
                value={values.brandId}
                onChange={(e) => set('brandId', e.target.value)}
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
            <div
              className={cn(
                'border-border bg-muted/30 relative aspect-square overflow-hidden rounded-lg border'
              )}
            >
              {thumbnail ? (
                <ProductMedia
                  seed={thumbnail.seed}
                  accent={thumbnail.accent}
                  className="h-full w-full"
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
        <Button asChild variant="ghost" size="sm" className="rounded-lg">
          <Link href="/admin/products">Cancel</Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-lg"
          onClick={() => handleSubmit('draft')}
        >
          Save draft
        </Button>
        <Button
          type="button"
          variant="brand"
          size="sm"
          className="rounded-lg"
          onClick={() => handleSubmit('publish')}
        >
          Publish
        </Button>
      </div>
    </form>
  );
}
