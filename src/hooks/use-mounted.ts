'use client';

import * as React from 'react';

/** Returns true after the first client render — used to gate portals/theme UI. */
export function useMounted(): boolean {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  return mounted;
}
