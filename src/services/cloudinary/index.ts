/**
 * Cloudinary media layer — public barrel.
 *
 * Import from `@/services/cloudinary`:
 *   import { uploadImage, optimizeImageUrl } from '@/services/cloudinary';
 *
 * See `CLOUDINARY.md` (repo root) for setup and usage.
 */
export {
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_UPLOAD_PRESET,
  ACCEPTED_IMAGE_FORMATS,
  MAX_FILE_SIZE_BYTES,
  isCloudinaryConfigured,
  getMissingCloudinaryKeys,
} from './cloudinary.config';

export {
  CloudinaryError,
  cloudinaryService,
  uploadImage,
  validateImageFile,
  optimizeImageUrl,
  thumbnailUrl,
  responsiveImageUrls,
  responsiveSrcSet,
  deleteImage,
} from './cloudinary.service';

export type { CloudinaryService } from './cloudinary.service';
export type * from './cloudinary.types';
