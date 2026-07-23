'use client';

import { Bold, Italic, Link2, List, ListOrdered, Heading2 } from 'lucide-react';
import { Textarea } from './control';

interface RichTextEditorProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const TOOLS = [
  { icon: Bold, label: 'Bold' },
  { icon: Italic, label: 'Italic' },
  { icon: Heading2, label: 'Heading' },
  { icon: List, label: 'Bulleted list' },
  { icon: ListOrdered, label: 'Numbered list' },
  { icon: Link2, label: 'Insert link' },
];

/**
 * Placeholder rich-text editor: a styled toolbar over a plain textarea. The
 * formatting buttons are inert (disabled) — this is a UI stand-in for a real
 * editor (e.g. TipTap) to be wired up in a later, non-UI phase.
 */
export function RichTextEditor({ id, value, onChange, placeholder }: RichTextEditorProps) {
  return (
    <div className="border-border focus-within:border-brand focus-within:ring-ring/30 overflow-hidden rounded-lg border transition-colors focus-within:ring-2">
      <div className="border-border bg-muted/40 flex items-center gap-0.5 border-b px-1.5 py-1">
        {TOOLS.map(({ icon: Icon, label }) => (
          <button
            key={label}
            type="button"
            disabled
            aria-label={label}
            title={`${label} — coming soon`}
            className="text-muted-foreground flex size-7 items-center justify-center rounded-md transition-colors disabled:opacity-50"
          >
            <Icon className="size-4" />
          </button>
        ))}
        <span className="text-muted-foreground ml-auto pr-1 text-[10px] tracking-wide uppercase">
          Preview
        </span>
      </div>
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-40 rounded-none border-0 focus-visible:ring-0"
      />
    </div>
  );
}
