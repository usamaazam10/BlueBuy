import path from 'node:path';
import type { NextConfig } from 'next';

/**
 * GitHub Pages serves a project site from `https://<user>.github.io/<repo>/`,
 * so the app must be prefixed with the repo name. This is driven by an env var
 * so local dev (`/`) and production (`/<repo>`) both work without code changes.
 *
 * Set NEXT_PUBLIC_BASE_PATH to `/<repo-name>` in CI (see .github/workflows).
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

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
