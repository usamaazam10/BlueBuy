'use client';

import * as React from 'react';
import { ImagePlus, Star, Trash2, UploadCloud } from 'lucide-react';
import { ProductMedia } from '@/components/product/product-media';
import { cn } from '@/lib/utils';

export interface UploaderImage {
  id: string;
  seed: string;
  accent: string;
}

interface ImageUploaderProps {
  images: UploaderImage[];
  onChange: (images: UploaderImage[]) => void;
  /** Accent used to seed newly-added placeholder artwork. */
  accent?: string;
}

const ACCENTS = ['#6366f1', '#0ea5e9', '#8b5cf6', '#14b8a6', '#f59e0b', '#ef4444'];

/**
 * UI-only image manager. Nothing is actually uploaded — the drop area and file
 * picker append geometric placeholder tiles so the gallery, thumbnail selection
 * and remove flows can be exercised without a backend or Storage.
 */
export function ImageUploader({ images, onChange, accent }: ImageUploaderProps) {
  const [dragOver, setDragOver] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  function addPlaceholders(count = 1) {
    const next: UploaderImage[] = Array.from({ length: count }, (_, i) => {
      const id = `img-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`;
      return { id, seed: id, accent: accent ?? ACCENTS[images.length % ACCENTS.length] };
    });
    onChange([...images, ...next]);
  }

  function remove(id: string) {
    onChange(images.filter((image) => image.id !== id));
  }

  function makePrimary(id: string) {
    const target = images.find((image) => image.id === id);
    if (!target) return;
    onChange([target, ...images.filter((image) => image.id !== id)]);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Drop area */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const count = e.dataTransfer?.files?.length || 1;
          addPlaceholders(count);
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-8 text-center transition-colors',
          'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
          dragOver
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
            PNG, JPG or WEBP up to 5&nbsp;MB · UI demo, nothing is uploaded
          </p>
        </div>
        {/* Kept UI-only: the picker never reads file contents, it just adds tiles. */}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            addPlaceholders(e.target.files?.length || 1);
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
              className="group border-border bg-muted/30 relative aspect-square overflow-hidden rounded-lg border"
            >
              <ProductMedia seed={image.seed} accent={image.accent} className="h-full w-full" />
              {index === 0 && (
                <span className="bg-foreground text-background absolute top-1.5 left-1.5 rounded px-1.5 py-0.5 text-[10px] font-medium">
                  Thumbnail
                </span>
              )}
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
            </div>
          ))}
          <button
            type="button"
            onClick={() => addPlaceholders(1)}
            aria-label="Add image"
            className="border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground flex aspect-square items-center justify-center rounded-lg border border-dashed transition-colors"
          >
            <ImagePlus className="size-5" />
          </button>
        </div>
      )}
    </div>
  );
}
