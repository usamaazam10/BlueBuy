/**
 * Reusable Firebase error helpers.
 *
 * Normalises the various error shapes the Firebase SDKs throw (FirebaseError
 * from Auth/Firestore/Storage, plain Errors, unknown throwables) into a single
 * `AppError` type with a stable `code` and a human-friendly `message`, so
 * callers and UI can handle failures consistently.
 */
import { FirebaseError } from 'firebase/app';

/** Stable, app-level error categories independent of the SDK surface. */
export type AppErrorCode =
  | 'permission-denied'
  | 'not-found'
  | 'already-exists'
  | 'unauthenticated'
  | 'unavailable'
  | 'invalid-argument'
  | 'validation'
  | 'not-implemented'
  | 'unknown';

/** A normalised application error. */
export class AppError extends Error {
  readonly code: AppErrorCode;
  /** The original error, retained for logging/debugging. */
  readonly cause?: unknown;
  /** The raw provider code (e.g. "auth/user-not-found"), when available. */
  readonly providerCode?: string;

  constructor(
    code: AppErrorCode,
    message: string,
    options?: { cause?: unknown; providerCode?: string }
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.cause = options?.cause;
    this.providerCode = options?.providerCode;
  }
}

/** Maps a raw Firebase error code (`service/reason`) to an AppErrorCode. */
function mapFirebaseCode(code: string): AppErrorCode {
  const reason = code.includes('/') ? code.split('/')[1] : code;
  switch (reason) {
    case 'permission-denied':
    case 'unauthorized':
      return 'permission-denied';
    case 'not-found':
    case 'object-not-found':
      return 'not-found';
    case 'already-exists':
      return 'already-exists';
    case 'unauthenticated':
    case 'user-not-found':
    case 'invalid-credential':
      return 'unauthenticated';
    case 'unavailable':
    case 'deadline-exceeded':
      return 'unavailable';
    case 'invalid-argument':
    case 'failed-precondition':
      return 'invalid-argument';
    default:
      return 'unknown';
  }
}

/** Friendly, user-safe messages per category. */
const FRIENDLY_MESSAGE: Record<AppErrorCode, string> = {
  'permission-denied': 'You do not have permission to perform this action.',
  'not-found': 'The requested item could not be found.',
  'already-exists': 'That item already exists.',
  unauthenticated: 'Please sign in to continue.',
  unavailable: 'The service is temporarily unavailable. Please try again.',
  'invalid-argument': 'Some of the provided information is invalid.',
  validation: 'The provided data failed validation.',
  'not-implemented': 'This feature is not implemented yet.',
  unknown: 'Something went wrong. Please try again.',
};

/** True if the value is a Firebase SDK error. */
export function isFirebaseError(error: unknown): error is FirebaseError {
  return error instanceof FirebaseError;
}

/**
 * Normalise any thrown value into an `AppError`. Safe to call in a `catch`.
 */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  if (isFirebaseError(error)) {
    const code = mapFirebaseCode(error.code);
    return new AppError(code, FRIENDLY_MESSAGE[code], {
      cause: error,
      providerCode: error.code,
    });
  }

  if (error instanceof Error) {
    return new AppError('unknown', error.message || FRIENDLY_MESSAGE.unknown, { cause: error });
  }

  return new AppError('unknown', FRIENDLY_MESSAGE.unknown, { cause: error });
}

/** Convenience factory for "not implemented yet" service stubs. */
export function notImplemented(feature: string): AppError {
  return new AppError('not-implemented', `Not implemented: ${feature}`);
}

/**
 * Wrap an async operation so any thrown value is normalised to an `AppError`.
 * Usage: `const data = await withAppError(() => getDoc(ref), 'load product');`
 */
export async function withAppError<T>(fn: () => Promise<T>, context?: string): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const appError = toAppError(error);
    if (context) appError.message = `${context}: ${appError.message}`;
    throw appError;
  }
}
