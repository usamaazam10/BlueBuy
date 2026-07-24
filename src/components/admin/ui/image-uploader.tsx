'use client';

import * as React from 'react';
import { AlertCircle, ImagePlus, Loader2, Star, Trash2, UploadCloud } from 'lucide-react';
import { validateImageFile } from '@/services/cloudinary';
import type { CloudinaryUploadResult } from '@/services/cloudinary';
import { cn } from '@/lib/utils';

/** Maximum number of images allowed in a single product gallery. */
export const MAX_IMAGES = 10;

/** Per-image upload lifecycle. */
export type GalleryImageStatus = 'ready' | 'uploading' | 'uploaded' | 'error';

/**
 * A gallery image the form works with. It represents either:
 *  - a **new** local file awaiting upload (`file` set, `status: 'ready'`), or
 *  - an **existing** image already on Cloudinary (`uploaded` set, `status: 'uploaded'`).
 */
export interface GalleryImage {
  id: string;
  /** Object URL for local files, or the Cloudinary `secure_url` for existing ones. */
  previewUrl: string;
  /** The local File pending upload; absent for already-uploaded images. */
  file?: File;
  /** Cloudinary metadata once uploaded (or preloaded for existing images). */
  uploaded?: CloudinaryUploadResult;
  status: GalleryImageStatus;
  /** Upload progress 0–100 (only meaningful while `status === 'uploading'`). */
  progress: number;
  error?: string;
  alt: string;
}

/** Build a gallery item from a validated local File. */
function fileToGalleryImage(file: File): GalleryImage {
  return {
    id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    previewUrl: URL.createObjectURL(file),
    file,
    status: 'ready',
    progress: 0,
    alt: file.name.replace(/\.[^.]+$/, ''),
  };
}

interface ImageUploaderProps {
  images: GalleryImage[];
  onChange: (images: GalleryImage[]) => void;
  /** Surface a friendly validation/limit message (e.g. via a toast). */
  onError?: (message: string) => void;
  /** Disable all interactions (e.g. while an upload/publish is in flight). */
  disabled?: boolean;
}

/**
 * Real, file-backed image uploader.
 *
 * Handles drag & drop and the file picker, validates each file (format + size,
 * via the Cloudinary service) and the 10-image limit, previews via object URLs,
 * supports thumbnail selection and removal, and renders per-image upload
 * progress. **Files are uploaded on Publish**, not on add — the form drives the
 * actual upload and feeds status/progress back through the `images` prop.
 */
export function ImageUploader({ images, onChange, onError, disabled }: ImageUploaderProps) {
  const [dragOver, setDragOver] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Revoke object URLs for local files on unmount to avoid memory leaks.
  const imagesRef = React.useRef(images);
  imagesRef.current = images;
  React.useEffect(() => {
    return () => {
      for (const image of imagesRef.current) {
        if (image.file) URL.revokeObjectURL(image.previewUrl);
      }
    };
  }, []);

  function addFiles(fileList: FileList | File[]) {
    const incoming = Array.from(fileList);
    if (incoming.length === 0) return;

    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      onError?.(`You can upload up to ${MAX_IMAGES} images.`);
      return;
    }

    const accepted: GalleryImage[] = [];
    for (const file of incoming) {
      if (accepted.length >= remaining) {
        onError?.(`Only ${MAX_IMAGES} images are allowed; some files were skipped.`);
        break;
      }
      const check = validateImageFile(file);
      if (!check.valid) {
        onError?.(check.error);
        continue;
      }
      accepted.push(fileToGalleryImage(file));
    }

    if (accepted.length > 0) onChange([...images, ...accepted]);
  }

  function remove(id: string) {
    const target = images.find((image) => image.id === id);
    if (target?.file) URL.revokeObjectURL(target.previewUrl);
    onChange(images.filter((image) => image.id !== id));
  }

  function makePrimary(id: string) {
    const target = images.find((image) => image.id === id);
    if (!target) return;
    onChange([target, ...images.filter((image) => image.id !== id)]);
  }

  const atLimit = images.length >= MAX_IMAGES;

  return (
    <div className="flex flex-col gap-4">
      {/* Drop area */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (disabled) return;
          if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
        }}
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-8 text-center transition-colors',
          'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
          disabled ? 'border-border cursor-not-allowed opacity-60' : 'cursor-pointer',
          dragOver && !disabled
            ? 'border-brand bg-brand/5'
            : 'border-border hover:border-foreground/30 hover:bg-muted/40'
        )}
      >
        <span className="border-border text-muted-foreground flex size-10 items-center justify-center rounded-full border">
          <UploadCloud className="size-5" />
        </span>
        <div>
          <p className="text-foreground text-sm font-medium">
            Drop images here, or <span className="text-brand">browse</span>
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            JPG, PNG or WEBP · up to 10&nbsp;MB each · {images.length}/{MAX_IMAGES}
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={disabled}
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {/* Gallery */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {images.map((image, index) => (
            <div
              key={image.id}
              className={cn(
                'group border-border bg-muted/30 relative aspect-square overflow-hidden rounded-lg border',
                image.status === 'error' && 'border-destructive'
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- object URLs + remote Cloudinary URLs; unoptimized export */}
              <img src={image.previewUrl} alt={image.alt} className="h-full w-full object-cover" />

              {index === 0 && (
                <span className="bg-foreground text-background absolute top-1.5 left-1.5 rounded px-1.5 py-0.5 text-[10px] font-medium">
                  Thumbnail
                </span>
              )}

              {/* Uploading overlay with progress */}
              {image.status === 'uploading' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/50 text-white">
                  <Loader2 className="size-4 animate-spin" />
                  <span className="text-[11px] font-medium tabular-nums">{image.progress}%</span>
                  <span className="absolute inset-x-2 bottom-2 h-1 overflow-hidden rounded-full bg-white/25">
                    <span
                      className="bg-brand block h-full rounded-full transition-[width]"
                      style={{ width: `${image.progress}%` }}
                    />
                  </span>
                </div>
              )}

              {/* Error overlay */}
              {image.status === 'error' && (
                <div className="bg-destructive/80 absolute inset-0 flex flex-col items-center justify-center gap-1 p-2 text-center text-white">
                  <AlertCircle className="size-4" />
                  <span className="text-[10px] leading-tight">
                    {image.error ?? 'Upload failed'}
                  </span>
                </div>
              )}

              {/* Hover actions (hidden while uploading) */}
              {image.status !== 'uploading' && !disabled && (
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-1 bg-gradient-to-t from-black/50 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  {index !== 0 && (
                    <button
                      type="button"
                      onClick={() => makePrimary(image.id)}
                      aria-label="Set as thumbnail"
                      className="flex size-7 items-center justify-center rounded-md bg-white/90 text-neutral-800 transition-colors hover:bg-white"
                    >
                      <Star className="size-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => remove(image.id)}
                    aria-label="Remove image"
                    className="flex size-7 items-center justify-center rounded-md bg-white/90 text-rose-600 transition-colors hover:bg-white"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}

          {!atLimit && !disabled && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              aria-label="Add image"
              className="border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground flex aspect-square items-center justify-center rounded-lg border border-dashed transition-colors"
            >
              <ImagePlus className="size-5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
