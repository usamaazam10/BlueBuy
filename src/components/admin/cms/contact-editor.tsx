'use client';

import { Field, Input, Textarea } from '@/components/admin/ui/control';
import { ContactRepository } from '@/repositories';
import { queryKeys } from '@/hooks/queries/keys';
import type { ContactInformation } from '@/types/cms';
import { useCmsSingleton } from './use-cms-singleton';
import { CmsFormShell, SectionCard } from './cms-form-shell';

/** Editor for the `contact_information` singleton — contact page + footer details. */
export function ContactEditor() {
  const { draft, patch, loading, loadError, dirty, saving, onSave, onReset, reload } =
    useCmsSingleton<ContactInformation>({
      load: () => ContactRepository.get(),
      save: (value) => ContactRepository.save(value),
      queryKey: queryKeys.contactInformation,
      label: 'Contact information',
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
          <SectionCard title="Intro" description="The heading shown on the contact page.">
            <Field label="Eyebrow" htmlFor="contact-eyebrow">
              <Input
                id="contact-eyebrow"
                value={draft.eyebrow}
                onChange={(e) => patch({ eyebrow: e.target.value })}
              />
            </Field>
            <Field label="Heading" htmlFor="contact-heading">
              <Input
                id="contact-heading"
                value={draft.heading}
                onChange={(e) => patch({ heading: e.target.value })}
              />
            </Field>
            <Field label="Subheading" htmlFor="contact-subheading">
              <Textarea
                id="contact-subheading"
                value={draft.subheading}
                onChange={(e) => patch({ subheading: e.target.value })}
              />
            </Field>
          </SectionCard>

          <SectionCard
            title="Details"
            description="Each detail renders as a contact method — leave a field empty to hide it."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Email" htmlFor="contact-email">
                <Input
                  id="contact-email"
                  type="email"
                  value={draft.email}
                  onChange={(e) => patch({ email: e.target.value })}
                />
              </Field>
              <Field label="Phone" htmlFor="contact-phone">
                <Input
                  id="contact-phone"
                  value={draft.phone}
                  onChange={(e) => patch({ phone: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Address" htmlFor="contact-address">
              <Input
                id="contact-address"
                value={draft.address}
                onChange={(e) => patch({ address: e.target.value })}
              />
            </Field>
            <Field label="Hours" htmlFor="contact-hours" hint="Optional, e.g. Mon–Fri, 9am–6pm.">
              <Input
                id="contact-hours"
                value={draft.hours}
                onChange={(e) => patch({ hours: e.target.value })}
              />
            </Field>
          </SectionCard>

          <SectionCard
            title="Contact form delivery"
            description="Where messages from the contact form go. The site is a static export with no server, so the form must hand off to something real."
          >
            <Field
              label="Form endpoint"
              htmlFor="contact-endpoint"
              hint="Optional https:// endpoint from a hosted form service (Formspree, Web3Forms, Getform…) that forwards submissions to your inbox. This URL is public — never paste an API secret here. Leave empty to have the form hand off to WhatsApp, or to email when no WhatsApp number is set."
            >
              <Input
                id="contact-endpoint"
                type="url"
                inputMode="url"
                placeholder="https://formspree.io/f/xxxxxxxx"
                value={draft.formEndpoint}
                onChange={(e) => patch({ formEndpoint: e.target.value })}
              />
            </Field>
          </SectionCard>
        </>
      )}
    </CmsFormShell>
  );
}
