/**
 * Business calculation engine.
 *
 * Every financial and inventory number the admin shows is computed here, in
 * pure functions with no Firestore or React dependency. That is deliberate:
 *
 *  - **One definition per metric.** "Net sales", "COGS", "operating profit" and
 *    "cash flow" mean exactly one thing across KPI cards, charts and CSV
 *    exports, because they are all the same function call.
 *  - **Testable.** These are plain inputs → plain outputs, so the maths is
 *    verified by unit tests rather than by eyeballing a dashboard.
 *  - **Honest by construction.** Functions return `null` when a number cannot be
 *    computed from real data; they never substitute zero for unknown.
 *
 * Import from `@/lib/business`.
 */
export * from './date-range';
export * from './metrics';
export * from './costing';
export * from './sales';
export * from './inventory';
export * from './cashflow';
export * from './profit';
export * from './analytics';
export * from './performance';
export * from './delivery';
export * from './customers';
export * from './csv';
