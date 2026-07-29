/**
 * Base-path normalization, shared by `next.config.ts` and `@/lib/env`.
 *
 * A GitHub Pages *project* site is served from `https://<user>.github.io/<repo>/`
 * and needs a `/<repo>` prefix on every asset. A site served from a custom
 * domain (`https://bluebuy.store/`) is at the origin root and must have **no**
 * prefix — a stale `/BlueBuy` prefix makes every CSS/JS/image URL 404 and the
 * page renders unstyled.
 *
 * Both consumers must agree on the value, so the normalization lives here.
 * Keep this module dependency-free: `next.config.ts` imports it directly.
 *
 * Accepts `''`, `'/'`, `'BlueBuy'`, `'/BlueBuy'` or `'/BlueBuy/'` and always
 * returns either `''` or a `/`-prefixed path with no trailing slash — the only
 * two shapes Next.js accepts for `basePath`.
 */
export function normalizeBasePath(value: string | undefined | null): string {
  const trimmed = (value ?? '').trim();
  if (trimmed === '' || trimmed === '/') return '';

  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeadingSlash.replace(/\/+$/, '');
}
