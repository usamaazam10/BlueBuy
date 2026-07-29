'use client';

import { Field, Input } from '@/components/admin/ui/control';
import { SiteSettingsRepository } from '@/repositories';
import { queryKeys } from '@/hooks/queries/keys';
import type { SiteSettings } from '@/types/cms';
import { useCmsSingleton } from './use-cms-singleton';
import { CmsFormShell, SectionCard } from './cms-form-shell';
import { ColorField } from './color-field';
import { LogoUploadField } from './logo-upload-field';

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
          </SectionCard>

          <SectionCard
            title="Logos & icons"
            description="Upload to Cloudinary or paste a URL. Leave any field empty to use the built-in BlueBuy default. Changes apply across the whole site."
          >
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <LogoUploadField
                label="Primary logo"
                hint="Used everywhere unless a header/footer logo overrides it."
                value={draft.logoUrl}
                onChange={(v) => patch({ logoUrl: v })}
              />
              <LogoUploadField
                label="Header logo"
                hint="Shown in the site header."
                value={draft.headerLogoUrl}
                onChange={(v) => patch({ headerLogoUrl: v })}
              />
              <LogoUploadField
                label="Footer logo"
                hint="Shown in the site footer."
                value={draft.footerLogoUrl}
                onChange={(v) => patch({ footerLogoUrl: v })}
              />
              <LogoUploadField
                label="Favicon"
                hint="Browser-tab icon (square works best)."
                value={draft.faviconUrl}
                onChange={(v) => patch({ faviconUrl: v })}
              />
              <LogoUploadField
                label="Apple touch icon"
                hint="iOS home-screen icon (180×180)."
                value={draft.appleTouchIconUrl}
                onChange={(v) => patch({ appleTouchIconUrl: v })}
              />
              <LogoUploadField
                label="Manifest icon"
                hint="PWA / Android icon (512×512)."
                value={draft.manifestIconUrl}
                onChange={(v) => patch({ manifestIconUrl: v })}
              />
              <LogoUploadField
                label="Social share image"
                hint="Open Graph card (1200×630)."
                value={draft.ogImageUrl}
                onChange={(v) => patch({ ogImageUrl: v })}
                fit="cover"
              />
              <LogoUploadField
                label="Email logo"
                hint="For transactional emails (future-ready)."
                value={draft.emailLogoUrl}
                onChange={(v) => patch({ emailLogoUrl: v })}
              />
            </div>
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
