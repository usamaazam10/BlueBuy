# CMS — Content Management

BlueBuy's marketing content (hero, navigation, footer, banners, contact details,
store branding, SEO) is **managed from the admin and stored in Firestore** — no
code change is needed to edit it. This document explains the architecture, the
collections, how the storefront consumes them, and **how to add a new CMS
section later**.

> **Design constraint.** The public UI was not redesigned. Every CMS read falls
> back to a built-in default derived from the content that used to be hard-coded,
> so an un-seeded database renders a pixel-identical site.

## Architecture at a glance

Everything follows the repo's existing layering — components never touch
Firestore directly; reads flow through repositories and React Query.

```
Admin editor (client)                     Storefront (client)
   │  repository.save()                      │  useQuery(hook)
   ▼                                         ▼
CMS repository  ───────────────────────▶  CMS repository
(src/repositories/cms.repository.ts)      • get() merges stored doc over defaults
• validate (zod)  • write                 • listActive() sorts by sortOrder
   │                                         │
   ▼                                         ▼
                    Firestore (7 CMS collections)
```

| Layer            | File                                                                       | Responsibility                                              |
| ---------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Types+defaults   | [`src/types/cms.ts`](src/types/cms.ts)                                     | Models and `DEFAULT_*` fallbacks for every collection       |
| Validation       | [`src/lib/validations/cms.schema.ts`](src/lib/validations/cms.schema.ts)   | Zod schemas (create/update/singleton) + inferred types      |
| Repository       | [`src/repositories/cms.repository.ts`](src/repositories/cms.repository.ts) | Firestore reads/writes via singleton + collection factories |
| Storefront hooks | [`src/hooks/queries/use-cms.ts`](src/hooks/queries/use-cms.ts)             | React Query hooks that always resolve to renderable content |
| Admin infra      | [`src/components/admin/cms/`](src/components/admin/cms/)                   | Reusable editing controller, form shell, list editors       |
| Admin pages      | [`src/app/admin/cms/`](src/app/admin/cms/) + `admin/settings`              | One page per CMS section                                    |
| Security rules   | [`firestore.rules`](firestore.rules)                                       | Public read, admin write for all CMS collections            |

## Collections

Two storage shapes, both produced by factories in the repository so every
collection behaves identically.

**Singletons** — exactly one document per collection, id `main`. Read merges the
stored doc over the model default (so a missing field always resolves), write
persists the whole validated object.

| Collection            | Model                | Editor page           |
| --------------------- | -------------------- | --------------------- |
| `site_settings`       | `SiteSettings`       | `/admin/settings`     |
| `homepage`            | `Homepage`           | `/admin/cms/homepage` |
| `footer`              | `Footer`             | `/admin/cms/footer`   |
| `contact_information` | `ContactInformation` | `/admin/cms/contact`  |

**Item collections** — many ordered documents with full CRUD (sorted client-side
by `sortOrder` to stay on Firestore's automatic single-field index).

| Collection     | Model        | Editor page             | Storefront surface                 |
| -------------- | ------------ | ----------------------- | ---------------------------------- |
| `navigation`   | `NavItem`    | `/admin/cms/navigation` | Header + mobile menu               |
| `banners`      | `Banner`     | `/admin/cms/banners`    | Dismissible announcement bar (top) |
| `social_links` | `SocialLink` | `/admin/cms/social`     | Footer social icons                |

### What each field drives

- **Homepage** → hero (title, subtitle, eyebrow, primary/secondary CTA, background
  image), curated `featuredCategoryIds` / `featuredProductIds` (empty = auto),
  promotional banner (the CTA band), newsletter block, and SEO overrides.
- **Site settings** → store name + logo (wordmark or image), favicon, primary /
  secondary colour (injected as the `--brand` / `--brand-accent` CSS variables
  site-wide), support email/phone, address, currency, timezone. The currency is
  the ISO code every price on the site is formatted in — components read it via
  `useCurrency()` ([`src/hooks/use-currency.ts`](src/hooks/use-currency.ts)), and
  `SiteSettingsRuntime` mirrors it into [`src/lib/format.ts`](src/lib/format.ts)
  for the few non-React callers. Placed orders keep the currency they were
  bought in, so past orders never re-price.
- **Footer** → tagline, link columns (Company / Support / Legal — fully editable),
  copyright (`{year}` is substituted at render).
- **Contact** → the contact page heading + methods, also reusable in the footer.

## How the storefront stays un-seeded-safe

Every storefront hook resolves to a value **immediately**:

- Singleton hooks return `query.data ?? DEFAULT_*`, so loading _and_ error states
  render the defaults (see [`use-cms.ts`](src/hooks/queries/use-cms.ts)).
- List hooks (`useNavigationItems`, `useSocialLinksList`) fall back to seed items
  when the collection is empty or still loading. `useActiveBanners` has no
  fallback — no banner means no announcement bar.

Because the app is a **static export** (`output: 'export'`, no server runtime),
all CMS reads happen on the client. The baked HTML ships the defaults; Firestore
values apply on hydration. Homepage SEO is refined client-side by
[`HomepageSeo`](src/components/sections/homepage-seo.tsx) and brand colour /
favicon by [`SiteSettingsRuntime`](src/components/layout/site-settings-runtime.tsx),
since `generateMetadata` cannot read Firestore at build time.

## Admin editing model

Singleton editors share one controller,
[`useCmsSingleton`](src/components/admin/cms/use-cms-singleton.ts): it loads the
document into a draft, tracks unsaved changes against the last-saved baseline,
and on save validates + persists, then invalidates the storefront query so public
pages reflect the change. Paired with
[`CmsFormShell`](src/components/admin/cms/cms-form-shell.tsx) (loading / error /
sticky save-bar) and [`RepeatableList`](src/components/admin/cms/repeatable-list.tsx)
(add / remove / reorder embedded arrays).

Item collections share [`CmsCollectionManager`](src/components/admin/cms/cms-collection-manager.tsx):
list + create/edit modal + active toggle + reorder + delete + optional "load
defaults", all with cache invalidation. Each page supplies only its
entity-specific form and row summary.

> **Autosave / versioning.** Saves are explicit (a sticky "Save changes" bar),
> which keeps the surface predictable. The architecture is version-friendly:
> every write stamps `updatedAt` (and preserves `createdAt`), and each singleton
> is a single document — snapshotting a revision is a copy of one doc. To add
> autosave, debounce `onSave` in `useCmsSingleton`; to add history, write a copy
> to a `{collection}_versions` subcollection inside the repository's `save()`.

## Adding a new CMS section later

Say you want an editable **"Why choose us"** feature list. Two shapes to choose
from — a **singleton** (one editable block) or an **item collection** (a list of
managed rows). Steps for each:

### A singleton block

1. **Type + default** — add the interface and a `DEFAULT_*` constant to
   [`src/types/cms.ts`](src/types/cms.ts).
2. **Collection name** — add it to `COLLECTIONS` in
   [`src/types/models.ts`](src/types/models.ts).
3. **Schema** — add a Zod object to
   [`src/lib/validations/cms.schema.ts`](src/lib/validations/cms.schema.ts).
4. **Repository** — one line:
   `export const FeaturesRepository = createSingletonRepository(COLLECTIONS.features, featuresSchema, DEFAULT_FEATURES)`
   and re-export it from [`src/repositories/index.ts`](src/repositories/index.ts).
5. **Query key + hook** — add a key in
   [`keys.ts`](src/hooks/queries/keys.ts) and a `useFeatures()` hook (return
   `query.data ?? DEFAULT_FEATURES`) in
   [`use-cms.ts`](src/hooks/queries/use-cms.ts).
6. **Storefront** — read it in the component (`const { data } = useFeatures()`).
7. **Admin editor** — a page under `src/app/admin/cms/…` rendering an editor built
   on `useCmsSingleton` + `CmsFormShell` (copy `contact-editor.tsx`).
8. **Nav + rules** — add a `Content` entry in
   [`src/data/admin/nav.ts`](src/data/admin/nav.ts) and a `match /features/{d}`
   block (public read, `isSignedIn()` write) in
   [`firestore.rules`](firestore.rules); redeploy the rules.

### An item collection

Same as above, but use `createCollectionRepository(name, createSchema, updateSchema)`
(items need `sortOrder` + `active`), expose `list`/`listActive` hooks, and build
the admin page with `CmsCollectionManager` (copy `navigation-manager.tsx`) — you
only write `renderForm` and `renderSummary`.

## Deploying the security rules

The CMS collections are covered by [`firestore.rules`](firestore.rules) (public
read, admin write). After changing that file, deploy it:

```bash
firebase deploy --only firestore:rules
```

Until deployed, admin reads/writes to a **new** collection return
`permission-denied` ("You do not have permission…") while the storefront still
renders defaults.
