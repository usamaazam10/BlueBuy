'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Check, Copy, ImageOff, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/admin/ui/control';
import { DataTable, type Column } from '@/components/admin/ui/data-table';
import { EmptyState } from '@/components/admin/ui/empty-state';
import { ConfirmDialog } from '@/components/admin/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { OrphanedAssetRepository } from '@/repositories';
import { toAppError } from '@/firebase';
import type { FirestoreDate, OrphanedAsset } from '@/types/models';

type Filter = 'pending' | 'cleaned' | 'all';

/** Coerce a Firestore timestamp to sortable millis. */
function toMillis(date: FirestoreDate): number {
  if (!date) return 0;
  if (date instanceof Date) return date.getTime();
  if (typeof (date as { toMillis?: () => number }).toMillis === 'function') {
    return (date as { toMillis: () => number }).toMillis();
  }
  return 0;
}

/** Format a Firestore timestamp as a short date, or an em dash. */
function formatDate(date: FirestoreDate): string {
  const ms = toMillis(date);
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Media cleanup manager — the operator view of the `orphaned_assets` ledger.
 *
 * The static client can't destroy Cloudinary assets (that needs a signed Admin
 * API call). So when a product/category/brand is deleted or its image replaced,
 * the affected `public_id` is recorded here. An operator copies each id, runs a
 * signed destroy (Cloudinary CLI/dashboard), then marks it cleaned. Reads/writes
 * go through {@link OrphanedAssetRepository} — never Firestore directly.
 */
export function OrphanedAssetsManager() {
  const router = useRouter();
  const toast = useToast();

  const [assets, setAssets] = React.useState<OrphanedAsset[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<Filter>('pending');
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [toDelete, setToDelete] = React.useState<OrphanedAsset | null>(null);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    OrphanedAssetRepository.list()
      .then((list) => {
        if (!active) return;
        setAssets([...list].sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)));
      })
      .catch((error: unknown) => {
        if (active) setLoadError(toAppError(error).message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const pendingCount = assets.filter((a) => !a.cleaned).length;
  const visible = React.useMemo(() => {
    if (filter === 'pending') return assets.filter((a) => !a.cleaned);
    if (filter === 'cleaned') return assets.filter((a) => a.cleaned);
    return assets;
  }, [assets, filter]);

  async function copyId(asset: OrphanedAsset) {
    try {
      await navigator.clipboard.writeText(asset.publicId);
      toast.success('Copied', 'Public ID copied to your clipboard.');
    } catch {
      toast.error('Copy failed', 'Your browser blocked clipboard access.');
    }
  }

  async function toggleCleaned(asset: OrphanedAsset) {
    setBusyId(asset.id);
    try {
      const next = !asset.cleaned;
      await OrphanedAssetRepository.markCleaned(asset.id, next);
      setAssets((prev) =>
        prev.map((a) =>
          a.id === asset.id ? { ...a, cleaned: next, cleanedAt: next ? new Date() : null } : a
        )
      );
      toast.success(next ? 'Marked cleaned' : 'Reopened', asset.publicId);
    } catch (error) {
      toast.error('Update failed', toAppError(error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(asset: OrphanedAsset) {
    setBusyId(asset.id);
    try {
      await OrphanedAssetRepository.remove(asset.id);
      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
      toast.success('Entry removed', 'The ledger entry was deleted.');
    } catch (error) {
      toast.error('Delete failed', toAppError(error).message);
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
        <p className="text-muted-foreground text-sm">Loading media ledger…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Couldn’t load the ledger"
        description={loadError}
        action={
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg"
            onClick={() => router.refresh()}
          >
            Retry
          </Button>
        }
      />
    );
  }

  const columns: Column<OrphanedAsset>[] = [
    {
      key: 'preview',
      header: '',
      className: 'w-14',
      cell: (a) => (
        <span className="border-border bg-muted/40 block size-10 overflow-hidden rounded-lg border">
          {a.url ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote Cloudinary src under static export
            <img src={a.url} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-muted-foreground flex h-full w-full items-center justify-center">
              <ImageOff className="size-4" />
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'publicId',
      header: 'Public ID',
      cell: (a) => (
        <div className="flex items-center gap-2">
          <code
            className="text-foreground max-w-[22ch] truncate font-mono text-xs"
            title={a.publicId}
          >
            {a.publicId}
          </code>
          <button
            type="button"
            onClick={() => void copyId(a)}
            aria-label={`Copy public ID ${a.publicId}`}
            className="text-muted-foreground hover:bg-secondary hover:text-foreground flex size-7 shrink-0 items-center justify-center rounded-md transition-colors"
          >
            <Copy className="size-3.5" />
          </button>
        </div>
      ),
    },
    {
      key: 'source',
      header: 'Source',
      hideOnMobile: true,
      cell: (a) => (
        <div className="flex flex-col">
          <span className="text-foreground text-sm">{a.sourceLabel || '—'}</span>
          <span className="text-muted-foreground text-xs capitalize">{a.sourceType}</span>
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: 'Recorded',
      hideOnMobile: true,
      cell: (a) => <span className="text-muted-foreground text-xs">{formatDate(a.createdAt)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (a) =>
        a.cleaned ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <Check className="size-3" /> Cleaned
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
            Pending
          </span>
        ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-24 text-right',
      cell: (a) => (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => void toggleCleaned(a)}
            disabled={busyId === a.id}
            aria-label={a.cleaned ? 'Reopen entry' : 'Mark as cleaned'}
            className="text-muted-foreground hover:bg-secondary hover:text-foreground flex size-8 items-center justify-center rounded-lg transition-colors disabled:opacity-50"
          >
            {busyId === a.id ? (
              <Loader2 className="size-4 animate-spin" />
            ) : a.cleaned ? (
              <RotateCcw className="size-4" />
            ) : (
              <Check className="size-4" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setToDelete(a)}
            disabled={busyId === a.id}
            aria-label={`Delete ledger entry ${a.publicId}`}
            className="text-muted-foreground hover:bg-destructive/10 flex size-8 items-center justify-center rounded-lg transition-colors hover:text-rose-600 disabled:opacity-50 dark:hover:text-rose-400"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* How-to note */}
      <div className="border-border bg-muted/30 text-muted-foreground rounded-xl border p-4 text-sm">
        <p className="text-foreground font-medium">How cleanup works</p>
        <p className="mt-1">
          The storefront is a static site and can’t delete Cloudinary assets directly. Copy each
          public ID below, destroy it in Cloudinary (Media Library, or{' '}
          <code className="font-mono text-xs">cld uploader destroy &lt;public_id&gt;</code>), then
          mark the entry as cleaned.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          {pendingCount} pending {pendingCount === 1 ? 'asset' : 'assets'}
        </p>
        <div className="w-40">
          <Select value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
            <option value="pending">Pending</option>
            <option value="cleaned">Cleaned</option>
            <option value="all">All</option>
          </Select>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="border-border bg-card rounded-xl border">
          <EmptyState
            icon={ImageOff}
            title={filter === 'pending' ? 'Nothing to clean up' : 'No entries'}
            description={
              filter === 'pending'
                ? 'When you delete an item or replace its image, its Cloudinary assets are queued here.'
                : 'No ledger entries match this filter.'
            }
          />
        </div>
      ) : (
        <DataTable columns={columns} data={visible} rowKey={(a) => a.id} />
      )}

      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) void remove(toDelete);
        }}
        title="Remove ledger entry?"
        description="This only removes the tracking record. Make sure you’ve already destroyed the asset in Cloudinary — otherwise it will be lost from this list."
        confirmLabel="Remove entry"
      />
    </div>
  );
}
