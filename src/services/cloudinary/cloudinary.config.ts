/**
 * Cloudinary configuration, sourced entirely from environment variables.
 *
 * Nothing is hardcoded — see `.env.example` for the required keys. Both values
 * are `NEXT_PUBLIC_*` because uploads happen in the browser via an **unsigned**
 * upload preset; neither the cloud name nor the preset is a secret. Security is
 * enforced by the preset's server-side settings in the Cloudinary dashboard
 * (allowed formats, folder, max size), not by hiding these values.
 *
 * The app ships as a static export (no server runtime), so there is no API
 * secret available at runtime and none should ever be placed here.
 *
 * See `CLOUDINARY.md` for setup.
 */

/** Cloudinary account cloud name (from the dashboard). */
export const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '';

/** Name of the unsigned upload preset used for browser uploads. */
export const CLOUDINARY_UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? '';

/** Base host for delivery (transformation) URLs. */
export const CLOUDINARY_DELIVERY_BASE = 'https://res.cloudinary.com';

/** Base host for the unsigned upload endpoint. */
export const CLOUDINARY_API_BASE = 'https://api.cloudinary.com/v1_1';

/** Fully-qualified unsigned image upload endpoint for the configured cloud. */
export const CLOUDINARY_UPLOAD_URL = `${CLOUDINARY_API_BASE}/${CLOUDINARY_CLOUD_NAME}/image/upload`;

// --- Validation constraints ---------------------------------------------------

/** Accepted upload formats (also enforce this on the preset server-side). */
export const ACCEPTED_IMAGE_FORMATS = ['jpg', 'jpeg', 'png', 'webp'] as const;

/** Accepted MIME types, matched against `File.type`. */
export const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** Maximum accepted file size: 10 MB. */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** True when both required env values are present. */
export function isCloudinaryConfigured(): boolean {
  return CLOUDINARY_CLOUD_NAME.length > 0 && CLOUDINARY_UPLOAD_PRESET.length > 0;
}

/** Names of any missing required env keys (for diagnostics). */
export function getMissingCloudinaryKeys(): string[] {
  const missing: string[] = [];
  if (!CLOUDINARY_CLOUD_NAME) missing.push('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME');
  if (!CLOUDINARY_UPLOAD_PRESET) missing.push('NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET');
  return missing;
}
