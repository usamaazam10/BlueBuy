# BlueBuy

A modern, production-minded ecommerce app built with Next.js 15, React 19,
TypeScript, Tailwind CSS v4, and shadcn/ui — backed by Firebase and Cloudinary,
and shipped as a **static export** to GitHub Pages.

## Features

- **Storefront** — home, product listing with search / category + brand filters /
  sorting, product detail pages, cart, and a cash-on-delivery checkout with a
  WhatsApp handoff. Per-product SEO (OpenGraph, Twitter, canonical) and JSON-LD.
- **Admin dashboard** (`/admin`) — auth-gated. Product, category, and brand
  management; a CMS for the homepage, hero/banners, navigation, footer, contact,
  social links, and site settings; and order management with a status workflow.
- **Live data** — products, categories, brands, CMS content, and orders are
  stored in **Firestore**. Product images are uploaded to and served from
  **Cloudinary**.
- **Auth & roles** — email/password sign-in with custom-claim RBAC; access is
  enforced by Firestore Security Rules.

## Tech Stack

- **Next.js 15** (App Router) + **React 19**, **TypeScript** (strict)
- **Tailwind CSS v4** + **shadcn/ui**, **next-themes** (class-strategy dark mode)
- **Firebase** (Auth + Firestore, client SDK) + **App Check** (optional)
- **Cloudinary** (unsigned uploads) · **@tanstack/react-query** · **Zod** · **framer-motion**
- **ESLint**, **Prettier**, **Husky**, **lint-staged** · **static export** for GitHub Pages

## Getting Started

```bash
npm install
cp .env.example .env.local   # fill in Firebase + Cloudinary values
npm run dev                  # http://localhost:3000
```

You'll need a Firebase project (Auth + Firestore) and a Cloudinary account with an
unsigned upload preset. See [`AUTHENTICATION.md`](AUTHENTICATION.md) and
[`CLOUDINARY.md`](CLOUDINARY.md) for setup, and deploy the security rules:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

## Scripts

| Script              | Description                      |
| ------------------- | -------------------------------- |
| `npm run dev`       | Start the dev server             |
| `npm run build`     | Production build → static `out/` |
| `npm run lint`      | Run ESLint                       |
| `npm run typecheck` | Type-check with `tsc`            |
| `npm run format`    | Format with Prettier             |

## Project Structure

```
src/
├── app/          # App Router routes (storefront + /admin), layout, metadata, robots, sitemap
├── components/   # UI (ui/ = storefront primitives, admin/ui/ = admin primitives) + features
├── context/      # Cart context
├── data/         # Support data (admin nav, thresholds) — Firestore is the source of truth
├── firebase/     # Firebase app, auth, firestore, app-check, errors (lazy getters)
├── hooks/        # React Query data hooks (the only data entry point for components)
├── lib/          # cart pricing, order/auth helpers, mappers, seo, validations, utils
├── repositories/ # Firestore data access (validated; UI never calls these directly)
├── services/     # Domain orchestration (orders, cloudinary)
├── types/        # Firestore models + storefront view models
└── styles/       # Global styles / Tailwind entry
```

## Documentation

- [`CLAUDE.md`](CLAUDE.md) — architecture & conventions
- [`AUTHENTICATION.md`](AUTHENTICATION.md) — auth, roles, route protection, App Check
- [`ORDER_MANAGEMENT.md`](ORDER_MANAGEMENT.md) — checkout, orders, inventory
- [`PRODUCT_MANAGEMENT.md`](PRODUCT_MANAGEMENT.md) · [`PRODUCT_DATA_FLOW.md`](PRODUCT_DATA_FLOW.md) · [`CMS.md`](CMS.md) · [`CLOUDINARY.md`](CLOUDINARY.md)

## Deployment (GitHub Pages)

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds the static
site and publishes it. In **Settings → Pages**, set **Source** to **GitHub Actions**.
`NEXT_PUBLIC_BASE_PATH` is injected from the Pages configuration; add the
`NEXT_PUBLIC_FIREBASE_*` / `NEXT_PUBLIC_CLOUDINARY_*` / `NEXT_PUBLIC_STORE_WHATSAPP`
values as repository secrets so they're inlined at build time.
