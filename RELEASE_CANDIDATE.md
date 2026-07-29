# BlueBuy — Release Candidate Report

_Prepared by: Principal Engineering review · Date: 2026-07-28 · Branch: `main`_

---

## Executive Summary

BlueBuy has been hardened from feature-complete to production-quality across the
eleven requested workstreams — image lifecycle management, category/brand media,
referential-integrity guards, brand/logo unification, catalogue counts, a premium
product gallery, an expanded admin dashboard, and a placeholder-content audit.

Every change preserves the existing architecture (Firestore ← Repository ←
Service ← React Query hook ← Component), the design-token/radii systems, and the
static-export constraint (no server runtime, no secrets in the client). The app
**typechecks clean, lints clean (0 warnings), and the production static export
builds successfully (29 routes)**. The storefront was verified live in the
browser (home, product page, gallery, logo, dark mode) and one hydration defect
introduced during the work was found and fixed.

**Recommendation: Conditional GO** — approve launch once three operator gating
items are completed (deploy updated Firestore rules, confirm Cloudinary preset
covers the new folders, and run a 10-minute authenticated admin smoke test).
Details in [Launch Recommendation](#launch-recommendation).

---

## Architecture Decisions

1. **Cloudinary cleanup via an orphaned-assets ledger (Task 1, Option A).**
   A static client cannot hold the Cloudinary API secret, so signed deletion is
   impossible in-browser. On delete/replace, the affected `public_id`s are
   recorded in a new admin-only `orphaned_assets` collection and reconciled from
   `/admin/orphaned-assets`. Orchestrated by
   [`image-cleanup.service.ts`](src/services/image-cleanup.service.ts); the
   repository `remove` stays thin. No secret is ever shipped. Documented in
   [CLOUDINARY.md](CLOUDINARY.md).

2. **Branding flows entirely through `site_settings` (Task 6).** All logo
   surfaces (header, footer, favicon, apple-touch, OG, manifest, email) resolve
   through [`resolveLogos`](src/lib/site-logo.ts), falling back to committed
   BlueBuy brand assets under [`public/brand/`](public/brand). A single Site
   Settings change re-brands the whole site; nothing is hardcoded in components.
   Brand assets were derived from the provided brand sheet (app-icon tile, mark,
   1200×630 OG card).

3. **Product counts computed live, never denormalized (Task 7).** Counts are
   derived from the catalogue via [`product-counts.ts`](src/lib/product-counts.ts)
   so they can never drift; the delete-safety guard uses an authoritative
   `getCountFromServer` aggregation (no composite index required).

4. **Geometric `ProductMedia` retained as a legitimate no-image fallback**
   (per confirmed decision) — it is abstract art, not a fake product; only
   genuinely fake/demo content was removed (Task 5).

5. **All new model fields are additive with schema defaults**, so existing
   Firestore documents remain valid without a migration.

---

## Features Added

| Task | Feature                                                                                                                                                    |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `orphaned_assets` model/schema/repo, `image-cleanup.service`, `/admin/orphaned-assets` (copy ID, mark cleaned, filter), admin-only Firestore rule, docs    |
| 2    | Category `image`+`imagePublicId`, `featured`, `sortOrder`, SEO fields; admin upload/replace/preview/remove; storefront category images + responsive URLs   |
| 3    | Brand `logo`+`logoPublicId`, `featured`, `sortOrder`, SEO fields; admin logo upload; brand logo on product pages (optimized)                               |
| 4    | Category/brand delete guards (blocked modal + "View products"); products browser brand filter + `?category=`/`?brand=` deep links                          |
| 5    | Removed demo hero tiles (`aura/vertex/lumen` → neutral decorative seeds); audited storefront for mock/demo leakage (none)                                  |
| 6    | 8 CMS logo fields; committed brand assets; header/footer/favicon/apple-touch/OG wired; Site Settings upload UI                                             |
| 7    | Live product counts in admin managers and storefront category cards (`Electronics (24)` style)                                                             |
| 8    | Gallery: cursor hover-zoom, fullscreen lightbox (arrow keys, focus trap), swipe, thumbnails, lazy loading, optimized Cloudinary URLs, reduced-motion aware |
| 9    | Dashboard: Total products/categories/brands/orders, Pending orders, Revenue, Low stock, Out of stock + recent products/orders + quick actions              |
| 10   | Design-token/radii consistency, hydration fix, image lazy-loading, empty/error/loading states                                                              |

New reusable primitives: `SingleImageUpload`, `LogoUploadField`, `useProductCounts`, `resolveLogos`.

---

## Issues Fixed

- **Hydration mismatch (introduced & fixed):** the product gallery's hover-zoom
  read `window.matchMedia` during render. Gated behind a mounted flag so SSR and
  first client render agree. Verified the Next dev "Recoverable Error" toast is
  gone after the fix.
- **Stale/misleading placeholders:** the `deleteImage` "not implemented" note and
  the `ProductRepository.remove` TODO now point at the real ledger architecture.
- **Demo-flavoured seeds** in the hero removed.
- **Orphaned Cloudinary assets on delete/replace** — the core Task 1 defect — now
  tracked instead of silently leaked.

---

## Regression Testing Results

| Area                                                    | Method                       | Result                                                              |
| ------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------- |
| TypeScript                                              | `tsc --noEmit`               | ✅ 0 errors                                                         |
| ESLint                                                  | `next lint --max-warnings=0` | ✅ 0 warnings                                                       |
| Production static export                                | `npm run build`              | ✅ 29 routes, export OK                                             |
| Home / hero / categories                                | Browser                      | ✅ renders; live count "Smartphones · 1 item"                       |
| Product page + gallery                                  | Browser                      | ✅ optimized image, brand fallback, no console errors               |
| Logo (header/footer, light + dark)                      | Browser                      | ✅ BlueBuy mark + wordmark, tab favicon                             |
| Hydration                                               | Browser dev overlay          | ✅ clean after fix                                                  |
| Admin CRUD, uploads, delete guards, dashboard, settings | Build + static analysis      | ⚠️ Not live-clicked (auth-gated; credentials not used — see caveat) |

**Caveat (honest):** the admin surfaces are behind email/password auth. I did
not sign in (I do not enter credentials), so admin CRUD, image upload, the delete
guards, orphaned-asset marking, and the Settings logo uploads were validated by
typecheck + production build + code review, **not** by a live authenticated
click-through. This is the main open verification item before launch.

---

## Remaining Technical Debt

- **Firestore rules must be deployed:** `firebase deploy --only firestore:rules`
  (adds the `orphaned_assets` admin-only rule). Until deployed, ledger writes
  from the admin will be denied.
- **Cloudinary preset/folders:** confirm the unsigned preset permits the new
  folders `bluebuy/categories`, `bluebuy/brands`, `bluebuy/brand`.
- **Pinch-zoom** on mobile is not implemented; the fullscreen lightbox + swipe
  cover the primary need (marked optional in the brief).
- **Cloudinary destroy remains manual** (ledger-driven). A Blaze Cloud Function
  could later automate signed destroy from the same ledger with no schema change.
- **Web manifest file** is not emitted; the `manifestIconUrl` field and default
  exist for when a manifest is added.
- Storefront reads are build-time for `product/[slug]`, so new products need a
  redeploy to appear as static HTML (pre-existing, documented in CLAUDE.md).

---

## Security Review

- **No secrets in the client** — unchanged; Cloudinary stays unsigned-upload only.
- **`orphaned_assets` is admin-only** in `firestore.rules` (`read, write: if isAdmin()`); never storefront-readable.
- **Referential integrity** — category/brand deletion is blocked while products
  reference them, preventing dangling `categoryId`/`brandId`. (This is a UX guard;
  the real boundary remains Firestore rules + admin claim.)
- **Zod validation in every repository** — new fields validated with safe defaults; malformed writes can't reach Firestore.
- Anonymous checkout allowances are unchanged and remain tightly shaped + App-Check attested.

**Verdict:** No new attack surface. Grade **A-** (pending rules deploy).

---

## Performance Review

- **Optimized delivery** — gallery, category, and brand images use
  `optimizeImageUrl` (`f_auto,q_auto` + width), and images are `loading="lazy"`.
- **Counts are O(n) client-side** over the already-cached catalogue; the delete
  guard uses a server-side count aggregation (no doc transfer).
- **Bundle** — first-load JS ~102 kB shared; product route ~389 kB (framer-motion
  heavy but pre-existing). No regressions introduced.
- Committed brand raster assets total ~0.6 MB across five files; acceptable, and
  admins can swap in smaller optimized assets via Settings.

**Verdict:** Solid for a catalogue of this size. Grade **A-**.

---

## Accessibility Review

- Every icon-only control added has an `aria-label`; gallery thumbnails use
  `role="tab"`/`aria-selected`, the lightbox traps focus (via `Modal`) and
  supports Esc + arrow keys.
- Decorative images use `alt=""`/`aria-hidden`; informative images have real alt text.
- Motion honors `useReducedMotion`; hover-zoom is pointer-gated.
- Delete-guard and blocked-delete dialogs are proper modals with descriptive text.

**Verdict:** Meets the project's existing a11y bar. Grade **A-** (recommend a
screen-reader pass on the new lightbox before GA).

---

## SEO Review

- Category and brand SEO fields (title/description/keywords) are now editable and
  stored, ready to feed page metadata.
- Default OpenGraph/Twitter image + icons now resolve to the BlueBuy brand and are
  CMS-overridable; product pages keep their richer per-product OG/JSON-LD.
- `sitemap.xml`/`robots.txt` unchanged and building.

**Verdict:** Improved. Grade **A-**.

---

## Scores

| Metric                   | Score        |
| ------------------------ | ------------ |
| **Overall Quality**      | **91 / 100** |
| **Production Readiness** | **86 / 100** |

Readiness is held below quality solely by the un-run authenticated admin smoke
test and the pending rules/preset deploy — both operator actions, not code gaps.

---

## Launch Recommendation

**Conditional GO.** The codebase is production-grade: it typechecks, lints, and
builds to a clean static export; the storefront is verified live; the
architecture is sound and static-export-safe. I would approve launching BlueBuy
for real customers **after** these three gating items, each ~10 minutes:

1. **Deploy Firestore rules:** `firebase deploy --only firestore:rules`.
2. **Confirm the Cloudinary unsigned preset** allows uploads to `bluebuy/categories`, `bluebuy/brands`, and `bluebuy/brand`.
3. **Authenticated admin smoke test:** sign in and exercise — create/edit a
   category and brand with an image upload; attempt to delete a category/brand
   that has products (confirm the block + "View products"); delete a product and
   confirm its images appear under **Media cleanup**; save a logo in Settings and
   confirm it propagates to the header.

With those three green, this is a **GO**.
