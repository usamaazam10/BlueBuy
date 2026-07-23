'use client';

import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuantitySelectorProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  className?: string;
}

/** Accessible +/- stepper for choosing a quantity. */
export function QuantitySelector({
  value,
  onChange,
  min = 1,
  max = 99,
  className,
}: QuantitySelectorProps) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));

  return (
    <div
      className={cn('border-border inline-flex h-11 items-center rounded-full border', className)}
    >
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= min}
        aria-label="Decrease quantity"
        className="text-muted-foreground hover:text-foreground disabled:hover:text-muted-foreground flex size-11 items-center justify-center rounded-l-full transition-colors disabled:opacity-40"
      >
        <Minus className="size-4" />
      </button>
      <span
        className="w-8 text-center text-sm font-semibold tabular-nums"
        aria-live="polite"
        aria-label={`Quantity: ${value}`}
      >
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        disabled={value >= max}
        aria-label="Increase quantity"
        className="text-muted-foreground hover:text-foreground disabled:hover:text-muted-foreground flex size-11 items-center justify-center rounded-r-full transition-colors disabled:opacity-40"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
