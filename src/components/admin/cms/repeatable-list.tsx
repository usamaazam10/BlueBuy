'use client';

import * as React from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RepeatableListProps<T> {
  items: T[];
  onChange: (items: T[]) => void;
  /** Builds a fresh item when "Add" is clicked. */
  newItem: () => T;
  /** Renders the editable fields for one row; call `update` with a new value. */
  renderRow: (item: T, update: (value: T) => void, index: number) => React.ReactNode;
  addLabel: string;
  /** Message shown when the list is empty. */
  emptyLabel?: string;
  /** Hide the reorder controls (for lists where order doesn't matter). */
  disableReorder?: boolean;
  /** Maximum number of rows. */
  max?: number;
}

/**
 * A generic add / remove / reorder list editor for embedded arrays (footer
 * columns and their links, curated featured ids, …). Purely controlled — it
 * owns no state, so it composes inside any draft. Each row gets move up/down and
 * remove controls plus whatever fields `renderRow` provides.
 */
export function RepeatableList<T>({
  items,
  onChange,
  newItem,
  renderRow,
  addLabel,
  emptyLabel,
  disableReorder = false,
  max,
}: RepeatableListProps<T>) {
  function update(index: number, value: T) {
    onChange(items.map((item, i) => (i === index ? value : item)));
  }
  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }
  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }
  function add() {
    if (max != null && items.length >= max) return;
    onChange([...items, newItem()]);
  }

  const atMax = max != null && items.length >= max;

  return (
    <div className="flex flex-col gap-3">
      {items.length === 0 && emptyLabel && (
        <p className="text-muted-foreground border-border rounded-lg border border-dashed px-3 py-4 text-center text-sm">
          {emptyLabel}
        </p>
      )}

      {items.map((item, index) => (
        <div
          key={index}
          className="border-border bg-background flex items-start gap-2 rounded-lg border p-3"
        >
          <div className="min-w-0 flex-1">
            {renderRow(item, (value) => update(index, value), index)}
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            {!disableReorder && (
              <>
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label="Move up"
                  className="text-muted-foreground hover:bg-secondary hover:text-foreground flex size-8 items-center justify-center rounded-lg transition-colors disabled:opacity-30"
                >
                  <ChevronUp className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === items.length - 1}
                  aria-label="Move down"
                  className="text-muted-foreground hover:bg-secondary hover:text-foreground flex size-8 items-center justify-center rounded-lg transition-colors disabled:opacity-30"
                >
                  <ChevronDown className="size-4" />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => remove(index)}
              aria-label="Remove"
              className="text-muted-foreground hover:bg-destructive/10 flex size-8 items-center justify-center rounded-lg transition-colors hover:text-rose-600 dark:hover:text-rose-400"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>
      ))}

      {!atMax && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start rounded-lg"
          onClick={add}
        >
          <Plus className="size-4" /> {addLabel}
        </Button>
      )}
    </div>
  );
}
