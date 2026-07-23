import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium tracking-wide transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-foreground text-background',
        brand: 'bg-brand text-brand-foreground',
        muted: 'bg-secondary text-secondary-foreground',
        outline: 'border border-border text-foreground',
        sale: 'bg-rose-500 text-white',
        new: 'bg-emerald-500 text-white',
        bestseller: 'bg-amber-500 text-white',
        limited: 'bg-violet-500 text-white',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
