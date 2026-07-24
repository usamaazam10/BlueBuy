/**
 * Cloudinary service — reusable, framework-agnostic media layer.
 *
 * Responsibilities:
 *  - `uploadImage` — unsigned browser upload of a validated image file.
 *  - `validateImageFile` — friendly, client-side format/size checks.
 *  - URL builders — optimize / thumbnail / responsive delivery transformations.
 *  - `deleteImage` — intentional placeholder (see note below).
 *
 * Why unsigned uploads: the app is a static export with no server runtime, so
 * there is no API secret to sign requests with. Uploads therefore go directly
 * to Cloudinary using an unsigned upload preset (`NEXT_PUBLIC_*`). The preset's
 * dashboard settings are the real security boundary.
 *
 * No upload UI is implemented in this phase — this module only provides the
 * architecture that a future uploader component will call into.
 */
import {
  ACCEPTED_MIME_TYPES,
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_DELIVERY_BASE,
  CLOUDINARY_UPLOAD_PRESET,
  CLOUDINARY_UPLOAD_URL,
  MAX_FILE_SIZE_BYTES,
  isCloudinaryConfigured,
} from './cloudinary.config';
import type {
  CloudinaryUploadResult,
  OptimizeOptions,
  ResponsiveImage,
  ResponsiveOptions,
  ThumbnailOptions,
  UploadImageOptions,
  ValidationResult,
} from './cloudinary.types';

/**
 * Error thrown by {@link uploadImage}. Its `message` is always safe to show to
 * a user; `code` lets callers branch programmatically.
 */
export class CloudinaryError extends Error {
  readonly code: 'not-configured' | 'validation' | 'network' | 'upload-failed';

  constructor(code: CloudinaryError['code'], message: string) {
    super(message);
    this.name = 'CloudinaryError';
    this.code = code;
  }
}

/** Default responsive breakpoints (px), covering mobile → large desktop. */
const DEFAULT_RESPONSIVE_WIDTHS = [320, 640, 768, 1024, 1280, 1536] as const;

// --- Validation ---------------------------------------------------------------

/** Human-readable size, e.g. `"10 MB"`. */
function formatMb(bytes: number): string {
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
}

/**
 * Validate a file's type and size before upload. Returns a friendly error
 * message rather than throwing, so UIs can display it inline.
 */
export function validateImageFile(file: File): ValidationResult {
  if (!file) {
    return { valid: false, error: 'Please choose an image to upload.' };
  }

  if (!ACCEPTED_MIME_TYPES.includes(file.type as (typeof ACCEPTED_MIME_TYPES)[number])) {
    return {
      valid: false,
      error: 'Unsupported format. Please upload a JPG, PNG, or WebP image.',
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `That image is ${formatMb(file.size)}. Please upload a file under ${formatMb(
        MAX_FILE_SIZE_BYTES
      )}.`,
    };
  }

  return { valid: true };
}

// --- Upload -------------------------------------------------------------------

/**
 * Upload a single image to Cloudinary via the unsigned preset.
 *
 * Validates the file first (format + size), then POSTs multipart form data to
 * the upload endpoint. Uses `XMLHttpRequest` (not `fetch`) so real upload
 * progress can be reported via `options.onProgress`. Resolves with the
 * normalised {@link CloudinaryUploadResult}.
 *
 * @throws {CloudinaryError} with a user-safe `message` on any failure —
 *   missing config, validation, network, abort, or a non-2xx response.
 */
export function uploadImage(
  file: File,
  options: UploadImageOptions = {}
): Promise<CloudinaryUploadResult> {
  if (!isCloudinaryConfigured()) {
    return Promise.reject(
      new CloudinaryError(
        'not-configured',
        'Image uploads are not configured yet. Please try again later.'
      )
    );
  }

  const validation = validateImageFile(file);
  if (!validation.valid) {
    return Promise.reject(new CloudinaryError('validation', validation.error));
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  if (options.folder) formData.append('folder', options.folder);
  if (options.tags?.length) formData.append('tags', options.tags.join(','));

  return new Promise<CloudinaryUploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', CLOUDINARY_UPLOAD_URL, true);

    // Progress events → integer percentage.
    if (options.onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          options.onProgress?.(Math.round((event.loaded / event.total) * 100));
        }
      };
    }

    // Support cancellation via AbortSignal.
    const signal = options.signal;
    const onAbort = () => xhr.abort();
    if (signal) {
      if (signal.aborted) {
        reject(new CloudinaryError('network', 'Upload cancelled.'));
        return;
      }
      signal.addEventListener('abort', onAbort);
    }
    const cleanup = () => signal?.removeEventListener('abort', onAbort);

    xhr.onload = () => {
      cleanup();
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as CloudinaryUploadResult;
          options.onProgress?.(100);
          resolve({
            secure_url: data.secure_url,
            public_id: data.public_id,
            width: data.width,
            height: data.height,
            format: data.format,
            bytes: data.bytes,
          });
        } catch {
          reject(
            new CloudinaryError(
              'upload-failed',
              'The image server returned an unexpected response.'
            )
          );
        }
        return;
      }
      // Cloudinary returns { error: { message } } on failure.
      let detail = '';
      try {
        detail =
          (JSON.parse(xhr.responseText) as { error?: { message?: string } })?.error?.message ?? '';
      } catch {
        /* ignore — fall back to the generic message */
      }
      reject(
        new CloudinaryError(
          'upload-failed',
          detail || 'The image could not be uploaded. Please try again.'
        )
      );
    };

    xhr.onerror = () => {
      cleanup();
      reject(
        new CloudinaryError(
          'network',
          'Could not reach the image server. Check your connection and try again.'
        )
      );
    };

    xhr.onabort = () => {
      cleanup();
      reject(new CloudinaryError('network', 'Upload cancelled.'));
    };

    xhr.send(formData);
  });
}

/**
 * Upload several images, reporting overall progress (0–100) across the batch.
 * Uploads run sequentially so aggregate progress is smooth and the target
 * account isn't hit with a burst of parallel requests. Rejects on the first
 * failure with a {@link CloudinaryError}.
 */
export async function uploadImages(
  files: File[],
  options: UploadImageOptions & { onOverallProgress?: (percent: number) => void } = {}
): Promise<CloudinaryUploadResult[]> {
  const { onOverallProgress, ...perFile } = options;
  const results: CloudinaryUploadResult[] = [];
  const total = files.length;

  for (let index = 0; index < total; index += 1) {
    const result = await uploadImage(files[index], {
      ...perFile,
      onProgress: (percent) => {
        perFile.onProgress?.(percent);
        // Overall = completed files + fraction of the in-flight file.
        onOverallProgress?.(Math.round(((index + percent / 100) / total) * 100));
      },
    });
    results.push(result);
  }

  return results;
}

// --- Delivery URL builders ----------------------------------------------------

/**
 * Assemble a delivery URL for a `public_id` with a transformation string.
 * Returns an empty string if the cloud name is not configured.
 */
function buildDeliveryUrl(publicId: string, transformation: string): string {
  if (!CLOUDINARY_CLOUD_NAME || !publicId) return '';
  const encodedId = publicId
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  const parts = ['image', 'upload'];
  if (transformation) parts.push(transformation);
  parts.push(encodedId);
  return `${CLOUDINARY_DELIVERY_BASE}/${CLOUDINARY_CLOUD_NAME}/${parts.join('/')}`;
}

/**
 * Optimize an image URL: applies `f_auto,q_auto` by default (best format +
 * quality for the requesting browser) plus optional resize.
 */
export function optimizeImageUrl(publicId: string, options: OptimizeOptions = {}): string {
  const { width, height, crop = 'limit', quality = 'auto', format = 'auto' } = options;

  const parts = [`f_${format}`, `q_${quality}`];
  if (width) parts.push(`w_${width}`);
  if (height) parts.push(`h_${height}`);
  if (width && height) parts.push(`c_${crop}`);

  return buildDeliveryUrl(publicId, parts.join(','));
}

/**
 * Generate a square thumbnail URL (auto gravity + fill crop by default).
 */
export function thumbnailUrl(publicId: string, options: ThumbnailOptions = {}): string {
  const { size = 200, gravity = 'auto' } = options;
  const transformation = [
    'c_fill',
    `g_${gravity}`,
    `w_${size}`,
    `h_${size}`,
    'f_auto',
    'q_auto',
  ].join(',');
  return buildDeliveryUrl(publicId, transformation);
}

/**
 * Generate a set of responsive delivery URLs, one per breakpoint width. Handy
 * for building a `srcSet`. Widths are returned sorted ascending.
 */
export function responsiveImageUrls(
  publicId: string,
  options: ResponsiveOptions = {}
): ResponsiveImage[] {
  const { widths = [...DEFAULT_RESPONSIVE_WIDTHS], quality = 'auto' } = options;
  return [...widths]
    .sort((a, b) => a - b)
    .map((width) => ({
      width,
      url: buildDeliveryUrl(publicId, `f_auto,q_${quality},w_${width}`),
    }));
}

/**
 * Build a `srcSet` string from responsive URLs, e.g. for an `<img srcSet>`.
 */
export function responsiveSrcSet(publicId: string, options: ResponsiveOptions = {}): string {
  return responsiveImageUrls(publicId, options)
    .map(({ url, width }) => `${url} ${width}w`)
    .join(', ');
}

// --- Deletion (placeholder) ---------------------------------------------------

/**
 * Delete an asset by `public_id` — **placeholder, intentionally not implemented.**
 *
 * Deletion requires a *signed* request (Admin API / signed destroy), which needs
 * the Cloudinary API secret. That secret must never ship to the browser, and
 * this app has no server runtime (static export) to sign from. Implement this by
 * routing through a trusted backend (e.g. a Cloud Function or a serverless
 * endpoint) that holds the secret and calls Cloudinary's destroy API. Until then
 * this throws so callers fail loudly rather than silently no-op.
 */
export async function deleteImage(_publicId: string): Promise<never> {
  throw new CloudinaryError(
    'not-configured',
    'Image deletion is not available yet. It requires a signed server-side request; ' +
      'see CLOUDINARY.md.'
  );
}

/** Grouped export mirroring the other `*.service.ts` modules in this folder. */
export const cloudinaryService = {
  uploadImage,
  uploadImages,
  validateImageFile,
  optimizeImageUrl,
  thumbnailUrl,
  responsiveImageUrls,
  responsiveSrcSet,
  deleteImage,
  isConfigured: isCloudinaryConfigured,
};

export type CloudinaryService = typeof cloudinaryService;
