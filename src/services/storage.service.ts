/**
 * Storage service — placeholder.
 *
 * Defines the intended surface for uploading/removing files in Cloud Storage.
 * Every method currently throws `notImplemented`. Uploads are intentionally NOT
 * implemented in this phase.
 *
 * When implemented, methods should use `getStorageInstance()` from `@/firebase`.
 */
import { notImplemented } from '@/firebase';

export interface UploadOptions {
  /** Storage object path, e.g. `products/{slug}/{filename}`. */
  path: string;
  file: File | Blob;
  contentType?: string;
}

export interface UploadResult {
  path: string;
  downloadUrl: string;
}

export const storageService = {
  /** Upload a file and return its path + public download URL. */
  async upload(_options: UploadOptions): Promise<UploadResult> {
    throw notImplemented('storageService.upload');
  },

  /** Resolve the public download URL for a stored object path. */
  async getDownloadUrl(_path: string): Promise<string> {
    throw notImplemented('storageService.getDownloadUrl');
  },

  /** Delete a stored object by path. */
  async remove(_path: string): Promise<void> {
    throw notImplemented('storageService.remove');
  },
};

export type StorageService = typeof storageService;
