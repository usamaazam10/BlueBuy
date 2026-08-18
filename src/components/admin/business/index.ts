/**
 * Reusable pieces for the business dashboards.
 *
 * Kept separate from `@/components/admin/ui` (generic admin primitives) because
 * everything here understands the *reporting* domain: periods, comparisons,
 * data-quality states and series colours.
 */
export { LineChart, BarChart, RankBars, type Series, type SeriesSlot } from './charts';
export { MetricCard, DataQualityNote, type MetricCardProps } from './metric-card';
export { DateRangePicker, useDateRange, type UseDateRange } from './date-range-picker';
export { ExportButton } from './export-button';
export { BreakdownTable, type BreakdownColumn } from './breakdown-table';
