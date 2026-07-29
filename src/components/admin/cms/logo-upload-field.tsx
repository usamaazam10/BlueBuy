'use client';

import * as React from 'react';
import { Field, Input } from '@/components/admin/ui/control';
import { SingleImageUpload } from '@/components/admin/ui/single-image-upload';
import { useToast } from '@/components/ui/toast';
import { uploadImage, CloudinaryError } from '@/services/cloudinary';

const CLOUDINARY_FOLDER = 'bluebuy/brand';

interface LogoUploadFieldProps {
  label: string;
  hint?: string;
  /** Current URL value (Cloudinary or otherwise). */
  value: string;
  /** Called with the new URL (uploaded secure_url, manual entry, or '' to clear). */
  onChange: (url: string) => void;
  /** `contain` fits logos; `cover` fills (e.g. OG images). */
  fit?: 'cover' | 'contain';
}

/**
 * A settings logo field: upload an image to Cloudinary (immediate, so the URL is
 * ready before Save) with preview/replace/remove, plus a manual URL input as a
 * fallback. Keeps the CMS branding pipeline unified — every logo is just a URL
 * on `site_settings`, whether uploaded or pasted.
 */
export function LogoUploadField({
  label,
  hint,
  value,
  onChange,
  fit = 'contain',
}: LogoUploadFieldProps) {
  const toast = useToast();
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);

  async function handleSelect(file: File) {
    setUploading(true);
    setProgress(0);
    try {
      const result = await uploadImage(file, {
        folder: CLOUDINARY_FOLDER,
        onProgress: setProgress,
      });
      onChange(result.secure_url);
      toast.success('Uploaded', `${label} updated.`);
    } catch (error) {
      const message =
        error instanceof CloudinaryError ? error.message : 'The image could not be uploaded.';
      toast.error('Upload failed', message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Field label={label} hint={hint}>
      <div className="flex flex-col gap-3">
        <SingleImageUpload
          previewUrl={value || null}
          onSelect={handleSelect}
          onRemove={() => onChange('')}
          onError={(m) => toast.error(label, m)}
          uploading={uploading}
          progress={progress}
          fit={fit}
          label={`Upload ${label.toLowerCase()}`}
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://…  (or upload above)"
          aria-label={`${label} URL`}
        />
      </div>
    </Field>
  );
}
