'use client';

import * as React from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Admin form primitives. These intentionally use tighter radii (`rounded-lg`)
 * and shorter controls than the storefront's pill-shaped `@/components/ui`
 * inputs, matching the denser Linear/Vercel/Stripe admin aesthetic.
 */

const controlBase =
  'w-full rounded-lg border border-border bg-background text-sm text-foreground transition-colors ' +
  'placeholder:text-muted-foreground focus-visible:border-brand focus-visible:ring-2 ' +
  'focus-visible:ring-ring/30 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50';

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type = 'text', ...props }, ref) => (
  <input ref={ref} type={type} className={cn(controlBase, 'h-9 px-3', className)} {...props} />
));
Input.displayName = 'Input';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(controlBase, 'min-h-24 px-3 py-2', className)} {...props} />
));
Textarea.displayName = 'Textarea';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /** When true, the select shrinks to the compact toolbar height. */
  compact?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, compact, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          controlBase,
          'cursor-pointer appearance-none pr-9 pl-3',
          compact ? 'h-9' : 'h-9',
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2" />
    </div>
  )
);
Select.displayName = 'Select';

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-foreground text-sm font-medium', className)} {...props} />;
}

interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  /** Marks the field visually as required. */
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

/** A labelled form row with an optional hint/error line. */
export function Field({ label, htmlFor, hint, error, required, className, children }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {error ? (
        <p className="text-destructive text-xs">{error}</p>
      ) : hint ? (
        <p className="text-muted-foreground text-xs">{hint}</p>
      ) : null}
    </div>
  );
}

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

/** Accessible checkbox with a custom check indicator. */
export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, ...props }, ref) => {
    const generated = React.useId();
    const inputId = id ?? generated;
    return (
      <label htmlFor={inputId} className="flex cursor-pointer items-center gap-2 text-sm">
        <span className="relative inline-flex size-4 items-center justify-center">
          <input
            ref={ref}
            id={inputId}
            type="checkbox"
            className={cn(
              'peer border-border text-brand focus-visible:ring-ring/40 bg-background size-4 appearance-none rounded-[5px] border transition-colors',
              'checked:border-brand checked:bg-brand focus-visible:ring-2 focus-visible:outline-none',
              className
            )}
            {...props}
          />
          <Check className="text-brand-foreground pointer-events-none absolute size-3 opacity-0 peer-checked:opacity-100" />
        </span>
        {label && <span className="text-foreground select-none">{label}</span>}
      </label>
    );
  }
);
Checkbox.displayName = 'Checkbox';

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
  'aria-label'?: string;
}

/** Toggle switch (role=switch) for boolean settings like Featured / Active. */
export function Switch({ checked, onCheckedChange, id, disabled, ...aria }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'focus-visible:ring-ring focus-visible:ring-offset-background relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50',
        checked ? 'bg-brand' : 'bg-input'
      )}
      {...aria}
    >
      <span
        className={cn(
          'inline-block size-4 rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-[18px]' : 'translate-x-0.5'
        )}
      />
    </button>
  );
}
