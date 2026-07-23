# CLAUDE.md

Guidance for working in the BlueBuy repo. Read this before making changes.

## What this is

Ecommerce app: **Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 · shadcn/ui**.
Two surfaces:

- **Storefront** (`/`, `/products`, `/product/[slug]`, `/about`, `/contact`) — public, mock-data driven.
- **Admin dashboard** (`/admin/*`) — UI-only prototype (no auth, no persistence). See "Admin" below.

Firebase is scaffolded (`src/firebase/`, `src/types/models.ts`) but **not wired into any UI**. The app ships as a **static export** to GitHub Pages.

## Commands

```bash
npm run dev         # dev server → http://localhost:3000
npm run typecheck   # tsc --noEmit
npm run lint        # next lint (eslint)
npm run build       # static export → out/
npm run format      # prettier --write .
```

Always run `typecheck` + `lint` before finishing. Husky + lint-staged run eslint/prettier on commit, so match Prettier formatting (run `npm run format` on new files). Prefer the Browser preview tools over `next dev` in a shell — a `dev` config exists in `.claude/launch.json`.

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

### Storefront vs. admin chrome

The root layout ([`src/app/layout.tsx`](src/app/layout.tsx)) only provides `<html>/<body>` + `ThemeProvider`. The storefront navbar/footer are rendered by [`SiteChrome`](src/components/layout/site-chrome.tsx), a client component that **skips its chrome under `/admin`** (via `usePathname`). The admin supplies its own shell ([`AdminShell`](src/components/admin/layout/admin-shell.tsx)). So: don't put storefront-only chrome back in the root layout, and admin pages inherit no storefront UI.

### Static export gotchas (`output: 'export'`)

- **Any dynamic route (`[slug]`, `[id]`) MUST export `generateStaticParams`** or the build fails. See [`src/app/admin/products/[id]/page.tsx`](src/app/admin/products/[id]/page.tsx) and `product/[slug]`.
- No server runtime: no Route Handlers, no server actions, no `next/image` optimization (`images.unoptimized` is on). No runtime data fetching — everything is build-time/mock.
- `trailingSlash: true` and `basePath` (`NEXT_PUBLIC_BASE_PATH`) are set for GitHub Pages; use `next/link`, don't hardcode paths.

### Data is mock, and layered

- Storefront: [`src/data/products.ts`](src/data/products.ts), [`categories.ts`](src/data/categories.ts). `Product`/`Category` UI types in [`src/types/product.ts`](src/types/product.ts).
- Admin: [`src/data/admin/`](src/data/admin/) (`products.ts`, `brands.ts`, `categories.ts`, `activity.ts`, `nav.ts`, `types.ts`). Admin data is **derived from** storefront data but kept as separate arrays so admin edits never mutate storefront data.
- `src/types/models.ts` = Firestore models — **separate on purpose** from UI types; not re-exported through `@/types`. Don't conflate them.
- No stock photography anywhere: [`ProductMedia`](src/components/product/product-media.tsx) renders deterministic geometric SVG art from a `seed` + `accent`.

### Admin (`/admin`) — UI only

Scope guardrails for this surface: **no auth, no Firestore, no uploads, no persistence.** Interactions (save/publish, delete, CRUD) update local component state and show ephemeral confirmations only. Reusable admin components live in [`src/components/admin/ui/`](src/components/admin/ui/) (`DataTable`, `StatCard`, `EmptyState`, `ConfirmDialog`, `ImageUploader`, `RichTextEditor` placeholder, `Pagination`, `Breadcrumb`, form controls, `PageHeader`, status badges) with a barrel `index.ts`. Design target: Vercel/Linear/Stripe — minimal, neutral, no flashy color.

## Guardrails

- Don't modify the storefront when asked to work on admin (and vice versa) unless required.
- Keep the app static-export-safe — no server-only APIs.
- Verify visible changes in the browser preview (light + dark, mobile + desktop) before declaring done.
