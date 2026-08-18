'use client';

import * as React from 'react';
import { AlertCircle, CheckCircle2, Loader2, Mail, Send } from 'lucide-react';
import { Input, Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useContactInformation } from '@/hooks/queries';
import { useWhatsApp } from '@/hooks/use-whatsapp';
import { contactMessageSchema } from '@/lib/validations';
import { track } from '@/lib/analytics/tracker';

/** Raw (string) form state. */
interface FormState {
  name: string;
  email: string;
  subject: string;
  message: string;
}

const EMPTY_FORM: FormState = { name: '', email: '', subject: '', message: '' };

type FieldErrors = Partial<Record<keyof FormState, string>>;
type Status = 'idle' | 'submitting' | 'success' | 'error';

/**
 * How this form actually delivers a message. BlueBuy is a static export on
 * GitHub Pages — there is no server, no mail transport and nowhere safe to keep
 * an API secret — so the form has to hand off to something real:
 *
 *  - `endpoint` — a hosted form service (Formspree, Web3Forms, …) configured in
 *    Admin → CMS → Contact information. The submission is POSTed straight from
 *    the browser and forwarded to the store's inbox.
 *  - `whatsapp` — opens WhatsApp with the message pre-filled, addressed to the
 *    store's configured number.
 *  - `email`   — opens the customer's mail client with the message pre-filled,
 *    addressed to the store's configured address.
 *
 * When none of the three is configured the form does not render at all, because
 * a form that silently discards messages is worse than no form.
 */
type Channel = 'endpoint' | 'whatsapp' | 'email';

/** Plain-text rendering of a submission, used by the WhatsApp/email handoffs. */
function composeBody(values: FormState): string {
  return `Name: ${values.name}\nEmail: ${values.email}\n\n${values.message}`;
}

export function ContactForm() {
  const { data: contact } = useContactInformation();
  const { enabled: whatsAppEnabled, buildUrl: buildWhatsAppUrl } = useWhatsApp();

  const endpoint = contact?.formEndpoint?.trim() ?? '';
  const email = contact?.email?.trim() ?? '';

  const channel: Channel | null = endpoint
    ? 'endpoint'
    : whatsAppEnabled
      ? 'whatsapp'
      : email
        ? 'email'
        : null;

  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [status, setStatus] = React.useState<Status>('idle');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Nothing is configured to receive a message — show the contact methods only.
  if (!channel) return null;

  const setField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const parsed = contactMessageSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FormState;
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    const values = parsed.data;

    // Records that a customer reached out, and through which channel. The
    // message itself — name, email, body — is never sent to analytics.
    track('contact_click', { path: `/contact/${channel}` });

    // Handoff channels: open the app that will carry the message. We do not
    // claim the message was "sent" — the customer still presses send there.
    if (channel === 'whatsapp') {
      window.open(
        buildWhatsAppUrl(`${values.subject}\n\n${composeBody(values)}`),
        '_blank',
        'noopener,noreferrer'
      );
      setStatus('success');
      return;
    }
    if (channel === 'email') {
      const query = new URLSearchParams({
        subject: values.subject,
        body: composeBody(values),
      });
      window.location.href = `mailto:${email}?${query.toString()}`;
      setStatus('success');
      return;
    }

    setStatus('submitting');
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(values),
      });
      if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
      setStatus('success');
      setForm(EMPTY_FORM);
    } catch {
      setStatus('error');
      setErrorMessage(
        'We could not send your message just now. Please try again, or reach us using the contact details on this page.'
      );
    }
  }

  if (status === 'success') {
    return (
      <div className="border-border flex flex-col items-center gap-4 rounded-2xl border p-10 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
          <CheckCircle2 className="size-7" />
        </span>
        <div>
          <h3 className="text-lg font-semibold">
            {channel === 'endpoint' ? 'Message sent' : 'Your message is ready'}
          </h3>
          <p className="text-muted-foreground mt-1 text-sm text-pretty">
            {channel === 'endpoint'
              ? 'Thanks for getting in touch — we’ll reply to the email address you gave us.'
              : channel === 'whatsapp'
                ? 'We’ve opened WhatsApp with your message filled in. Press send there and it will reach us.'
                : 'We’ve opened your email app with the message filled in. Press send there and it will reach us.'}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setStatus('idle');
            setForm(EMPTY_FORM);
          }}
        >
          Write another message
        </Button>
      </div>
    );
  }

  const submitting = status === 'submitting';

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="border-border flex flex-col gap-5 rounded-2xl border p-6 sm:p-8"
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Name" htmlFor="name" error={errors.name}>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            value={form.name}
            onChange={(e) => setField('name', e.target.value)}
            aria-invalid={Boolean(errors.name)}
            disabled={submitting}
          />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email}>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => setField('email', e.target.value)}
            aria-invalid={Boolean(errors.email)}
            disabled={submitting}
          />
        </Field>
      </div>
      <Field label="Subject" htmlFor="subject" error={errors.subject}>
        <Input
          id="subject"
          name="subject"
          placeholder="How can we help?"
          value={form.subject}
          onChange={(e) => setField('subject', e.target.value)}
          aria-invalid={Boolean(errors.subject)}
          disabled={submitting}
        />
      </Field>
      <Field label="Message" htmlFor="message" error={errors.message}>
        <Textarea
          id="message"
          name="message"
          placeholder="Tell us a little more…"
          value={form.message}
          onChange={(e) => setField('message', e.target.value)}
          aria-invalid={Boolean(errors.message)}
          disabled={submitting}
        />
      </Field>

      {errorMessage && (
        <p
          role="alert"
          className="border-destructive/30 bg-destructive/10 text-destructive flex items-start gap-2 rounded-xl border p-3 text-xs"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {errorMessage}
        </p>
      )}

      <Button type="submit" variant="brand" size="lg" className="self-start" disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Sending…
          </>
        ) : channel === 'endpoint' ? (
          <>
            <Send className="size-4" /> Send message
          </>
        ) : channel === 'whatsapp' ? (
          <>
            <Send className="size-4" /> Send on WhatsApp
          </>
        ) : (
          <>
            <Mail className="size-4" /> Send by email
          </>
        )}
      </Button>

      {channel !== 'endpoint' && (
        <p className="text-muted-foreground text-xs">
          {channel === 'whatsapp'
            ? 'This opens WhatsApp with your message ready to send.'
            : 'This opens your email app with your message ready to send.'}
        </p>
      )}
    </form>
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error && (
        <p className="text-destructive flex items-center gap-1 text-xs" role="alert">
          <AlertCircle className="size-3.5" /> {error}
        </p>
      )}
    </div>
  );
}
