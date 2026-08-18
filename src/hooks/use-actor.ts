'use client';

import * as React from 'react';
import { useAuth } from '@/lib/auth';
import type { ActorRef } from '@/types/business';

/**
 * The signed-in user as an {@link ActorRef}, for stamping onto business records.
 *
 * Services are plain async functions with no React dependency, so the actor is
 * passed *in* rather than read from context inside them. This hook is the single
 * place that translation happens, so every audit entry and ledger row identifies
 * its author the same way.
 *
 * Falls back to an explicitly unknown actor when signed out. That should be
 * unreachable behind `ProtectedRoute`, and recording "Unknown" is better than
 * recording nothing or crashing mid-write.
 */
export function useActor(): ActorRef {
  const { user } = useAuth();

  return React.useMemo<ActorRef>(
    () => ({
      uid: user?.uid ?? null,
      email: user?.email ?? null,
      label: user?.email || user?.displayName || 'Unknown user',
    }),
    [user?.uid, user?.email, user?.displayName]
  );
}
