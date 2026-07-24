# Product Management

How the BlueBuy admin creates, edits, and deletes products — connecting the
**admin UI**, **Cloudinary** (media), and **Firestore** (data) through a
repository layer. The storefront is intentionally **not** wired to Firestore yet;
only the admin is functional.

## Architecture at a glance

```
Admin UI (product-form, products-browser)
   │  validate (Zod) + collect files
   ▼
Cloudinary service  ──upload images──▶  Cloudinary (unsigned preset)
   │  returns { secure_url, public_id, width, height, format, bytes }
   ▼
ProductRepository   ──create/update/delete──▶  Firestore `products`
```

- **Components never touch Firestore or Cloudinary SDKs directly.** They call the
  Cloudinary service ([`src/services/cloudinary`](src/services/cloudinary)) and the
  [`ProductRepository`](src/repositories/product.repository.ts).
- **Upload logic lives in the Cloudinary service**; **Firestore logic lives in the
  repository**. The form only orchestrates.
- **Validation** uses the shared Zod schemas in
  [`src/lib/validations/product.schema.ts`](src/lib/validations/product.schema.ts).
  The repository re-validates on every write, so bad data can't reach the DB even
  if a caller forgets to.

## How publishing works

When **Publish** (or **Save draft**) is clicked in the product form
([`product-form.tsx`](src/components/admin/products/product-form.tsx)):

1. **Client validation** — required title, valid slug, non-negative price, and
   `salePrice ≤ price` are checked for instant inline feedback. Failures show
   field errors + an error toast and stop here.
2. **Duplicate-slug guard** — `ProductRepository.slugExists(slug, currentId)` runs
   before any upload work, so a clashing slug fails fast.
3. **Image upload** — every _new_ image is uploaded to Cloudinary via
   `uploadImage(file, { folder, onProgress })`. Progress is shown per-image
   (percentage + bar); **Publish is disabled while uploading**. Images added in a
   previous session (edit mode) are already uploaded and are reused as-is.
4. **Assemble the document** — the uploaded metadata
   (`secure_url → url`, `public_id`, `width`, `height`, `format`, `bytes`) is
   mapped to `ProductImage[]` (gallery), the first image becomes the `thumbnail`,
   and the form fields are mapped to the Firestore shape (see
   [`product-mappers.ts`](src/components/admin/products/product-mappers.ts)).
5. **Persist** — `ProductRepository.create(payload)` (or `update(id, payload)` in
   edit mode) writes to Firestore with server timestamps.
6. **Feedback** — a success toast is shown and the user is redirected to the
   product list. Any failure (validation, upload, network, permissions) is
   normalised to a friendly message and shown as an error toast.

### Product fields

`title`, `slug`, `shortDescription`, `description`, `price`, `salePrice`,
`categoryId`, `brandId`, `stock`, `featured`, `active`, `tags`,
`specifications`, `seoTitle`, `seoDescription`, `metaKeywords`, `thumbnail`,
`gallery`, `createdAt`, `updatedAt` — see the `Product` interface in
[`src/types/models.ts`](src/types/models.ts). `rating`/`reviewCount`/`currency`
are managed by the schema defaults and are never overwritten by an edit.

## Editing

The edit route ([`/admin/products/[id]`](src/app/admin/products/[id]/page.tsx))
renders a client loader
([`edit-product-client.tsx`](src/components/admin/products/edit-product-client.tsx))
that fetches the live document with `ProductRepository.getById(id)`, shows a
loading state, then hydrates the form. Every field is editable. Existing images
are preserved unless removed; newly added images are uploaded on save. Saving
calls `ProductRepository.update`.

> **Static-export note:** `generateStaticParams` pre-renders edit pages for the
> _seeded_ product ids only. A product created at runtime gets a new Firestore id
> that isn't in that list, so a **hard reload** of its edit URL isn't statically
> generated (in-app client navigation still works). This is inherent to
> `output: 'export'`; wiring a real backend or moving off static export removes it.

## Deleting

The list ([`products-browser.tsx`](src/components/admin/products/products-browser.tsx))
confirms via a dialog, then calls `ProductRepository.remove(id)`, which deletes
the **Firestore document only**.

### Why Cloudinary deletion is deferred

Deleting the product record does **not** delete its Cloudinary images. Secure
asset deletion requires a **signed** Cloudinary Admin API call using the account
**API secret**. That secret:

- must **never** ship to the browser, and
- has **no server to live on** here — BlueBuy is a static export with no runtime.

So an unsigned, client-side delete is impossible to do safely. The intended path
(left as a `TODO(cloudinary-cleanup)` in
[`product.repository.ts`](src/repositories/product.repository.ts)) is a trusted
backend — e.g. a **Firebase Cloud Function** — that holds the secret, reads each
image's stored `public_id`, and calls Cloudinary's `destroy` API. Until then,
deleted products may leave **orphaned assets** in Cloudinary; this is an accepted,
documented trade-off. The `public_id` is persisted on every image precisely so
this cleanup can be implemented later without a data migration.

## How Cloudinary and Firestore work together

- **Cloudinary owns the bytes.** Images upload straight from the browser to
  Cloudinary; Firestore never stores image data, only the returned **metadata**.
- **Firestore owns the record.** Each `ProductImage` keeps `url` (the delivery
  URL), `publicId`, dimensions, `format`, and `bytes`. The gallery, thumbnail,
  and all product fields live in the `products` document.
- **Ordering & thumbnail** are derived from gallery order: index 0 is the primary
  image and its `url` is copied to `thumbnail` for fast list/card rendering.

## Configuration required to run

Two environment/config items are needed for a successful end-to-end save (both
are outside the code):

1. **Cloudinary unsigned preset** — set `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` and
   `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` in `.env.local`. See
   [`CLOUDINARY.md`](CLOUDINARY.md) for creating the preset.
2. **Firestore security rules** — the signed-in admin must be allowed to
   read/write the `products` collection. With default locked-down rules, the
   admin list shows _"You do not have permission to perform this action."_ (the
   repository surfaces this gracefully with a Retry). Grant access with a rule
   such as:

   ```
   match /products/{id} {
     allow read: if true;                       // or restrict as needed
     allow write: if request.auth != null
               && request.auth.token.role == 'admin';
   }
   ```

   (Roles come from custom claims — see [`AUTHENTICATION.md`](AUTHENTICATION.md).)

## Key files

| File                                                                                                         | Responsibility                                           |
| ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| [`repositories/product.repository.ts`](src/repositories/product.repository.ts)                               | All Firestore reads/writes; slug uniqueness; validation  |
| [`services/cloudinary/`](src/services/cloudinary)                                                            | Uploads (with progress), URL helpers, delete placeholder |
| [`components/admin/products/product-form.tsx`](src/components/admin/products/product-form.tsx)               | Create/edit form; orchestrates upload → save             |
| [`components/admin/ui/image-uploader.tsx`](src/components/admin/ui/image-uploader.tsx)                       | Drag & drop, previews, thumbnail selection, progress     |
| [`components/admin/products/product-mappers.ts`](src/components/admin/products/product-mappers.ts)           | Form ⇄ Firestore mapping + client validation             |
| [`components/admin/products/edit-product-client.tsx`](src/components/admin/products/edit-product-client.tsx) | Loads a product for editing                              |
| [`components/admin/products/products-browser.tsx`](src/components/admin/products/products-browser.tsx)       | Lists (from Firestore) + delete                          |
| [`components/ui/toast.tsx`](src/components/ui/toast.tsx)                                                     | Toast provider used for success/error feedback           |
