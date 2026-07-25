'use client';

import { Field, Input } from '@/components/admin/ui/control';

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

/**
 * A hex-colour field: a native colour swatch paired with a text input, so an
 * editor can pick visually or paste an exact value. An empty value means "use
 * the theme default" and shows a neutral swatch.
 */
export function ColorField({ label, value, onChange }: ColorFieldProps) {
  const id = `color-${label.replace(/\s+/g, '-').toLowerCase()}`;
  const isHex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);

  return (
    <Field label={label} htmlFor={id} hint="Hex value, e.g. #4f46e5. Empty = theme default.">
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} swatch`}
          value={isHex ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="border-border size-9 shrink-0 cursor-pointer rounded-lg border bg-transparent p-0.5"
        />
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#4f46e5"
        />
      </div>
    </Field>
  );
}
