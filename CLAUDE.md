# CLAUDE.md

Guidance for working in the BlueBuy repo. Read this before making changes.

## What this is

Ecommerce app: **Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 · shadcn/ui**, backed by **Firebase (client SDK)** and **Cloudinary**, shipped as a **static export** to GitHub Pages.

Two surfaces:

- **Storefront** (`/`, `/products`, `/product/[slug]`, `/about`, `/contact`, `/cart`, `/checkout`) — public. Product/category/brand/CMS content comes from **Firestore**; product pages are pre-rendered at build time and hydrated with live data via React Query. Checkout creates real orders and decrements inventory.
- **Admin dashboard** (`/admin/*`) — real, auth-gated. Product / category / brand CRUD, a CMS (homepage, hero/banners, navigation, footer, contact, social, settings), and order management — all reading and writing **Firestore**. Images upload to **Cloudinary**.

Auth is email/password with **custom-claim RBAC** (`role: 'admin'`); the real access boundary is [`firestore.rules`](firestore.rules). See [`AUTHENTICATION.md`](AUTHENTICATION.md).

## Commands

```bash
npm run dev         # dev server → http://localhost:3000
npm run typecheck   # tsc --noEmit
npm run lint        # next lint (eslint)
npm run build       # static export → out/
npm run format      # prettier --write .
```

Always run `typecheck` + `lint` before finishing. Husky + lint-staged run eslint/prettier on commit, so match Prettier formatting (run `npm run format` on new files). Prefer the Browser preview tools over `next dev` in a shell — a `dev` config exists in `.claude/launch.json`. **Don't run `npm run build` while the dev server is running** — the export overwrites `.next` and breaks the running dev server (restart it if you do).

## Non-negotiable conventions

### Styling: design tokens only, never raw colors

Colors live as CSS variables in [`src/styles/globals.css`](src/styles/globals.css) (oklch) and are exposed as Tailwind utilities. **Use the token classes**, not hex or `slate-500`:

`bg-background` `text-foreground` `bg-card` `border-border` `bg-secondary` `text-muted-foreground` `bg-primary` `bg-brand` `text-brand` `bg-destructive` `bg-muted`.

Exceptions where literal colors are intentional: status tints (`emerald`/`amber`/`rose`) and `ProductMedia` accents. Dark mode is the `.dark` class strategy via `next-themes` — every token has a `.dark` value, so token classes get dark mode for free. Only add explicit `dark:` variants for the tint exceptions.

### Radii

Storefront primitives (`src/components/ui/`) are **pill-shaped** (`rounded-full` buttons/inputs, `rounded-2xl` cards). The admin uses **tighter radii** (`rounded-lg` controls, `rounded-xl` panels) via `src/components/admin/ui/`. Don't mix the two systems. To reuse a storefront `Button` in admin, override with `className="rounded-lg"` (twMerge resolves the conflict) and `size="sm"`.

### Components

- `cn()` from [`src/lib/utils.ts`](src/lib/utils.ts) for all conditional classes (clsx + tailwind-merge).
- Variants via `class-variance-authority` (`cva`) — see [`button.tsx`](src/components/ui/button.tsx).
- Icons: `lucide-react`. Animation: `framer-motion`. Currency/number: `formatPrice`/`formatCompact` in [`src/lib/format.ts`](src/lib/format.ts).
- `Modal` and `Drawer` ([`src/components/ui/`](src/components/ui/)) are portal-based, accessible (focus trap, scroll lock, Esc). Reuse them — don't hand-roll dialogs.
- Match surrounding code: JSDoc on exported components, `forwardRef` + `displayName` for primitives, `'use client'` only where hooks/interactivity are needed.
- Every icon-only button needs an `aria-label`. Keep the a11y tree clean.

### Path alias

Import via `@/` (→ `src/`). Feature types can live beside their feature; cross-cutting types go in `src/types/`.

## Architecture notes (non-obvious)

### Data access is layered — the UI never touches Firestore directly

`Firestore ← Repository ← Service ← React Query hook ← Component`.

- **Repositories** ([`src/repositories/`](src/repositories/)) are the only place Firestore is read/written. Payloads are validated with Zod ([`src/lib/validations/`](src/lib/validations/)) inside the repository, so a malformed write can never reach Firestore regardless of caller. Every error is normalized to an `AppError` via `withAppError`.
- **Services** ([`src/services/`](src/services/)) own domain orchestration (e.g. `order.service.ts` prices the cart + generates order numbers).
- **Hooks** ([`src/hooks/queries/`](src/hooks/queries/)) are the only thing components call for data (React Query). Keep this boundary.

### Firestore models vs. storefront view models

- [`src/types/models.ts`](src/types/models.ts) = **Firestore documents** (`Product`, `Category`, `Brand`, etc.). Not re-exported through `@/types`.
- [`src/types/store.ts`](src/types/store.ts) = **storefront view models** (`StoreProduct`, …). [`src/lib/mappers/store.ts`](src/lib/mappers/store.ts) is the single translation layer: it resolves a product's `categoryId`/`brandId` against the real category/brand docs, picks the current price (sale vs. base), and builds ready-to-render images. **Products reference categories/brands by Firestore id** — always source category/brand pickers from the live collections (never from `src/data/`), or the ids won't resolve.

### Storefront reads: build-time + client hydration

- `product/[slug]` and `sitemap.ts` read Firestore **at build time** via [`src/lib/server/catalog.ts`](src/lib/server/catalog.ts) (memoized), so each product ships as static HTML with real per-product SEO/JSON-LD. Because of this, a newly created/edited product appears on the public storefront only after the **next build + deploy** — in-app (client) reads are always live.
- Client components read live via the query hooks, so the admin and interactive storefront always reflect current Firestore data.

### Static export gotchas (`output: 'export'`)

- **Any dynamic route (`[slug]`) MUST export `generateStaticParams`** or the build fails. Product ids created at runtime aren't known at build time, so admin **edit** uses a static route with a query param — [`/admin/products/edit?id=…`](src/app/admin/products/edit/page.tsx) — not a `[id]` segment.
- No server runtime: no Route Handlers, no server actions, no `next/image` optimization (`images.unoptimized` is on), no Cloud Functions. All Firebase/Cloudinary work is **client-side** with public `NEXT_PUBLIC_*` config; access is controlled by Firestore rules + the Cloudinary preset, not by hiding config.
- `trailingSlash: true` and `basePath` (`NEXT_PUBLIC_BASE_PATH`) are set for GitHub Pages; use `next/link`, don't hardcode paths.

### Firebase & App Check

- App singleton in [`src/firebase/app.ts`](src/firebase/app.ts); everything is accessed through lazy getters in [`src/firebase/`](src/firebase/) so importing never triggers init (safe for prerender). [`src/firebase/app-check.ts`](src/firebase/app-check.ts) attaches App Check in the browser and is a no-op until a reCAPTCHA site key is configured.

### `src/data/` — legacy/support data only

Firestore is the source of truth for products, categories, brands, CMS, and orders. `src/data/admin/` now supplies only non-catalogue bits (e.g. admin nav, `LOW_STOCK_THRESHOLD`). [`ProductMedia`](src/components/product/product-media.tsx) renders deterministic geometric SVG art from a `seed` + `accent` as a fallback when a product has no image.

### Storefront vs. admin chrome

The root layout ([`src/app/layout.tsx`](src/app/layout.tsx)) provides `<html>/<body>` + providers (theme, React Query, cart). The storefront navbar/footer are rendered by [`SiteChrome`](src/components/layout/site-chrome.tsx), which **skips its chrome under `/admin`** (via `usePathname`). The admin supplies its own shell ([`AdminShell`](src/components/admin/layout/admin-shell.tsx)), gated by `ProtectedRoute`. Don't put storefront chrome in the root layout.

## Guardrails

- Don't modify the storefront when asked to work on admin (and vice versa) unless required.
- Keep the app static-export-safe — no server-only APIs.
- Keep the data-access layering intact — components go through hooks, not repositories/Firestore.
- Verify visible changes in the browser preview (light + dark, mobile + desktop) before declaring done.
