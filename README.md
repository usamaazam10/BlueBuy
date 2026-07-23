# BlueBuy

A production-ready ecommerce foundation built with Next.js 15, React 19,
TypeScript, Tailwind CSS v4, and shadcn/ui — configured for static export to
GitHub Pages.

> Status: **Project initialized.** This is the architecture/setup foundation
> only — no features (navbar, products, cart, auth, etc.) are built yet.

## Tech Stack

- **Next.js 15** (App Router) + **React 19**
- **TypeScript** (strict)
- **Tailwind CSS v4** with **shadcn/ui** (new-york, slate)
- **next-themes** — dark mode via the `class` strategy
- **Firebase** — prepared (`src/firebase/`), not yet configured
- **ESLint**, **Prettier**, **Husky**, **lint-staged**
- **Static export** compatible with **GitHub Pages**

## Getting Started

```bash
npm install
cp .env.example .env.local   # fill in values as needed
npm run dev                  # http://localhost:3000
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
├── app/          # App Router routes, layout, metadata
├── components/   # Shared components (ui/ holds shadcn primitives)
├── features/     # Feature-based modules (products, cart, ...)
├── lib/          # Core utilities (cn, env)
├── services/     # API clients / integration layer
├── hooks/        # Reusable React hooks
├── types/        # Shared TypeScript types
├── constants/    # App-wide constants
├── utils/        # Pure helper functions
├── styles/       # Global styles / Tailwind entry
└── firebase/     # Firebase setup (prepared, not configured)
public/           # Static assets (.nojekyll, robots.txt)
```

## Deployment (GitHub Pages)

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds the
static site and publishes it. In the repo's **Settings → Pages**, set the
**Source** to **GitHub Actions**. The `NEXT_PUBLIC_BASE_PATH` is injected
automatically from the Pages configuration.
