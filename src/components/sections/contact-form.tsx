'use client';

import * as React from 'react';
import { CheckCircle2, Send } from 'lucide-react';
import { Input, Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

/** UI-only contact form — no submission backend during this phase. */
export function ContactForm() {
  const [submitted, setSubmitted] = React.useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="border-border flex flex-col items-center gap-4 rounded-2xl border p-10 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
          <CheckCircle2 className="size-7" />
        </span>
        <div>
          <h3 className="text-lg font-semibold">Message sent</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Thanks for reaching out — we’ll get back to you within one business day.
          </p>
        </div>
        <Button variant="outline" onClick={() => setSubmitted(false)}>
          Send another
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-border flex flex-col gap-5 rounded-2xl border p-6 sm:p-8"
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Name" htmlFor="name">
          <Input id="name" name="name" required autoComplete="name" placeholder="Jane Appleseed" />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="jane@example.com"
          />
        </Field>
      </div>
      <Field label="Subject" htmlFor="subject">
        <Input id="subject" name="subject" required placeholder="How can we help?" />
      </Field>
      <Field label="Message" htmlFor="message">
        <Textarea id="message" name="message" required placeholder="Tell us a little more…" />
      </Field>
      <Button type="submit" variant="brand" size="lg" className="self-start">
        <Send className="size-4" /> Send message
      </Button>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}
