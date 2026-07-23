'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Eye, EyeOff, Loader2, Lock } from 'lucide-react';
import { useAuth, loginSchema, type LoginErrors, type LoginValues } from '@/lib/auth';
import { AuthRedirectSplash } from '@/components/auth/protected-route';
import { Logo } from '@/components/common/logo';
import { Button } from '@/components/ui/button';
import { Input, Label, Checkbox } from '@/components/admin/ui';
import { ThemeToggle } from '@/components/common/theme-toggle';
import { cn } from '@/lib/utils';

const INITIAL: LoginValues = { email: '', password: '', remember: true };

/**
 * Administrator sign-in screen.
 *
 * Email + password only. Already-authenticated admins are bounced to `/admin`;
 * everyone else gets a validated, accessible form. This page renders standalone
 * (the storefront navbar/footer are skipped for `/login`) so it reads as a
 * focused, branded entry point.
 */
export default function LoginPage() {
  const { user, loading, configured, configError, signIn } = useAuth();
  const router = useRouter();

  const [values, setValues] = React.useState<LoginValues>(INITIAL);
  const [errors, setErrors] = React.useState<LoginErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showForgotNote, setShowForgotNote] = React.useState(false);

  // Redirect an already-signed-in admin away from the login screen.
  React.useEffect(() => {
    if (configured && !loading && user) {
      router.replace('/admin');
    }
  }, [configured, loading, user, router]);

  // While the session resolves, or once authenticated (redirect in flight),
  // show the branded splash instead of flashing the form.
  if (configured && (loading || user)) {
    return <AuthRedirectSplash />;
  }

  function update<K extends keyof LoginValues>(key: K, value: LoginValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
    if (formError) setFormError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) {
      const next: LoginErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof LoginValues | undefined;
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }

    setSubmitting(true);
    try {
      await signIn(parsed.data.email, parsed.data.password, parsed.data.remember);
      // On success the auth listener updates state; navigate to the dashboard.
      router.replace('/admin');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to sign in. Please try again.');
      setSubmitting(false);
    }
  }

  const disabled = submitting || !configured;

  return (
    <div className="bg-background text-foreground relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
      {/* Subtle branded backdrop. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="bg-brand/10 absolute -top-24 left-1/2 size-[36rem] -translate-x-1/2 rounded-full blur-3xl" />
      </div>

      <div className="absolute top-4 right-4">
        <ThemeToggle className="size-9 rounded-lg" />
      </div>

      <main className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <Logo href={null} />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Admin sign in</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Restricted area — administrators only.
            </p>
          </div>
        </div>

        <div className="border-border bg-card rounded-2xl border p-6 shadow-sm sm:p-8">
          {/* Config guard: makes a missing-env setup obvious instead of silent. */}
          {!configured && (
            <div
              role="alert"
              className="border-destructive/30 bg-destructive/10 text-destructive mb-5 flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{configError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            {/* Auth failure (wrong credentials, network, etc.). */}
            {formError && (
              <div
                role="alert"
                className="border-destructive/30 bg-destructive/10 text-destructive flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{formError}</span>
              </div>
            )}

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoFocus
                placeholder="you@bluebuy.com"
                value={values.email}
                onChange={(e) => update('email', e.target.value)}
                disabled={disabled}
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={errors.email ? 'email-error' : undefined}
              />
              {errors.email && (
                <p id="email-error" className="text-destructive text-xs">
                  {errors.email}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  onClick={() => setShowForgotNote((v) => !v)}
                  className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/40 rounded text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  aria-expanded={showForgotNote}
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="pr-10"
                  value={values.password}
                  onChange={(e) => update('password', e.target.value)}
                  disabled={disabled}
                  aria-invalid={errors.password ? true : undefined}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/40 absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {errors.password && (
                <p id="password-error" className="text-destructive text-xs">
                  {errors.password}
                </p>
              )}
              {showForgotNote && (
                <p className="text-muted-foreground text-xs" role="status">
                  Password reset isn’t available yet — contact another administrator to reset your
                  account.
                </p>
              )}
            </div>

            {/* Remember me */}
            <Checkbox
              label="Keep me signed in"
              checked={values.remember}
              onChange={(e) => update('remember', e.target.checked)}
              disabled={disabled}
            />

            <Button
              type="submit"
              variant="brand"
              size="lg"
              disabled={disabled}
              className={cn('mt-1 w-full', submitting && 'cursor-progress')}
            >
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  Signing in…
                </>
              ) : (
                <>
                  <Lock aria-hidden="true" />
                  Sign in
                </>
              )}
            </Button>
          </form>
        </div>

        <p className="text-muted-foreground mt-6 text-center text-xs">
          Protected area. Unauthorized access is prohibited.
        </p>
      </main>
    </div>
  );
}
