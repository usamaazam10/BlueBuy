'use client';

/**
 * CSV export control.
 *
 * Rows are built lazily, on click, so a page carrying several export buttons
 * doesn't serialise every dataset on every render. The filename always carries
 * the exported period, so a folder of downloads stays self-describing.
 */
import * as React from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadCsv, exportFilename, toCsv, type CsvColumn } from '@/lib/business/csv';
import type { DateRange } from '@/lib/business/date-range';

export interface ExportButtonProps<T> {
  /** Used in the filename, e.g. "sales" → `bluebuy-sales-2026-08-01_to_…csv`. */
  kind: string;
  /** Called on click — build the rows here, not during render. */
  getRows: () => readonly T[];
  columns: readonly CsvColumn<T>[];
  range?: DateRange | null;
  label?: string;
  disabled?: boolean;
}

export function ExportButton<T>({
  kind,
  getRows,
  columns,
  range,
  label = 'Export CSV',
  disabled,
}: ExportButtonProps<T>) {
  const [busy, setBusy] = React.useState(false);

  const handleExport = React.useCallback(() => {
    setBusy(true);
    try {
      const rows = getRows();
      downloadCsv(exportFilename(kind, range ?? undefined), toCsv(rows, columns));
    } finally {
      setBusy(false);
    }
  }, [getRows, columns, kind, range]);

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="rounded-lg"
      onClick={handleExport}
      disabled={disabled || busy}
    >
      <Download className="size-4" aria-hidden="true" />
      {label}
    </Button>
  );
}
