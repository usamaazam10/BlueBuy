'use client';

import * as React from 'react';
import { Field, Input } from '@/components/admin/ui/control';
import { SingleImageUpload } from '@/components/admin/ui/single-image-upload';
import { useToast } from '@/components/ui/toast';
import { uploadImage, CloudinaryError } from '@/services/cloudinary';

const CLOUDINARY_FOLDER = 'bluebuy/hero';

interface HeroSlideImageFieldProps {
  /** Current URL value (Cloudinary or otherwise). */
  value: string;
  /** Called with the new URL (uploaded secure_url, manual entry, or '' to clear). */
  onChange: (url: string) => void;
}

/**
 * A hero-slide background image field: upload to Cloudinary (immediate, so the
 * URL is ready before Save) with preview/replace/remove, plus a manual URL
 * input as a fallback. Mirrors {@link LogoUploadField} for a different folder.
 */
export function HeroSlideImageField({ value, onChange }: HeroSlideImageFieldProps) {
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
      toast.success('Uploaded', 'Slide image updated.');
    } catch (error) {
      const message =
        error instanceof CloudinaryError ? error.message : 'The image could not be uploaded.';
      toast.error('Upload failed', message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Field label="Background image" hint="Optional. Layered subtly behind the geometric default.">
      <div className="flex flex-col gap-3">
        <SingleImageUpload
          previewUrl={value || null}
          onSelect={handleSelect}
          onRemove={() => onChange('')}
          onError={(m) => toast.error('Slide image', m)}
          uploading={uploading}
          progress={progress}
          fit="cover"
          label="Upload background image"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://…  (or upload above)"
          aria-label="Background image URL"
        />
      </div>
    </Field>
  );
}
