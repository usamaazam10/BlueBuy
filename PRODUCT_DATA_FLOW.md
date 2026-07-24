# Storefront data flow — Firestore → Repository → React Query → UI

This document explains how the **public storefront** gets its data now that the
mock arrays have been replaced with **live Firestore**. It covers the flow, the
build-time SEO model, the design trade-offs, and how to add new queries.

> Scope: this is the storefront only. The **admin panel**, **authentication**,
> and **Cloudinary** are unchanged. The mock files (`src/data/products.ts`,
> `src/data/categories.ts`) are **kept** — the admin layer (`src/data/admin/*`)
> derives from them — but the storefront no longer imports them. Verify with:
>
> ```bash
> grep -rn "@/data/products\|@/data/categories" src | grep -v "src/data/admin"
> # → no results
> ```

## The pipeline

```
Firestore
  └─ Repository            src/repositories/*        (the ONLY Firestore access)
       └─ React Query hook src/hooks/queries/*       (cache, retry, loading/error)
            └─ Mapper      src/lib/mappers/store.ts  (Firestore model → view model)
                 └─ UI     components consume StoreProduct / StoreCategory / StoreBrand
```

### 1. Repository — the only place that talks to Firestore

`src/repositories/` is the single gateway to Firestore. **Components never import
`firebase/firestore` or call `getDb()` directly.** Each repository normalises
errors to `AppError` (see `src/firebase/errors.ts`).

- `ProductRepository.listActive()` — active products for the storefront.
- `CategoryRepository.listActive()` / `BrandRepository.listActive()`.
- `ProductRepository.getBySlug(slug)` — single product.

**Why `listActive()` and not `list()`:** storefront reads apply a single
`where('active','==',true)` with **no `orderBy`**. That keeps the query on
Firestore's automatic single-field index (no composite index to deploy) and
respects security rules that only expose active documents. Sorting, filtering,
search, "featured" and "related" are all derived **client-side** from this one
cached list — cheap and instant for a catalogue of this size. (`ProductRepository.list()`
still exists with its `orderBy('createdAt')` for the admin, which is unchanged.)

### 2. React Query — caching, retry, loading & error state

`src/components/providers/query-provider.tsx` wraps the app (in the root layout).
Defaults: `staleTime` 60s, `gcTime` 5m, `refetchOnWindowFocus` off, and a `retry`
policy that backs off twice **but never retries permanent errors** (a
`permission-denied` read won't be retried).

`src/hooks/queries/`:

| Hook                                                         | Returns                                                                                      |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `useProductsQuery` / `useCategoriesQuery` / `useBrandsQuery` | raw Firestore docs                                                                           |
| `useStoreCategories` / `useStoreBrands`                      | mapped view models                                                                           |
| `useStoreProducts`                                           | **the catalogue** — mapped `StoreProduct[]`, plus `isLoading`, `isError`, `error`, `refetch` |

`useStoreProducts` is the storefront's single source of truth: it composes the
three queries and maps them to `StoreProduct[]`. Featured, search, filters and
related products are all `useMemo` derivations of this one cached list.

**Resilience:** products are the required collection; categories/brands only
enrich display names. If the categories/brands reads fail (e.g. locked-down
security rules), `useStoreProducts` still succeeds — names fall back to a
humanised id (`cat-audio` → "Audio") and the brand/category **filters** simply
show no options. Only a **products** failure surfaces the error state.

### 3. Mapper — Firestore model → view model

`src/lib/mappers/store.ts` is the only translation layer. Firestore speaks ids,
Cloudinary metadata and timestamps (`@/types/models`); the UI wants a resolved
category/brand name, a single current price and ready-to-render images
(`@/types/store`). `toStoreProduct` handles: `price = salePrice ?? price`
(+ `compareAtPrice`), category/brand name resolution, gallery → images,
tags → highlights, a derived `badge` and `accent`, and `createdAtMs` for sorting.

### 4. UI states

- **Loading:** `ProductCardSkeleton` / `ProductGridSkeleton`.
- **Error:** `src/components/common/error-state.tsx` — friendly, with a `Try again`
  button wired to `refetch`. Never shows raw error text.
- **Empty:** `src/components/common/empty-state.tsx` — for a successful-but-empty
  result (no products, no search matches).
- **Images:** `src/components/product/product-image.tsx` renders a lazily-loaded
  (`loading="lazy"`) real Cloudinary `<img>` when one exists, and falls back to the
  deterministic `ProductMedia` SVG art otherwise. `ProductCard` is `React.memo`.

## Product detail page & SEO (build-time)

The app is a **static export** (`output: 'export'`), so per-request rendering
isn't available. The product page therefore reads Firestore **at build time** to
produce one pre-rendered HTML page per product with full, per-product SEO:

- `src/app/product/[slug]/page.tsx` (server): `generateStaticParams` enumerates
  slugs from Firestore; `generateMetadata` builds title / description / Open Graph
  / Twitter card / canonical (`src/lib/seo.ts`); the page emits a schema.org
  **Product JSON-LD** `<script>` into the static HTML; a missing slug →
  `notFound()` (the custom `src/app/not-found.tsx`).
- `src/lib/server/catalog.ts` memoises one catalogue read for the whole build.
- `src/components/product/product-detail.tsx` (client) renders from the build-time
  `initial*` props (instant, crawlable) then swaps to live React Query data so
  price/stock stay fresh without a rebuild.

Build-time reads are wrapped in try/catch: an unreachable/unconfigured Firestore
degrades to "no product pages" instead of failing the whole build.

## How to add a new query later

1. **Add a repository method** (never query Firestore from a component):

   ```ts
   // src/repositories/product.repository.ts
   async listOnSale(): Promise<Product[]> {
     return withAppError(
       async () =>
         (await getDocs(query(productsCollection(), where('salePrice', '>', 0)))).docs.map(
           fromSnapshot
         ),
       'list on-sale products'
     );
   }
   ```

2. **Add a query hook** (key + queryFn), mapping to a view model if needed:

   ```ts
   // src/hooks/queries/use-on-sale.ts
   export function useOnSaleQuery() {
     return useQuery({
       queryKey: ['products', 'on-sale'],
       queryFn: () => ProductRepository.listOnSale(),
     });
   }
   ```

   Add its key to `src/hooks/queries/keys.ts` and export it from
   `src/hooks/queries/index.ts`.

3. **Consume it** in a client component with loading/error/empty states, reusing
   `ProductGridSkeleton`, `ErrorState` and `EmptyState`.

For most needs you don't need a new query at all — derive from the cached
`useStoreProducts()` catalogue with a `useMemo`.

## Prerequisite: Firestore security rules

Storefront reads require **public read access to the active documents** in each
collection. Today `products` is readable, but `categories` and `brands` are
**denied** — so the category/brand **filters** and resolved names don't populate
(the storefront degrades gracefully as described above). To enable them, grant
public read on those collections (mirroring `products`), e.g.:

```
match /categories/{id} { allow read: if resource.data.active == true; }
match /brands/{id}     { allow read: if resource.data.active == true; }
```

Rules live in the Firebase console (not in this repo); no code change is needed
once they allow the reads.
