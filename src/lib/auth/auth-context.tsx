'use client';

import * as React from 'react';
import type { User } from 'firebase/auth';
import {
  isFirebaseConfigured,
  getMissingConfigKeys,
  observeAuthState,
  signInWithEmail,
  signOutUser,
} from '@/firebase';
import { DEFAULT_ROLE, isRole, type Role } from './roles';

/**
 * The application user, mapped from the Firebase `User` to a small, UI-friendly
 * shape. `role` is resolved from custom claims (see `roles.ts`) so the rest of
 * the app never touches raw Firebase objects or trusts ad-hoc client state.
 */
export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: Role;
}

export interface AuthContextValue {
  /** The signed-in user, or `null` when signed out. */
  user: AuthUser | null;
  /** True until the initial persisted-session check resolves. */
  loading: boolean;
  /** False when Firebase env config is missing (see `.env.example`). */
  configured: boolean;
  /** Human-readable config diagnostic when `configured` is false. */
  configError: string | null;
  /** Sign in with email + password. Throws an `AppError` on failure. */
  signIn: (email: string, password: string, remember: boolean) => Promise<void>;
  /** Sign the current user out. */
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

/** Resolves a Firebase `User` into an `AuthUser`, reading the `role` claim. */
async function toAuthUser(user: User): Promise<AuthUser> {
  let role: Role = DEFAULT_ROLE;
  try {
    // Custom claims are the source of truth for roles; they are signed by
    // Firebase and cannot be forged client-side. Absent a claim, fall back to
    // the default role (see `roles.ts`).
    const { claims } = await user.getIdTokenResult();
    if (isRole(claims.role)) role = claims.role;
  } catch {
    // Token fetch failures shouldn't block sign-in; keep the default role.
  }
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    role,
  };
}

/**
 * Provides authentication state to the tree beneath it. Mount it around any
 * surface that needs auth (the admin shell and the login screen). It subscribes
 * to Firebase auth-state changes on mount and unsubscribes on unmount.
 *
 * Firebase is only touched inside effects, so this is safe under static export /
 * prerendering — nothing runs at build time.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const configured = React.useMemo(() => isFirebaseConfigured(), []);
  const configError = React.useMemo(
    () =>
      configured
        ? null
        : `Firebase is not configured. Missing: ${getMissingConfigKeys().join(', ')}. ` +
          'Copy .env.example to .env.local and fill in your Firebase project values.',
    [configured]
  );

  React.useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }

    let active = true;
    const unsubscribe = observeAuthState(async (fbUser) => {
      if (!fbUser) {
        if (active) {
          setUser(null);
          setLoading(false);
        }
        return;
      }
      const mapped = await toAuthUser(fbUser);
      if (active) {
        setUser(mapped);
        setLoading(false);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [configured]);

  const signIn = React.useCallback(async (email: string, password: string, remember: boolean) => {
    // The auth-state listener updates `user`; we don't set it here so there is
    // a single source of truth for session state.
    await signInWithEmail(email, password, remember);
  }, []);

  const signOut = React.useCallback(async () => {
    await signOutUser();
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({ user, loading, configured, configError, signIn, signOut }),
    [user, loading, configured, configError, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Access the auth context. Must be called from within an {@link AuthProvider};
 * throwing otherwise surfaces the wiring mistake immediately.
 */
export function useAuth(): AuthContextValue {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an <AuthProvider>.');
  }
  return context;
}
