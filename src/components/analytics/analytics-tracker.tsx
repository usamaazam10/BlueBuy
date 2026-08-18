'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { track } from '@/lib/analytics/tracker';

/**
 * Records a `page_view` on every storefront navigation.
 *
 * Mounted once inside `SiteChrome`, which already excludes `/admin` and
 * `/login`, and the tracker itself refuses those paths too — belt and braces, so
 * staff browsing can never be counted as store traffic.
 *
 * The `lastPath` ref guards against React's development-mode double effect
 * invocation (and any re-render that doesn't change the route), which would
 * otherwise double-count every page view during local development.
 */
export function AnalyticsTracker() {
  const pathname = usePathname();
  const lastPath = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!pathname) return;
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    track('page_view', { path: pathname });
  }, [pathname]);

  return null;
}
