'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/toast';
import { toAppError } from '@/firebase';

interface UseCmsSingletonArgs<T> {
  /** Reads the document (returns defaults when unset). */
  load: () => Promise<T>;
  /** Validates + persists the whole document. */
  save: (value: T) => Promise<T>;
  /** React Query key to invalidate on save, so the storefront reflects edits. */
  queryKey: readonly unknown[];
  /** Human label used in toasts, e.g. "Site settings". */
  label: string;
}

interface UseCmsSingletonResult<T> {
  draft: T | null;
  /** Immutable-friendly setter (accepts a value or an updater). */
  setDraft: React.Dispatch<React.SetStateAction<T | null>>;
  /** Patch a subset of top-level fields on the draft. */
  patch: (fields: Partial<T>) => void;
  loading: boolean;
  loadError: string | null;
  dirty: boolean;
  saving: boolean;
  onSave: () => Promise<void>;
  onReset: () => void;
  reload: () => void;
}

/**
 * Editing controller for a CMS singleton document. Loads the document into a
 * local draft, tracks unsaved changes against the last-saved baseline, and on
 * save validates + persists via the repository, refreshes the baseline, and
 * invalidates the storefront query so public pages pick up the change.
 *
 * This is the shared spine of every singleton editor (site settings, homepage,
 * footer, contact) — pair it with {@link CmsFormShell} for consistent loading,
 * error and save-bar UI.
 */
export function useCmsSingleton<T>({
  load,
  save,
  queryKey,
  label,
}: UseCmsSingletonArgs<T>): UseCmsSingletonResult<T> {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [draft, setDraft] = React.useState<T | null>(null);
  const [baseline, setBaseline] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [nonce, setNonce] = React.useState(0);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    load()
      .then((value) => {
        if (!active) return;
        setDraft(value);
        setBaseline(value);
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
    // `load` is a stable repository method; re-run only on explicit reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  const dirty = React.useMemo(
    () => draft != null && baseline != null && JSON.stringify(draft) !== JSON.stringify(baseline),
    [draft, baseline]
  );

  const patch = React.useCallback((fields: Partial<T>) => {
    setDraft((current) => (current == null ? current : { ...current, ...fields }));
  }, []);

  async function onSave() {
    if (draft == null) return;
    setSaving(true);
    try {
      const saved = await save(draft);
      setDraft(saved);
      setBaseline(saved);
      await queryClient.invalidateQueries({ queryKey });
      toast.success(`${label} saved`, 'Your changes are now live on the storefront.');
    } catch (error) {
      toast.error('Save failed', toAppError(error).message);
    } finally {
      setSaving(false);
    }
  }

  function onReset() {
    setDraft(baseline);
  }

  function reload() {
    setNonce((value) => value + 1);
  }

  return { draft, setDraft, patch, loading, loadError, dirty, saving, onSave, onReset, reload };
}
