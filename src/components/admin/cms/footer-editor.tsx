'use client';

import { Field, Input } from '@/components/admin/ui/control';
import { FooterRepository } from '@/repositories';
import { queryKeys } from '@/hooks/queries/keys';
import type { Footer } from '@/types/cms';
import { useCmsSingleton } from './use-cms-singleton';
import { CmsFormShell, SectionCard } from './cms-form-shell';
import { RepeatableList } from './repeatable-list';

/** Editor for the `footer` singleton — tagline, link columns, copyright. */
export function FooterEditor() {
  const { draft, patch, loading, loadError, dirty, saving, onSave, onReset, reload } =
    useCmsSingleton<Footer>({
      load: () => FooterRepository.get(),
      save: (value) => FooterRepository.save(value),
      queryKey: queryKeys.footer,
      label: 'Footer',
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
          <SectionCard title="Brand" description="The blurb and copyright shown in the footer.">
            <Field label="Tagline" htmlFor="footer-tagline">
              <Input
                id="footer-tagline"
                value={draft.tagline}
                onChange={(e) => patch({ tagline: e.target.value })}
              />
            </Field>
            <Field
              label="Copyright"
              htmlFor="footer-copyright"
              hint="Use {year} for the current year."
            >
              <Input
                id="footer-copyright"
                value={draft.copyright}
                onChange={(e) => patch({ copyright: e.target.value })}
              />
            </Field>
          </SectionCard>

          <SectionCard
            title="Link columns"
            description="Company, Support, Legal — add, reorder or remove columns and their links."
          >
            <RepeatableList
              items={draft.columns}
              onChange={(columns) => patch({ columns })}
              newItem={() => ({ title: 'New column', links: [] })}
              addLabel="Add column"
              renderRow={(column, updateColumn) => (
                <div className="flex flex-col gap-3">
                  <Field label="Column title" htmlFor={`col-${column.title}`}>
                    <Input
                      value={column.title}
                      onChange={(e) => updateColumn({ ...column, title: e.target.value })}
                    />
                  </Field>
                  <div className="border-border ml-1 border-l pl-3">
                    <RepeatableList
                      items={column.links}
                      onChange={(links) => updateColumn({ ...column, links })}
                      newItem={() => ({ label: '', href: '' })}
                      addLabel="Add link"
                      emptyLabel="No links yet."
                      renderRow={(link, updateLink) => (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <Input
                            value={link.label}
                            onChange={(e) => updateLink({ ...link, label: e.target.value })}
                            placeholder="Label"
                          />
                          <Input
                            value={link.href}
                            onChange={(e) => updateLink({ ...link, href: e.target.value })}
                            placeholder="/path"
                          />
                        </div>
                      )}
                    />
                  </div>
                </div>
              )}
            />
          </SectionCard>
        </>
      )}
    </CmsFormShell>
  );
}
