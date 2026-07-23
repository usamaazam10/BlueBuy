import * as React from 'react';
import { cn } from '@/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          'border-border bg-background flex h-11 w-full rounded-full border px-4 text-sm transition-colors',
          'placeholder:text-muted-foreground',
          'focus-visible:border-brand focus-visible:ring-ring/40 focus-visible:ring-2 focus-visible:outline-none',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        'border-border bg-background flex min-h-28 w-full rounded-2xl border px-4 py-3 text-sm transition-colors',
        'placeholder:text-muted-foreground',
        'focus-visible:border-brand focus-visible:ring-ring/40 focus-visible:ring-2 focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
});
Textarea.displayName = 'Textarea';

export { Input, Textarea };
