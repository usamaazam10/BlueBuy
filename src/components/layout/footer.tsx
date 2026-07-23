'use client';

import * as React from 'react';
import Link from 'next/link';
import { Github, Instagram, Linkedin, Twitter, ArrowRight } from 'lucide-react';
import { FOOTER_NAV } from '@/data/navigation';
import { Container } from './container';
import { Logo } from '@/components/common/logo';
import { Input } from '@/components/ui/input';

const SOCIALS = [
  { label: 'Twitter', href: '#', icon: Twitter },
  { label: 'Instagram', href: '#', icon: Instagram },
  { label: 'GitHub', href: '#', icon: Github },
  { label: 'LinkedIn', href: '#', icon: Linkedin },
];

export function Footer() {
  const [submitted, setSubmitted] = React.useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    // UI only — no backend. Show a friendly confirmation.
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <footer className="border-border mt-24 border-t">
      <Container className="py-16">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-6">
          {/* Brand + newsletter */}
          <div className="col-span-2 flex flex-col gap-4 md:col-span-3">
            <Logo />
            <p className="text-muted-foreground max-w-xs text-sm">
              Premium tech, thoughtfully designed. Free shipping and 30-day returns on every order.
            </p>

            <form onSubmit={handleSubmit} className="mt-2 max-w-sm">
              <label htmlFor="newsletter" className="mb-2 block text-sm font-medium">
                Join our newsletter
              </label>
              {submitted ? (
                <p className="text-brand text-sm font-medium" role="status">
                  Thanks for subscribing! 🎉
                </p>
              ) : (
                <div className="flex gap-2">
                  <Input
                    id="newsletter"
                    type="email"
                    required
                    placeholder="you@example.com"
                    aria-label="Email address"
                  />
                  <button
                    type="submit"
                    aria-label="Subscribe"
                    className="bg-foreground text-background hover:bg-foreground/90 flex size-11 shrink-0 items-center justify-center rounded-full transition-colors"
                  >
                    <ArrowRight className="size-4" />
                  </button>
                </div>
              )}
            </form>
          </div>

          {/* Link columns */}
          {FOOTER_NAV.map((column) => (
            <nav key={column.title} aria-label={column.title} className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold">{column.title}</h3>
              <ul className="flex flex-col gap-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="border-border mt-14 flex flex-col items-center justify-between gap-6 border-t pt-8 sm:flex-row">
          <p className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} BlueBuy. All rights reserved.
          </p>
          <div className="flex items-center gap-1">
            {SOCIALS.map((social) => (
              <a
                key={social.label}
                href={social.href}
                aria-label={social.label}
                className="text-muted-foreground hover:text-foreground hover:bg-secondary flex size-9 items-center justify-center rounded-full transition-colors"
              >
                <social.icon className="size-[18px]" />
              </a>
            ))}
          </div>
        </div>
      </Container>
    </footer>
  );
}
