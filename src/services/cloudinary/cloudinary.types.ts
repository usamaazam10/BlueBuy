/**
 * Cloudinary type surface.
 *
 * These types describe the small slice of Cloudinary we use from the browser:
 * unsigned uploads and delivery-URL transformations. They are intentionally
 * decoupled from any Firebase/UI model types (see `@/types/models`), so the
 * media layer stays independent.
 */

/** Image formats accepted by {@link validateImageFile} / uploadImage. */
export type CloudinaryImageFormat = 'jpg' | 'jpeg' | 'png' | 'webp';

/**
 * Normalised result of a successful upload.
 *
 * Field names mirror Cloudinary's raw JSON response so callers can map the
 * payload directly onto a persistence model later without renaming.
 */
export interface CloudinaryUploadResult {
  /** HTTPS delivery URL of the original asset. */
  secure_url: string;
  /** Stable public identifier (used for transformations + future deletion). */
  public_id: string;
  /** Intrinsic width in pixels. */
  width: number;
  /** Intrinsic height in pixels. */
  height: number;
  /** Delivered format, e.g. `"jpg"`, `"png"`, `"webp"`. */
  format: string;
  /** File size in bytes. */
  bytes: number;
}

/** Optional metadata forwarded with an upload (all optional). */
export interface UploadImageOptions {
  /** Cloudinary asset folder, e.g. `"products"`. */
  folder?: string;
  /** Tags applied to the uploaded asset. */
  tags?: string[];
  /** AbortSignal to cancel an in-flight upload. */
  signal?: AbortSignal;
}

/** Discriminated result of client-side file validation. */
export type ValidationResult = { valid: true } | { valid: false; error: string };

/** Cloudinary auto/format quality directives. */
export type AutoValue = 'auto';

/** Resize/crop modes supported by the URL helpers. */
export type CropMode = 'fill' | 'fit' | 'limit' | 'thumb' | 'scale' | 'crop';

/** Gravity (focal point) for cropping. */
export type Gravity = 'auto' | 'center' | 'face' | 'faces' | 'north' | 'south';

/** Options for {@link optimizeImageUrl}. */
export interface OptimizeOptions {
  /** Target width in px (omit to keep original). */
  width?: number;
  /** Target height in px (omit to keep original). */
  height?: number;
  /** Crop mode when both dimensions are given. Defaults to `"limit"`. */
  crop?: CropMode;
  /** Quality — a number (1–100) or `"auto"`. Defaults to `"auto"`. */
  quality?: number | AutoValue;
  /** Delivery format — a concrete format or `"auto"`. Defaults to `"auto"`. */
  format?: CloudinaryImageFormat | AutoValue;
}

/** Options for {@link thumbnailUrl}. */
export interface ThumbnailOptions {
  /** Square edge length in px. Defaults to 200. */
  size?: number;
  /** Gravity for the crop. Defaults to `"auto"`. */
  gravity?: Gravity;
}

/** Options for {@link responsiveImageUrls}. */
export interface ResponsiveOptions {
  /** Widths (px) to generate. Defaults to a sensible breakpoint set. */
  widths?: number[];
  /** Quality — a number (1–100) or `"auto"`. Defaults to `"auto"`. */
  quality?: number | AutoValue;
}

/** A single responsive candidate: its URL and the width it targets. */
export interface ResponsiveImage {
  url: string;
  width: number;
}
