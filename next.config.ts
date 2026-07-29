import path from 'node:path';
import type { NextConfig } from 'next';
import { normalizeBasePath } from './src/lib/base-path';

/**
 * Subpath the site is served under, driven by an env var so the same code
 * builds for every target.
 *
 * Production is the custom domain `https://bluebuy.store/`, which serves from
 * the origin root — so NEXT_PUBLIC_BASE_PATH is **empty** there (see
 * .github/workflows/deploy.yml). A non-empty `/<repo>` prefix is only correct
 * for a bare GitHub Pages project site; leaving one set for the custom domain
 * makes every asset URL 404 and the page renders as unstyled HTML.
 */
const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);

const nextConfig: NextConfig = {
  // Emit a fully static site into `out/` — required for GitHub Pages.
  output: 'export',

  // GitHub Pages has no Next.js image optimization server, so images must be
  // served as-is. Keep this on for GH Pages compatibility.
  images: {
    unoptimized: true,
  },

  // Prefix all routes and assets so they resolve under the project subpath.
  basePath,
  assetPrefix: basePath || undefined,

  // Emit `route/index.html` instead of `route.html` so GitHub Pages resolves
  // clean URLs correctly.
  trailingSlash: true,

  // Fail the production build on type or lint errors instead of shipping them.
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },

  reactStrictMode: true,

  // Pin the workspace root to this project so Next doesn't infer it from an
  // unrelated lockfile higher up the filesystem.
  outputFileTracingRoot: path.join(import.meta.dirname),
};

export default nextConfig;
