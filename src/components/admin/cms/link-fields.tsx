'use client';

import { Field, Input } from '@/components/admin/ui/control';
import type { CmsLink } from '@/types/cms';

interface LinkFieldsProps {
  value: CmsLink;
  onChange: (value: CmsLink) => void;
  /** Unique id prefix so multiple LinkFields on a page keep distinct labels. */
  idPrefix: string;
  labelText?: string;
}

/** Paired label + href inputs for editing a {@link CmsLink}. */
export function LinkFields({ value, onChange, idPrefix, labelText = 'Button' }: LinkFieldsProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label={`${labelText} label`} htmlFor={`${idPrefix}-label`}>
        <Input
          id={`${idPrefix}-label`}
          value={value.label}
          onChange={(e) => onChange({ ...value, label: e.target.value })}
          placeholder="Shop now"
        />
      </Field>
      <Field label={`${labelText} link`} htmlFor={`${idPrefix}-href`}>
        <Input
          id={`${idPrefix}-href`}
          value={value.href}
          onChange={(e) => onChange({ ...value, href: e.target.value })}
          placeholder="/products"
        />
      </Field>
    </div>
  );
}
