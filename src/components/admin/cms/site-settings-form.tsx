'use client';

import { Field, Input } from '@/components/admin/ui/control';
import { SiteSettingsRepository } from '@/repositories';
import { queryKeys } from '@/hooks/queries/keys';
import type { SiteSettings } from '@/types/cms';
import { useCmsSingleton } from './use-cms-singleton';
import { CmsFormShell, SectionCard } from './cms-form-shell';
import { ColorField } from './color-field';

/** Editor for the `site_settings` singleton — store identity, brand, support, region. */
export function SiteSettingsForm() {
  const { draft, patch, loading, loadError, dirty, saving, onSave, onReset, reload } =
    useCmsSingleton<SiteSettings>({
      load: () => SiteSettingsRepository.get(),
      save: (value) => SiteSettingsRepository.save(value),
      queryKey: queryKeys.siteSettings,
      label: 'Site settings',
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
          <SectionCard title="Store identity" description="How your store presents itself.">
            <Field label="Store name" htmlFor="store-name" required>
              <Input
                id="store-name"
                value={draft.storeName}
                onChange={(e) => patch({ storeName: e.target.value })}
              />
            </Field>
            <Field label="Tagline" htmlFor="tagline" hint="Short description used in metadata.">
              <Input
                id="tagline"
                value={draft.tagline}
                onChange={(e) => patch({ tagline: e.target.value })}
              />
            </Field>
            <Field
              label="Logo URL"
              htmlFor="logo-url"
              hint="Leave empty to use the built-in wordmark."
            >
              <Input
                id="logo-url"
                value={draft.logoUrl}
                onChange={(e) => patch({ logoUrl: e.target.value })}
                placeholder="https://…"
              />
            </Field>
            <Field
              label="Favicon URL"
              htmlFor="favicon-url"
              hint="Browser-tab icon. Leave empty for the default."
            >
              <Input
                id="favicon-url"
                value={draft.faviconUrl}
                onChange={(e) => patch({ faviconUrl: e.target.value })}
                placeholder="https://…"
              />
            </Field>
          </SectionCard>

          <SectionCard
            title="Branding"
            description="Colours apply site-wide via the brand token (leave empty for the theme default)."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ColorField
                label="Primary colour"
                value={draft.primaryColor}
                onChange={(v) => patch({ primaryColor: v })}
              />
              <ColorField
                label="Secondary colour"
                value={draft.secondaryColor}
                onChange={(v) => patch({ secondaryColor: v })}
              />
            </div>
          </SectionCard>

          <SectionCard title="Support" description="Shown on the contact page and in the footer.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Support email" htmlFor="support-email">
                <Input
                  id="support-email"
                  type="email"
                  value={draft.supportEmail}
                  onChange={(e) => patch({ supportEmail: e.target.value })}
                />
              </Field>
              <Field label="Support phone" htmlFor="support-phone">
                <Input
                  id="support-phone"
                  value={draft.supportPhone}
                  onChange={(e) => patch({ supportPhone: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Business address" htmlFor="business-address">
              <Input
                id="business-address"
                value={draft.businessAddress}
                onChange={(e) => patch({ businessAddress: e.target.value })}
              />
            </Field>
          </SectionCard>

          <SectionCard title="Regional" description="Currency and timezone defaults.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Currency" htmlFor="currency" hint="3-letter ISO code, e.g. USD.">
                <Input
                  id="currency"
                  value={draft.currency}
                  onChange={(e) => patch({ currency: e.target.value.toUpperCase() })}
                  maxLength={3}
                />
              </Field>
              <Field label="Timezone" htmlFor="timezone" hint="IANA name, e.g. America/New_York.">
                <Input
                  id="timezone"
                  value={draft.timezone}
                  onChange={(e) => patch({ timezone: e.target.value })}
                />
              </Field>
            </div>
          </SectionCard>
        </>
      )}
    </CmsFormShell>
  );
}
