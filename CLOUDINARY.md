# Cloudinary

Media (image) upload and delivery for BlueBuy. This document covers setup and
how the integration works. **No upload UI exists yet** — this phase only
prepares a reusable, production-ready service under
[`src/services/cloudinary/`](src/services/cloudinary/).

## Why this design

BlueBuy ships as a **static export** (`output: 'export'`) with **no server
runtime**. There is no place to safely hold a Cloudinary API secret at runtime,
so uploads are done **directly from the browser using an _unsigned_ upload
preset**. The preset's server-side settings (allowed formats, folder, max size)
are the real security boundary — not the fact that the values are hidden.

Both env values are therefore `NEXT_PUBLIC_*` and are **not secret**.

## 1. Where to find your Cloud Name

1. Sign in at [cloudinary.com](https://cloudinary.com).
2. Open the **Dashboard** (Programmable Media).
3. Copy the **Cloud name** shown in the account details / API-environment panel.

This is the value for `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`.

## 2. Create an unsigned upload preset

1. Go to **Settings** (gear icon) → **Upload** → **Upload presets**.
2. Click **Add upload preset**.
3. Set **Signing Mode** to **Unsigned**. _(This is what lets the browser upload
   without an API secret.)_
4. Give it a name — this is your `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`.
5. Recommended preset settings (enforce your rules server-side, not just in the
   client):
   - **Folder** — e.g. `bluebuy` so uploads stay organised.
   - **Allowed formats** — `jpg, png, webp` (matches the client validation).
   - **Max file size** — `10 MB` (matches the client validation).
   - Optionally enable **Unique filename** / **Overwrite** as you prefer.
6. **Save.**

> The client validates format (jpg/jpeg/png/webp) and size (≤ 10 MB) for fast,
> friendly feedback, but the preset must enforce the same limits because client
> checks can be bypassed.

## 3. Environment variables

Copy `.env.example` → `.env.local` and fill in the two Cloudinary keys:

```bash
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your-unsigned-preset
```

Nothing is hardcoded — [`cloudinary.config.ts`](src/services/cloudinary/cloudinary.config.ts)
reads these at build/runtime. Check readiness with `isCloudinaryConfigured()`
or list missing keys with `getMissingCloudinaryKeys()`.

**Never** add the Cloudinary **API secret** to this project — there is no server
to use it from, and `NEXT_PUBLIC_*` values are shipped to the browser.

## 4. How uploads work

`uploadImage(file)` POSTs multipart form data (the file + `upload_preset`) to
`https://api.cloudinary.com/v1_1/<cloud-name>/image/upload`. On success it
resolves with a normalised result:

```ts
import { uploadImage, CloudinaryError } from '@/services/cloudinary';

try {
  const result = await uploadImage(file, { folder: 'products' });
  // result: { secure_url, public_id, width, height, format, bytes }
} catch (err) {
  if (err instanceof CloudinaryError) {
    // err.message is always safe to show to the user
    // err.code: 'not-configured' | 'validation' | 'network' | 'upload-failed'
  }
}
```

Validation runs before the network call; `validateImageFile(file)` is also
exported if you want to check a file (and show an inline error) before you have
a submit handler:

```ts
const check = validateImageFile(file);
if (!check.valid) showError(check.error);
```

## 5. Delivery URL helpers

Given a `public_id`, build optimized delivery URLs (all apply `f_auto,q_auto`
so the browser gets the best format + quality automatically):

```ts
import {
  optimizeImageUrl,
  thumbnailUrl,
  responsiveImageUrls,
  responsiveSrcSet,
} from '@/services/cloudinary';

optimizeImageUrl(id, { width: 800 }); // resized, auto format/quality
thumbnailUrl(id, { size: 200 }); // square, smart-cropped
responsiveImageUrls(id); // [{ url, width }, ...]
responsiveSrcSet(id); // "url 320w, url 640w, ..."
```

## 6. Deleting images (not implemented)

`deleteImage(publicId)` is a **placeholder** and throws by design. Deletion
requires a **signed** request using the API secret, which cannot live in the
browser. When needed, implement it behind a trusted backend (e.g. a Firebase
Cloud Function or a serverless endpoint) that holds the secret and calls
Cloudinary's destroy API, then have the client call _that_ endpoint.

## Files

| File                                                                     | Purpose                                                           |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| [`cloudinary.config.ts`](src/services/cloudinary/cloudinary.config.ts)   | Env-sourced config, endpoints, validation constraints             |
| [`cloudinary.service.ts`](src/services/cloudinary/cloudinary.service.ts) | `uploadImage`, validation, URL helpers, `deleteImage` placeholder |
| [`cloudinary.types.ts`](src/services/cloudinary/cloudinary.types.ts)     | Shared types                                                      |
| [`index.ts`](src/services/cloudinary/index.ts)                           | Barrel — import from `@/services/cloudinary`                      |
