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
import { queryKeys } from '@/hooks/queries/keys';
import type {
  SiteSettings,
  Homepage,
  Footer,
  ContactInformation,
  NavItem,
  SocialLink,
  Banner,
} from '@/types/cms';

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

interface QueryProviderProps {
  children: React.ReactNode;
  /**
   * CMS singletons read at build time by the root layout.
   *
   * Seeding these means prerendered HTML carries the store's real currency,
   * branding and copy — and the client's first render matches it — instead of
   * painting the built-in defaults and visibly correcting them once Firestore
   * responds. Anything omitted (or `null`, when Firestore was unreachable at
   * build time) simply falls back to the model defaults as before.
   */
  initialSiteSettings?: SiteSettings | null;
  initialHomepage?: Homepage | null;
  initialFooter?: Footer | null;
  initialContact?: ContactInformation | null;
  initialNavigation?: NavItem[] | null;
  initialSocialLinks?: SocialLink[] | null;
  initialBanners?: Banner[] | null;
}

export function QueryProvider({
  children,
  initialSiteSettings,
  initialHomepage,
  initialFooter,
  initialContact,
  initialNavigation,
  initialSocialLinks,
  initialBanners,
}: QueryProviderProps) {
  const [queryClient] = React.useState(() => {
    const client = makeQueryClient();
    // `updatedAt: 0` marks each build-time snapshot as already stale, so the
    // browser refetches immediately on mount. The baked values only ever own the
    // first paint — a CMS change still lands without a rebuild.
    const seed = <T,>(key: readonly unknown[], value: T | null | undefined) => {
      if (value) client.setQueryData(key, value, { updatedAt: 0 });
    };
    seed(queryKeys.siteSettings, initialSiteSettings);
    seed(queryKeys.homepage, initialHomepage);
    seed(queryKeys.footer, initialFooter);
    seed(queryKeys.contactInformation, initialContact);
    seed(queryKeys.navigation, initialNavigation);
    seed(queryKeys.socialLinks, initialSocialLinks);
    seed(queryKeys.banners, initialBanners);
    return client;
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
