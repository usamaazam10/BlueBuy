/**
 * CSV export utilities.
 *
 * Two things here are easy to get wrong and are handled once, centrally:
 *
 * 1. **Quoting.** Any value containing a comma, quote or newline is quoted and
 *    its quotes doubled, per RFC 4180.
 *
 * 2. **Formula injection.** A cell beginning `=`, `+`, `-`, `@`, tab or CR is
 *    interpreted as a formula by Excel/Sheets. Since exported data includes
 *    customer-supplied text (names, addresses, order notes), such values are
 *    prefixed with a single quote so they open as inert text rather than
 *    executing on the owner's machine.
 */

/** A column definition for {@link toCsv}. */
export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

const NEEDS_QUOTING = /[",\r\n]/;
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/** Escape a single cell: neutralise formulas, then quote if required. */
export function escapeCsvValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';

  let text = String(value);
  // Numbers are safe as-is; only text can carry a leading formula character.
  if (typeof value === 'string' && FORMULA_PREFIX.test(text)) {
    text = `'${text}`;
  }
  if (NEEDS_QUOTING.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

/** Render rows as an RFC 4180 CSV document. */
export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const lines: string[] = [columns.map((column) => escapeCsvValue(column.header)).join(',')];
  for (const row of rows) {
    lines.push(columns.map((column) => escapeCsvValue(column.value(row))).join(','));
  }
  // Trailing newline keeps POSIX tools and spreadsheet importers happy.
  return `${lines.join('\r\n')}\r\n`;
}

/**
 * Trigger a browser download of CSV text.
 *
 * A BOM is prepended so Excel on Windows detects UTF-8 and doesn't mangle
 * non-ASCII names. No-ops outside the browser (safe under static prerender).
 */
export function downloadCsv(filename: string, csv: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Release the object URL on the next tick — revoking synchronously can abort
  // the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Build a dated, slug-safe export filename, e.g. `bluebuy-sales-2026-08-18`. */
export function exportFilename(kind: string, range?: { start: Date; end: Date }): string {
  const iso = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate()
    ).padStart(2, '0')}`;
  const safeKind = kind
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  if (!range) return `bluebuy-${safeKind}-${iso(new Date())}`;
  // `end` is exclusive; step back a day so the filename shows the last day the
  // export actually covers.
  const lastDay = new Date(range.end.getTime() - 86_400_000);
  return `bluebuy-${safeKind}-${iso(range.start)}_to_${iso(lastDay)}`;
}
