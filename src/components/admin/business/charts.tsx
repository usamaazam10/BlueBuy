'use client';

/**
 * A small, dependency-free SVG chart kit for the business dashboards.
 *
 * Hand-rolled rather than pulling in a charting library: the dashboards need
 * four shapes, every colour must come from the design tokens (so dark mode is a
 * token swap rather than a second theme), and a static export benefits from not
 * shipping a charting runtime.
 *
 * Conventions enforced here rather than left to each caller:
 *  - **One y-axis, always.** There is no dual-axis option, because two scales on
 *    one frame make unrelated magnitudes look comparable.
 *  - **Series colours are positional.** Slot 1 is the primary measure, slot 2
 *    the opposing one. Removing a series never repaints the others.
 *  - **Thin marks, recessive axes.** 2px lines, 4px rounded bar ends, grid lines
 *    in `--chart-grid`, which is weaker than the UI border.
 *  - **Text wears text tokens**, never the series colour.
 *  - Every chart is paired with a table by its caller, which is what licenses
 *    the one series colour that sits under 3:1 on the light surface.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

/** Positional series slots. Never cycle past slot 3 — fold into "Other". */
export type SeriesSlot = 1 | 2 | 3;

const SERIES_VAR: Record<SeriesSlot, string> = {
  1: 'var(--chart-1)',
  2: 'var(--chart-2)',
  3: 'var(--chart-3)',
};

/** A single plotted series. */
export interface Series {
  label: string;
  /** One value per x position; must match `labels` in length. */
  values: number[];
  slot: SeriesSlot;
}

interface ChartFrameProps {
  labels: string[];
  series: Series[];
  /** Formats a value for the tooltip and axis. */
  format: (value: number) => string;
  height?: number;
  className?: string;
  /** Accessible summary; also the caption read by screen readers. */
  ariaLabel: string;
  children?: React.ReactNode;
}

/** Nice-ish axis maximum: rounds up to a readable step. */
function axisMax(values: number[]): number {
  const peak = Math.max(0, ...values);
  if (peak <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(peak));
  const normalised = peak / magnitude;
  const step = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10;
  return step * magnitude;
}

/** Shared empty state so a chart never renders an empty, meaningless frame. */
function NoData({ height, message }: { height: number; message: string }) {
  return (
    <div
      className="text-muted-foreground flex items-center justify-center text-sm"
      style={{ height }}
    >
      {message}
    </div>
  );
}

/** Legend — always present for two or more series. */
function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null;
  return (
    <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
      {series.map((entry) => (
        <li key={entry.label} className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: SERIES_VAR[entry.slot] }}
            aria-hidden="true"
          />
          {entry.label}
        </li>
      ))}
    </ul>
  );
}

/**
 * Line/area chart with a crosshair tooltip.
 *
 * Hover is part of the chart, not an enhancement: the x-axis is thinned to a few
 * labels to stay legible, so the tooltip is how a reader reads an exact day.
 */
export function LineChart({
  labels,
  series,
  format,
  height = 240,
  className,
  ariaLabel,
  emptyMessage = 'No data for this period yet.',
}: ChartFrameProps & { emptyMessage?: string }) {
  const [active, setActive] = React.useState<number | null>(null);

  const allValues = series.flatMap((entry) => entry.values);
  const hasData = allValues.some((value) => value !== 0);
  if (labels.length === 0 || series.length === 0) {
    return <NoData height={height} message={emptyMessage} />;
  }

  const max = axisMax(allValues);
  const padding = { top: 8, right: 8, bottom: 22, left: 8 };
  const width = 720;
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const xFor = (index: number) =>
    padding.left +
    (labels.length === 1 ? plotWidth / 2 : (index / (labels.length - 1)) * plotWidth);
  const yFor = (value: number) => padding.top + plotHeight - (value / max) * plotHeight;

  // Show at most 6 x labels so they never collide on a 30-day range.
  const labelStride = Math.max(1, Math.ceil(labels.length / 6));

  return (
    <figure className={cn('relative', className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full overflow-visible"
        style={{ height }}
        role="img"
        aria-label={ariaLabel}
        onMouseLeave={() => setActive(null)}
      >
        {/* Recessive grid */}
        {[0, 0.5, 1].map((fraction) => (
          <line
            key={fraction}
            x1={padding.left}
            x2={width - padding.right}
            y1={padding.top + plotHeight * fraction}
            y2={padding.top + plotHeight * fraction}
            stroke="var(--chart-grid)"
            strokeWidth={1}
          />
        ))}

        {series.map((entry) => {
          const points = entry.values.map((value, index) => `${xFor(index)},${yFor(value)}`);
          const areaPath = `M ${xFor(0)},${padding.top + plotHeight} L ${points.join(' L ')} L ${xFor(
            entry.values.length - 1
          )},${padding.top + plotHeight} Z`;

          return (
            <g key={entry.label}>
              {/* A soft fill only for a single-series chart; overlapping
                  translucent fills muddy the colours and hide crossings. */}
              {series.length === 1 && (
                <path d={areaPath} fill={SERIES_VAR[entry.slot]} opacity={0.12} />
              )}
              <polyline
                points={points.join(' ')}
                fill="none"
                stroke={SERIES_VAR[entry.slot]}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {active !== null && entry.values[active] !== undefined && (
                <circle
                  cx={xFor(active)}
                  cy={yFor(entry.values[active])}
                  r={4.5}
                  fill={SERIES_VAR[entry.slot]}
                  stroke="var(--card)"
                  strokeWidth={2}
                />
              )}
            </g>
          );
        })}

        {/* Crosshair */}
        {active !== null && (
          <line
            x1={xFor(active)}
            x2={xFor(active)}
            y1={padding.top}
            y2={padding.top + plotHeight}
            stroke="var(--chart-grid)"
            strokeWidth={1}
          />
        )}

        {/* Hit targets — wider than the marks so hovering is forgiving. */}
        {labels.map((label, index) => (
          <rect
            key={label}
            x={xFor(index) - plotWidth / labels.length / 2}
            y={padding.top}
            width={plotWidth / labels.length}
            height={plotHeight}
            fill="transparent"
            onMouseEnter={() => setActive(index)}
          />
        ))}

        {/* X axis labels, thinned */}
        {labels.map((label, index) =>
          index % labelStride === 0 || index === labels.length - 1 ? (
            <text
              key={label}
              x={xFor(index)}
              y={height - 6}
              textAnchor={index === 0 ? 'start' : index === labels.length - 1 ? 'end' : 'middle'}
              className="fill-muted-foreground text-[10px]"
            >
              {label}
            </text>
          ) : null
        )}
      </svg>

      {!hasData && (
        <p className="text-muted-foreground pointer-events-none absolute inset-0 flex items-center justify-center text-sm">
          {emptyMessage}
        </p>
      )}

      {active !== null && (
        <div className="border-border bg-card pointer-events-none absolute top-0 right-0 rounded-lg border px-3 py-2 shadow-sm">
          <p className="text-foreground text-xs font-medium">{labels[active]}</p>
          <ul className="mt-1 space-y-0.5">
            {series.map((entry) => (
              <li key={entry.label} className="flex items-center gap-2 text-xs">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: SERIES_VAR[entry.slot] }}
                  aria-hidden="true"
                />
                <span className="text-muted-foreground">{entry.label}</span>
                <span className="text-foreground ml-auto font-medium tabular-nums">
                  {format(entry.values[active] ?? 0)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Legend series={series} />
    </figure>
  );
}

/**
 * Grouped bar chart. Bars carry 4px rounded tops anchored to the baseline, and
 * adjacent bars are separated by a surface gap rather than a stroke.
 */
export function BarChart({
  labels,
  series,
  format,
  height = 240,
  className,
  ariaLabel,
  emptyMessage = 'No data for this period yet.',
}: ChartFrameProps & { emptyMessage?: string }) {
  const [active, setActive] = React.useState<number | null>(null);

  if (labels.length === 0 || series.length === 0) {
    return <NoData height={height} message={emptyMessage} />;
  }

  const allValues = series.flatMap((entry) => entry.values);
  const hasData = allValues.some((value) => value !== 0);
  const max = axisMax(allValues);

  const padding = { top: 8, right: 8, bottom: 22, left: 8 };
  const width = 720;
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const groupWidth = plotWidth / labels.length;
  // 2px surface gap between bars in a group, and between groups.
  const barWidth = Math.max(2, (groupWidth - 6) / series.length - 2);
  const labelStride = Math.max(1, Math.ceil(labels.length / 6));

  return (
    <figure className={cn('relative', className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full overflow-visible"
        style={{ height }}
        role="img"
        aria-label={ariaLabel}
        onMouseLeave={() => setActive(null)}
      >
        <line
          x1={padding.left}
          x2={width - padding.right}
          y1={padding.top + plotHeight}
          y2={padding.top + plotHeight}
          stroke="var(--chart-grid)"
          strokeWidth={1}
        />

        {labels.map((label, index) => {
          const groupX = padding.left + index * groupWidth;
          return (
            <g key={label}>
              <rect
                x={groupX}
                y={padding.top}
                width={groupWidth}
                height={plotHeight}
                fill="transparent"
                onMouseEnter={() => setActive(index)}
              />
              {series.map((entry, seriesIndex) => {
                const value = entry.values[index] ?? 0;
                const barHeight = max > 0 ? (value / max) * plotHeight : 0;
                const x = groupX + 3 + seriesIndex * (barWidth + 2);
                return (
                  <rect
                    key={entry.label}
                    x={x}
                    y={padding.top + plotHeight - barHeight}
                    width={barWidth}
                    height={Math.max(0, barHeight)}
                    rx={4}
                    fill={SERIES_VAR[entry.slot]}
                    opacity={active === null || active === index ? 1 : 0.55}
                  />
                );
              })}
            </g>
          );
        })}

        {labels.map((label, index) =>
          index % labelStride === 0 || index === labels.length - 1 ? (
            <text
              key={label}
              x={padding.left + index * groupWidth + groupWidth / 2}
              y={height - 6}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {label}
            </text>
          ) : null
        )}
      </svg>

      {!hasData && (
        <p className="text-muted-foreground pointer-events-none absolute inset-0 flex items-center justify-center text-sm">
          {emptyMessage}
        </p>
      )}

      {active !== null && (
        <div className="border-border bg-card pointer-events-none absolute top-0 right-0 rounded-lg border px-3 py-2 shadow-sm">
          <p className="text-foreground text-xs font-medium">{labels[active]}</p>
          <ul className="mt-1 space-y-0.5">
            {series.map((entry) => (
              <li key={entry.label} className="flex items-center gap-2 text-xs">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: SERIES_VAR[entry.slot] }}
                  aria-hidden="true"
                />
                <span className="text-muted-foreground">{entry.label}</span>
                <span className="text-foreground ml-auto font-medium tabular-nums">
                  {format(entry.values[active] ?? 0)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Legend series={series} />
    </figure>
  );
}

/**
 * Horizontal ranking bars — the right form for "top products by revenue", where
 * the reader compares magnitudes across named categories rather than over time.
 * Labels sit outside the bar so they stay legible at any bar length.
 */
export function RankBars({
  rows,
  format,
  slot = 1,
  className,
  emptyMessage = 'Nothing to rank yet.',
}: {
  rows: { label: string; value: number; hint?: string }[];
  format: (value: number) => string;
  slot?: SeriesSlot;
  className?: string;
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return <p className="text-muted-foreground px-1 py-6 text-sm">{emptyMessage}</p>;
  }
  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <ul className={cn('space-y-3', className)}>
      {rows.map((row) => (
        <li key={row.label}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-foreground truncate text-sm">{row.label}</span>
            <span className="text-foreground shrink-0 text-sm font-medium tabular-nums">
              {format(row.value)}
            </span>
          </div>
          <div className="bg-muted mt-1.5 h-2 overflow-hidden rounded-full">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(2, (row.value / max) * 100)}%`,
                backgroundColor: SERIES_VAR[slot],
              }}
            />
          </div>
          {row.hint && <p className="text-muted-foreground mt-1 text-xs">{row.hint}</p>}
        </li>
      ))}
    </ul>
  );
}
