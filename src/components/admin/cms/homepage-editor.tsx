'use client';

import { Field, Input, Textarea, Select, Label, Switch } from '@/components/admin/ui/control';
import { HomepageRepository } from '@/repositories';
import { queryKeys } from '@/hooks/queries/keys';
import { useStoreCategories, useStoreProducts } from '@/hooks/queries';
import type { Homepage } from '@/types/cms';
import { useCmsSingleton } from './use-cms-singleton';
import { CmsFormShell, SectionCard } from './cms-form-shell';
import { LinkFields } from './link-fields';
import { RepeatableList } from './repeatable-list';

/** Editor for the `homepage` singleton — hero, featured content, promo, newsletter, SEO. */
export function HomepageEditor() {
  const { data: categories } = useStoreCategories();
  const { data: products } = useStoreProducts();

  const { draft, setDraft, patch, loading, loadError, dirty, saving, onSave, onReset, reload } =
    useCmsSingleton<Homepage>({
      load: () => HomepageRepository.get(),
      save: (value) => HomepageRepository.save(value),
      queryKey: queryKeys.homepage,
      label: 'Homepage',
    });

  return (
    <CmsFormShell
      loading={loading}
      loadError={loadError}
      dirty={dirty}
      saving={saving}
      onSave={onSave}
      onReset={onReset}
      onRetry={reload}
    >
      {draft && (
        <>
          <SectionCard title="Hero" description="The top band of the homepage.">
            <Field label="Eyebrow" htmlFor="hero-eyebrow" hint="Small pill above the title.">
              <Input
                id="hero-eyebrow"
                value={draft.hero.eyebrow}
                onChange={(e) => patch({ hero: { ...draft.hero, eyebrow: e.target.value } })}
              />
            </Field>
            <Field label="Title" htmlFor="hero-title" required>
              <Textarea
                id="hero-title"
                value={draft.hero.title}
                onChange={(e) => patch({ hero: { ...draft.hero, title: e.target.value } })}
                className="min-h-16"
              />
            </Field>
            <Field label="Subtitle" htmlFor="hero-subtitle">
              <Textarea
                id="hero-subtitle"
                value={draft.hero.subtitle}
                onChange={(e) => patch({ hero: { ...draft.hero, subtitle: e.target.value } })}
              />
            </Field>
            <LinkFields
              idPrefix="hero-primary"
              labelText="Primary CTA"
              value={draft.hero.primaryCta}
              onChange={(primaryCta) => patch({ hero: { ...draft.hero, primaryCta } })}
            />
            <LinkFields
              idPrefix="hero-secondary"
              labelText="Secondary CTA"
              value={draft.hero.secondaryCta}
              onChange={(secondaryCta) => patch({ hero: { ...draft.hero, secondaryCta } })}
            />
            <Field
              label="Background image URL"
              htmlFor="hero-bg"
              hint="Optional. Layered subtly behind the geometric default."
            >
              <Input
                id="hero-bg"
                value={draft.hero.backgroundImage}
                onChange={(e) =>
                  patch({ hero: { ...draft.hero, backgroundImage: e.target.value } })
                }
                placeholder="https://…"
              />
            </Field>
          </SectionCard>

          <SectionCard
            title="Featured categories"
            description="Curate and order the categories shown. Leave empty to show all automatically."
          >
            <RepeatableList
              items={draft.featuredCategoryIds}
              onChange={(featuredCategoryIds) => patch({ featuredCategoryIds })}
              newItem={() => ''}
              addLabel="Add category"
              emptyLabel="No categories selected — all active categories will show."
              renderRow={(id, update) => (
                <Select value={id} onChange={(e) => update(e.target.value)}>
                  <option value="">— Select a category —</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              )}
            />
          </SectionCard>

          <SectionCard
            title="Featured products"
            description="Curate and order the products shown. Leave empty to auto-select featured products."
          >
            <RepeatableList
              items={draft.featuredProductIds}
              onChange={(featuredProductIds) => patch({ featuredProductIds })}
              newItem={() => ''}
              addLabel="Add product"
              max={8}
              emptyLabel="No products selected — featured products will show automatically."
              renderRow={(id, update) => (
                <Select value={id} onChange={(e) => update(e.target.value)}>
                  <option value="">— Select a product —</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.title}
                    </option>
                  ))}
                </Select>
              )}
            />
          </SectionCard>

          <SectionCard
            title="Promotional banner"
            description="The call-to-action band near the page bottom."
          >
            <div className="flex items-center justify-between">
              <Label htmlFor="promo-enabled">Show promotional banner</Label>
              <Switch
                id="promo-enabled"
                checked={draft.promoBanner.enabled}
                onCheckedChange={(enabled) =>
                  patch({ promoBanner: { ...draft.promoBanner, enabled } })
                }
                aria-label="Show promotional banner"
              />
            </div>
            <Field label="Title" htmlFor="promo-title">
              <Input
                id="promo-title"
                value={draft.promoBanner.title}
                onChange={(e) =>
                  patch({ promoBanner: { ...draft.promoBanner, title: e.target.value } })
                }
              />
            </Field>
            <Field label="Subtitle" htmlFor="promo-subtitle">
              <Textarea
                id="promo-subtitle"
                value={draft.promoBanner.subtitle}
                onChange={(e) =>
                  patch({ promoBanner: { ...draft.promoBanner, subtitle: e.target.value } })
                }
              />
            </Field>
            <LinkFields
              idPrefix="promo-cta"
              labelText="CTA"
              value={draft.promoBanner.cta}
              onChange={(cta) => patch({ promoBanner: { ...draft.promoBanner, cta } })}
            />
          </SectionCard>

          <SectionCard title="Newsletter" description="Sign-up block shown in the footer.">
            <div className="flex items-center justify-between">
              <Label htmlFor="news-enabled">Show newsletter</Label>
              <Switch
                id="news-enabled"
                checked={draft.newsletter.enabled}
                onCheckedChange={(enabled) =>
                  patch({ newsletter: { ...draft.newsletter, enabled } })
                }
                aria-label="Show newsletter"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Title" htmlFor="news-title">
                <Input
                  id="news-title"
                  value={draft.newsletter.title}
                  onChange={(e) =>
                    patch({ newsletter: { ...draft.newsletter, title: e.target.value } })
                  }
                />
              </Field>
              <Field label="Button label" htmlFor="news-button">
                <Input
                  id="news-button"
                  value={draft.newsletter.buttonLabel}
                  onChange={(e) =>
                    patch({ newsletter: { ...draft.newsletter, buttonLabel: e.target.value } })
                  }
                />
              </Field>
            </div>
            <Field label="Subtitle" htmlFor="news-subtitle">
              <Input
                id="news-subtitle"
                value={draft.newsletter.subtitle}
                onChange={(e) =>
                  patch({ newsletter: { ...draft.newsletter, subtitle: e.target.value } })
                }
              />
            </Field>
            <Field label="Input placeholder" htmlFor="news-placeholder">
              <Input
                id="news-placeholder"
                value={draft.newsletter.placeholder}
                onChange={(e) =>
                  patch({ newsletter: { ...draft.newsletter, placeholder: e.target.value } })
                }
              />
            </Field>
          </SectionCard>

          <SectionCard
            title="SEO"
            description="Overrides the homepage title, description and keywords."
          >
            <Field label="Meta title" htmlFor="seo-title">
              <Input
                id="seo-title"
                value={draft.seo.title}
                onChange={(e) => patch({ seo: { ...draft.seo, title: e.target.value } })}
              />
            </Field>
            <Field label="Meta description" htmlFor="seo-desc">
              <Textarea
                id="seo-desc"
                value={draft.seo.description}
                onChange={(e) => patch({ seo: { ...draft.seo, description: e.target.value } })}
              />
            </Field>
            <Field
              label="Keywords"
              htmlFor="seo-keywords"
              hint="Comma-separated, e.g. audio, wearables, displays."
            >
              <Input
                id="seo-keywords"
                value={draft.seo.keywords.join(', ')}
                onChange={(e) =>
                  setDraft((current) =>
                    current == null
                      ? current
                      : {
                          ...current,
                          seo: {
                            ...current.seo,
                            keywords: e.target.value
                              .split(',')
                              .map((k) => k.trim())
                              .filter(Boolean),
                          },
                        }
                  )
                }
              />
            </Field>
          </SectionCard>
        </>
      )}
    </CmsFormShell>
  );
}
