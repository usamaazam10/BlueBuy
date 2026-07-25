'use client';

import * as React from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/admin/ui/empty-state';

interface CmsFormShellProps {
  loading: boolean;
  loadError: string | null;
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onReset: () => void;
  onRetry: () => void;
  children: React.ReactNode;
}

/**
 * Standard chrome for a CMS singleton editor: a loading state, a load-error
 * state with retry, the form body, and a sticky save bar that appears only when
 * there are unsaved changes. Keeps every editor page visually consistent.
 */
export function CmsFormShell({
  loading,
  loadError,
  dirty,
  saving,
  onSave,
  onReset,
  onRetry,
  children,
}: CmsFormShellProps) {
  if (loading) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Couldn’t load this content"
        description={loadError}
        action={
          <Button variant="outline" size="sm" className="rounded-lg" onClick={onRetry}>
            Retry
          </Button>
        }
      />
    );
  }

  return (
    <div className="pb-24">
      <div className="flex flex-col gap-6">{children}</div>

      {/* Sticky save bar — only while there are unsaved changes. */}
      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-4">
          <div className="border-border bg-card/95 flex w-full max-w-2xl items-center justify-between gap-4 rounded-xl border px-4 py-3 shadow-lg backdrop-blur">
            <p className="text-muted-foreground text-sm">You have unsaved changes.</p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg"
                onClick={onReset}
                disabled={saving}
              >
                Discard
              </Button>
              <Button
                variant="brand"
                size="sm"
                className="rounded-lg"
                onClick={onSave}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Saving…
                  </>
                ) : (
                  'Save changes'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface SectionCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

/** A titled card grouping a set of related fields within an editor. */
export function SectionCard({ title, description, children }: SectionCardProps) {
  return (
    <section className="border-border bg-card rounded-xl border p-5 sm:p-6">
      <div className="mb-4">
        <h2 className="text-foreground text-sm font-semibold">{title}</h2>
        {description && <p className="text-muted-foreground mt-0.5 text-sm">{description}</p>}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}
