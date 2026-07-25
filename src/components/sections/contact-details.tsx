'use client';

import { Mail, MapPin, Phone, Clock, type LucideIcon } from 'lucide-react';
import { Reveal } from '@/components/common/motion';
import { useContactInformation } from '@/hooks/queries';

interface ContactMethod {
  icon: LucideIcon;
  label: string;
  value: string;
  href: string | null;
}

/**
 * Contact intro + methods, driven by the `contact_information` CMS singleton.
 * Renders the heading/subheading and a list of contact methods (email, phone,
 * address, hours) — each shown only when it has a value.
 */
export function ContactDetails() {
  const { data: contact } = useContactInformation();

  const methods: ContactMethod[] = [];
  if (contact!.email)
    methods.push({
      icon: Mail,
      label: 'Email',
      value: contact!.email,
      href: `mailto:${contact!.email}`,
    });
  if (contact!.phone)
    methods.push({
      icon: Phone,
      label: 'Phone',
      value: contact!.phone,
      href: `tel:${contact!.phone.replace(/[^\d+]/g, '')}`,
    });
  if (contact!.address)
    methods.push({ icon: MapPin, label: 'Studio', value: contact!.address, href: null });
  if (contact!.hours)
    methods.push({ icon: Clock, label: 'Hours', value: contact!.hours, href: null });

  return (
    <div className="flex flex-col gap-8">
      <Reveal>
        <div className="flex flex-col gap-4">
          {contact!.eyebrow && (
            <span className="text-brand text-sm font-semibold tracking-wide uppercase">
              {contact!.eyebrow}
            </span>
          )}
          <h1 className="text-4xl font-semibold text-balance sm:text-5xl">{contact!.heading}</h1>
          {contact!.subheading && (
            <p className="text-muted-foreground text-lg text-pretty">{contact!.subheading}</p>
          )}
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        <ul className="flex flex-col gap-3">
          {methods.map((method) => {
            const content = (
              <span className="border-border hover:border-foreground/15 flex items-center gap-4 rounded-2xl border p-4 transition-colors">
                <span className="bg-brand/10 text-brand flex size-11 items-center justify-center rounded-xl">
                  <method.icon className="size-5" />
                </span>
                <span className="flex flex-col">
                  <span className="text-muted-foreground text-xs tracking-wide uppercase">
                    {method.label}
                  </span>
                  <span className="font-medium">{method.value}</span>
                </span>
              </span>
            );
            return (
              <li key={method.label}>
                {method.href ? (
                  <a
                    href={method.href}
                    className="focus-visible:ring-ring block rounded-2xl outline-none focus-visible:ring-2"
                  >
                    {content}
                  </a>
                ) : (
                  content
                )}
              </li>
            );
          })}
        </ul>
      </Reveal>
    </div>
  );
}
