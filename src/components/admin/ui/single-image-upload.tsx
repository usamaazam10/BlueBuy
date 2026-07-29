'use client';

import * as React from 'react';
import { ImagePlus, Loader2, Trash2, UploadCloud } from 'lucide-react';
import { validateImageFile } from '@/services/cloudinary';
import { cn } from '@/lib/utils';

interface SingleImageUploadProps {
  /** Current preview URL — an existing Cloudinary URL or a local object URL. */
  previewUrl: string | null;
  /** Called with a validated File when the user picks/drops one. */
  onSelect: (file: File) => void;
  /** Called when the user clears the current image. */
  onRemove: () => void;
  /** Surface a validation message (e.g. via a toast). */
  onError?: (message: string) => void;
  /** True while the file is uploading (shows progress overlay). */
  uploading?: boolean;
  /** Upload progress 0–100 (only meaningful while `uploading`). */
  progress?: number;
  disabled?: boolean;
  /** `cover` fills the frame (category images); `contain` fits it (logos). */
  fit?: 'cover' | 'contain';
  /** Accessible label for the picker button. */
  label?: string;
}

/**
 * A single-image uploader for admin forms (category image, brand logo).
 *
 * Mirrors the gallery {@link ImageUploader} conventions — drag & drop, click to
 * browse, client-side validation via the Cloudinary service — but for exactly
 * one image with replace/remove. Files are **uploaded on save** by the parent
 * form (not on select); this component only manages selection + preview and
 * reports validation errors.
 */
export function SingleImageUpload({
  previewUrl,
  onSelect,
  onRemove,
  onError,
  uploading = false,
  progress = 0,
  disabled = false,
  fit = 'cover',
  label = 'Upload image',
}: SingleImageUploadProps) {
  const [dragOver, setDragOver] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  function handleFiles(fileList: FileList | File[]) {
    const file = Array.from(fileList)[0];
    if (!file) return;
    const check = validateImageFile(file);
    if (!check.valid) {
      onError?.(check.error);
      return;
    }
    onSelect(file);
  }

  if (previewUrl) {
    return (
      <div className="border-border bg-muted/30 relative aspect-video max-w-xs overflow-hidden rounded-xl border">
        {/* eslint-disable-next-line @next/next/no-img-element -- object URLs + remote Cloudinary URLs; unoptimized export */}
        <img
          src={previewUrl}
          alt=""
          className={cn('h-full w-full', fit === 'contain' ? 'object-contain p-4' : 'object-cover')}
        />

        {uploading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/50 text-white">
            <Loader2 className="size-4 animate-spin" />
            <span className="text-[11px] font-medium tabular-nums">{progress}%</span>
          </div>
        )}

        {!uploading && !disabled && (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-1 bg-gradient-to-t from-black/50 to-transparent p-2 opacity-0 transition-opacity focus-within:opacity-100 hover:opacity-100">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              aria-label="Replace image"
              className="flex size-7 items-center justify-center rounded-md bg-white/90 text-neutral-800 transition-colors hover:bg-white"
            >
              <ImagePlus className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={onRemove}
              aria-label="Remove image"
              className="flex size-7 items-center justify-center rounded-md bg-white/90 text-rose-600 transition-colors hover:bg-white"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={disabled}
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
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
        if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files);
      }}
      className={cn(
        'flex aspect-video max-w-xs flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-8 text-center transition-colors',
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
          Drop an image, or <span className="text-brand">browse</span>
        </p>
        <p className="text-muted-foreground mt-0.5 text-xs">JPG, PNG or WEBP · up to 10&nbsp;MB</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={disabled}
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
