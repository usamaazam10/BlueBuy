'use client';

/**
 * TanStack React Query provider for the storefront.
 *
 * The storefront reads live Firestore data on the client (the app ships as a
 * static export, so there is no server runtime to fetch on). React Query owns
 * caching, retries, loading/error state and background refetching for every one
 * of those reads.
 *
 * The `QueryClient` is created inside `useState` so it is instantiated exactly
 * once per browser session and never recreated across re-renders.
 */
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/** Errors that will never succeed on retry (permissions, missing data, etc.). */
const NON_RETRYABLE = new Set([
  'permission-denied',
  'not-found',
  'unauthenticated',
  'invalid-argument',
  'validation',
]);

/** Read the normalised AppError code off a thrown value, when present. */
function errorCode(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error) {
    return String((error as { code: unknown }).code);
  }
  return undefined;
}

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Catalogue data changes rarely; keep it fresh for a minute before
        // considering a background refetch, and cached for five.
        staleTime: 60_000,
        gcTime: 300_000,
        // Retry transient failures a couple of times with exponential backoff,
        // capped so the UI never hangs for long — but skip errors that can't
        // succeed on retry (e.g. a permission-denied read).
        retry: (failureCount, error) => {
          const code = errorCode(error);
          if (code && NON_RETRYABLE.has(code)) return false;
          return failureCount < 2;
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8_000),
        refetchOnWindowFocus: false,
      },
    },
  });
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(makeQueryClient);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
