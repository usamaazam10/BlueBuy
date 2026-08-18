'use client';

/**
 * Analytics hooks (read side).
 *
 * Writes never go through React Query — the storefront tracker fires them
 * directly and forgets them (see `@/lib/analytics/tracker`), because an
 * analytics write must never participate in the UI's loading or error states.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { analyticsService, type AnalyticsWindow } from '@/services/analytics.service';
import type { DateRange } from '@/lib/business/date-range';
import { rangeToken } from './keys';

/** Raw events for a period, plus truncation / never-tracked flags. */
export function useAnalyticsWindow(range: DateRange | null | undefined) {
  return useQuery<AnalyticsWindow>({
    queryKey: ['analytics', 'window', rangeToken(range)],
    queryFn: () => analyticsService.window(range!),
    enabled: Boolean(range),
    // Events accumulate continuously; a short stale window keeps the dashboard
    // responsive without re-reading a large collection on every focus change.
    staleTime: 60 * 1000,
  });
}

/** Rebuild the precomputed daily rollups for a period. Idempotent. */
export function useRebuildAnalyticsSummaries() {
  const queryClient = useQueryClient();
  return useMutation<{ days: number; events: number }, Error, DateRange>({
    mutationFn: (range) => analyticsService.rebuildDailySummaries(range),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}
