# BlueBuy — Production Readiness Audit

**Date:** 2026-07-26
**Scope:** Full codebase (storefront + admin + Firebase/Cloudinary integration + CI/deploy)
**Auditor role:** Staff Software Engineer

> **Headline:** BlueBuy is a genuinely well-engineered codebase — strict TypeScript with
> zero `any`, a clean repository/service layer, Zod validation enforced at the data
> boundary, normalized error handling, thoughtful React Query configuration, portal-based
> accessible `Modal`/`Drawer`, and excellent inline documentation. `typecheck`, `lint`, and
> a full static-export `build` all pass. The gaps are at the **edges**: a
> production-breaking CI/deploy configuration bug, missing SEO artifacts, one XSS-hardening
> gap, a security model that needs an explicit gate, and a handful of dead references.
>
> This audit fixed everything that is safe to fix in code and verified it with a real build.
> Items that require console/infrastructure changes (Firebase Auth, Cloudinary presets) are
> documented with exact remediation steps under **Requires manual action**.

---

## How to read this

Each item is tagged:

- 🔴 **Critical** — breaks production, or a security hole.
- 🟠 **Important** — real quality/perf/SEO/security issue; fix before or soon after launch.
- 🟢 **Optional** — hygiene, polish, future-proofing.

And marked **✅ Fixed** (changed in this pass) or **📋 Action required** (needs you / infra).

---

## Summary checklist

### 🔴 Critical

- [x] **✅ Fixed** — CI build did not pass Firebase/Cloudinary env vars → production export shipped with **empty backend config**. The entire storefront (Firestore reads) and admin would be non-functional. `.github/workflows/deploy.yml` now injects all `NEXT_PUBLIC_*` values from GitHub Actions secrets at build time.
- [ ] **📋 Action required** — **Any authenticated user is a full admin.** `DEFAULT_ROLE = 'admin'` + Firestore rules gate every write on `request.auth != null`. If Email/Password self-signup is enabled in the Firebase console, anyone can register and gain write access to catalog, CMS, and orders. See _Requires manual action → Authentication_.

### 🟠 Important

- [x] **✅ Fixed** — **Double base-path bug** in production URLs. `absoluteUrl()` composes `siteUrl + basePath`, but `deploy.yml` set `NEXT_PUBLIC_SITE_URL = origin + base_path`, so every canonical/OG/sitemap URL got the repo subpath twice (`/bluebuy/bluebuy/...`). `deploy.yml` now sets `NEXT_PUBLIC_SITE_URL` to the **origin only**.
- [x] **✅ Fixed** — **No `sitemap.xml`.** Added `src/app/sitemap.ts` (static-export compatible) listing public routes + every active product with per-product `lastmod`.
- [x] **✅ Fixed** — **`robots.txt` was trivial** (`Allow: /`), did not disallow `/admin` or reference a sitemap. Replaced the static `public/robots.txt` with `src/app/robots.ts` that disallows `/admin`, `/login`, `/cart`, `/checkout` and links the sitemap.
- [x] **✅ Fixed** — **JSON-LD XSS hardening.** The product page injected `JSON.stringify(jsonLd)` via `dangerouslySetInnerHTML`; `JSON.stringify` does not escape `<`, so product content containing `</script>` could break out of the tag. Added `serializeJsonLd()` (escapes `<`, `>`, `&`) and used it.
- [x] **✅ Fixed** — **`NEXT_PUBLIC_STORE_WHATSAPP` used but undocumented/unset.** The post-order WhatsApp handoff silently used the placeholder number `15551234567`. Documented it in `.env.example` and wired it through CI secrets.
- [x] **✅ Fixed** — **No `firestore.indexes.json`.** Added one covering `ProductRepository.list()`'s equality-filter + `orderBy('createdAt')` combinations and wired it into `firebase.json` so `firebase deploy` ships indexes.
- [ ] **📋 Action required** — **No automated tests** of any kind. See _Testing recommendations_.

### 🟢 Optional

- [x] **✅ Fixed** — Dead reference: `env.firebase` (never read; `firebase/config.ts` owns config) removed from `src/lib/env.ts`.
- [x] **✅ Fixed** — Dead + stale reference: `SITE_CONFIG.url = 'http://localhost:3000'` (never read; `env.siteUrl` is the real source) removed from `src/constants/site.ts`.
- [ ] **🟢 Noted** — Unused service scaffolding: `src/services/product.service.ts`, `category.service.ts`, `storage.service.ts` are imported nowhere (only `order.service.ts` is used; hooks call repositories directly). Kept intentionally as an architectural layer — see _Architecture notes_.
- [ ] **🟢 Noted** — Placeholder-only directories `src/features/` and `src/utils/` contain a `README.md` and nothing else. Harmless scaffolding; remove if you don't intend to use them.
- [ ] **🟢 Noted** — `CLAUDE.md` is stale: it describes the app as "mock-data driven / Firebase not wired into any UI / admin UI-only," but the app is now fully wired to Firestore with checkout, orders, CMS, and auth. Worth refreshing so future contributors aren't misled.
- [ ] **🟢 Noted** — `next lint` is deprecated (removed in Next 16). Migrate to the ESLint CLI (`npx @next/codemod@canary next-lint-to-eslint-cli .`).

---

## Changes made in this pass (with rationale)

### 1. `.github/workflows/deploy.yml` — inject backend env at build time 🔴

**Why:** `NEXT_PUBLIC_*` variables are inlined into the bundle **at build time**. The workflow
only exported `NEXT_PUBLIC_BASE_PATH` and `NEXT_PUBLIC_SITE_URL`, so the deployed static export
contained no Firebase/Cloudinary config. `getFirebaseApp()` throws when config is missing, so
every storefront Firestore read, product page, and the admin would fail in production.

**What changed:** The `Build` step now passes all Firebase keys, both Cloudinary keys, and
`NEXT_PUBLIC_STORE_WHATSAPP` from `${{ secrets.* }}`. It also sets
`NEXT_PUBLIC_SITE_URL` to `origin` **only** (see #2).

**Action for you:** Add these as repository secrets (Settings → Secrets and variables →
Actions). These are not secret in the security sense — Firebase Web config is public by
design — but the workflow must have them to inline them:

```
NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, NEXT_PUBLIC_FIREBASE_PROJECT_ID,
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
NEXT_PUBLIC_FIREBASE_APP_ID, NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET,
NEXT_PUBLIC_STORE_WHATSAPP
```

### 2. Double base-path fix (`deploy.yml`) 🟠

**Why:** `absoluteUrl()` (`src/lib/seo.ts`) already prepends `env.basePath`. The workflow set
`NEXT_PUBLIC_SITE_URL = origin + base_path`, so `absoluteUrl` added the subpath a second time,
producing wrong canonical/OG/sitemap URLs (`https://user.github.io/bluebuy/bluebuy/...`).

**What changed:** `NEXT_PUBLIC_SITE_URL` is now `${{ steps.pages.outputs.origin }}` (origin
only). `.env.example` documents the same invariant: **origin only, no subpath**.

### 3. `src/app/sitemap.ts` (new) 🟠

Static-export `sitemap.xml`. Lists `/`, `/products/`, `/about/`, `/contact/`, and every active
product (`/product/<slug>/`) with `lastmod` from `createdAtMs`. Firestore access is wrapped in
try/catch so an unreachable backend degrades to static routes instead of failing the build
(mirrors `generateStaticParams`). `export const dynamic = 'force-static'` is required under
`output: 'export'`.

### 4. `src/app/robots.ts` (new), `public/robots.txt` (removed) 🟠

Generated `robots.txt` that allows the storefront, disallows `/admin/`, `/login/`, `/cart/`,
`/checkout/`, and links the sitemap via `absoluteUrl('/sitemap.xml')`. Removed the static
`public/robots.txt` it supersedes (a static file would have overridden the metadata route).

### 5. `serializeJsonLd()` + product page 🟠

`src/lib/seo.ts` gains `serializeJsonLd()`, which escapes `<`, `>`, `&` as unicode escapes so
JSON-LD embedded via `dangerouslySetInnerHTML` cannot break out of the `<script>` tag.
`src/app/product/[slug]/page.tsx` now uses it instead of raw `JSON.stringify`.

### 6. `firestore.indexes.json` (new) + `firebase.json` 🟠

Composite indexes for `products` covering `active|categoryId|brandId|featured` + `createdAt
DESC` — the combinations `ProductRepository.list()` produces. The live hot paths
(`listActive()`, orders `list()`) use single-field/auto indexes and need nothing. `firebase.json`
now references the file so `firebase deploy --only firestore:indexes` ships them.

### 7. `.env.example` — document `NEXT_PUBLIC_STORE_WHATSAPP` 🟠

Added a "Store contact" section explaining the digits-only international format and the
placeholder-fallback behavior, plus a note that `NEXT_PUBLIC_SITE_URL` is origin-only.

### 8. Dead code removal 🟢

- `src/lib/env.ts`: removed the unused `env.firebase` object (config is owned by
  `@/firebase/config`, which reads `process.env` directly and validates required keys).
- `src/constants/site.ts`: removed the unused, stale `SITE_CONFIG.url` (`env.siteUrl` is the
  real source).

**Verification:** `npx tsc --noEmit` ✅, `npm run lint` ✅ (no warnings), `npm run build` ✅
(full static export; `robots.txt` and `sitemap.xml` generated; product pages prerendered from
Firestore). Generated `out/robots.txt` and `out/sitemap.xml` inspected and correct.

---

## Requires manual action (infra / console — cannot be fixed in code)

### 🔴 Authentication & authorization hardening

The single most important item that code cannot fix alone.

**Current state:** `DEFAULT_ROLE = 'admin'` (`src/lib/auth/roles.ts`) and `firestore.rules`
gate every write on `isSignedIn()` (`request.auth != null`). Therefore **any** Firebase Auth
account is a full admin over products, categories, brands, reviews, all CMS collections, and
orders.

**Risk:** If the Email/Password provider allows self-registration, an attacker can create an
account and gain full write access. Even without self-signup, the "any signed-in user = admin"
model is fragile.

**Remediation (do all three):**

1. **Disable self-signup** in Firebase console → Authentication → Settings, or restrict the
   provider so only you can create admin accounts.
2. **Assign an explicit `admin` custom claim** to real admins via the Admin SDK / a Cloud
   Function: `admin.auth().setCustomUserClaims(uid, { role: 'admin' })`. The client already
   reads `claims.role` (`auth-context.tsx`), so this "just works" once claims exist.
3. **Tighten the rules and the default.** Change `DEFAULT_ROLE` to `'viewer'` (least
   privilege) and swap the rules' `isSignedIn()` writes for a claim check:

   ```
   function isAdmin() { return request.auth != null && request.auth.token.role == 'admin'; }
   ```

   Then use `isAdmin()` for all catalog/CMS/order writes. The rules file already documents this
   exact upgrade path in its header comment.

### 🟠 Order-creation rule is loosely validated (anonymous write)

`firestore.rules` allows anonymous `create` on `orders` (required — checkout runs unauthenticated
in a static export). The rule checks `status == 'pending'`, `total >= 0`, and `items.size() > 0`,
but does **not** validate item shape, per-line prices, or that `total` matches the items — a
crafted client could write a $0 order or arbitrary item fields.

**Remediation:** For a hardened setup, move order creation (and the stock decrement) behind a
Cloud Function that validates the cart server-side against real product prices, then set both
anonymous allowances to `if false`. This is already flagged as the intended path in
`firestore.rules` and `ORDER_MANAGEMENT.md`. Also consider **App Check** to reduce abuse of the
anonymous create/stock-decrement endpoints (rate limiting is not expressible in Firestore rules).

### 🟠 Cloudinary upload preset hardening

Uploads use an **unsigned** preset (`NEXT_PUBLIC_*`) — correct for a serverless static export,
but the preset settings _are_ the security boundary. In the Cloudinary dashboard, ensure the
preset: restricts allowed formats (jpg/png/webp), caps max file size, pins an upload folder, and
enables any available moderation/rate controls. Never place the Cloudinary API **secret** in the
app (there is no server to use it from). Asset **deletion** correctly throws today — implement it
behind a Cloud Function if you need cleanup (see `CLOUDINARY.md`).

### 🟢 Cloudinary delivery is already well-optimized

`optimizeImageUrl`/`thumbnailUrl`/`responsiveSrcSet` apply `f_auto,q_auto` and width transforms,
and `res.cloudinary.com` is CDN-cached with long TTLs — no action needed. One enhancement: the
storefront `ProductImage` renders a plain `<img>` with the raw URL; you could feed it
`responsiveSrcSet(publicId)` + `sizes` to serve width-appropriate images and further improve LCP.
(Left as-is to avoid changing rendering behavior during the audit.)

---

## Testing recommendations (none exist today)

No test tooling is installed. Prioritized by ROI for this codebase:

**Unit (highest value — pure logic, no infra):**

- `src/lib/cart/pricing.ts`, `src/lib/format.ts`, `src/lib/order/whatsapp.ts`,
  `src/lib/seo.ts` (esp. `absoluteUrl` composition + `serializeJsonLd` escaping),
  `src/lib/auth/roles.ts` (`hasRole`/`isRole`), all Zod schemas in `src/lib/validations/`.
- Suggested stack: **Vitest** (fast, ESM-native, matches the toolchain).

**Integration:**

- Repositories against the **Firebase Emulator** (`.env.example` already documents emulator
  vars): slug-uniqueness on create/update, validation rejection, order create + stock decrement.
- React Query hooks with a mocked repository layer (loading/error/retry paths).

**End-to-end (Playwright):**

- Storefront: browse → product detail → add to cart → checkout → WhatsApp handoff.
- Admin: login gate (`ProtectedRoute` states), product CRUD, CMS edits.
- Accessibility smoke: `@axe-core/playwright` on key pages (light + dark).

**CI:** add a `test` + `typecheck` + `lint` job to `deploy.yml` gating the build.

---

## Areas reviewed and found solid (no action)

- **Type safety:** strict TS, zero `any`/`as any`, discriminated `AppError`, typed env access.
- **Architecture:** clean repository → service → hook → component layering; UI never touches
  Firestore directly; validation enforced in repositories regardless of caller.
- **React performance:** `QueryClient` created once via `useState`; sensible `staleTime`/`gcTime`;
  retry policy skips non-retryable error codes; `refetchOnWindowFocus` off. Server (build-time)
  catalog read is memoized so the exporter hits Firestore once, not per page.
- **Next.js:** correct static-export discipline — `generateStaticParams` on all dynamic routes,
  `images.unoptimized`, `trailingSlash`, env-driven `basePath`; per-product `generateMetadata`
  with real OG/Twitter/canonical; JSON-LD in static HTML.
- **Accessibility:** icon buttons carry `aria-label`; `role="status"` on async states;
  `aria-hidden` on decorative icons; portal `Modal`/`Drawer` with focus trap, scroll lock, Esc;
  `suppressHydrationWarning` + `next-themes` for FOUC-free theming; design-token colors give
  dark mode (and contrast) for free.
- **Firebase:** singleton app init guarded against double-init; fail-loud config validation;
  every repository call normalized through `withAppError`.
- **Dependencies:** all runtime deps are used; no unused packages found. No stray `console.log`;
  one documented `TODO` (Cloudinary asset cleanup, correctly deferred to a backend).
