import type { Metadata } from 'next';
import { Mail, MapPin, Phone } from 'lucide-react';
import { Container } from '@/components/layout/container';
import { ContactForm } from '@/components/sections/contact-form';
import { Reveal } from '@/components/common/motion';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Get in touch with the BlueBuy team — we’re here to help 7 days a week.',
};

const CONTACT_METHODS = [
  { icon: Mail, label: 'Email', value: 'support@bluebuy.com', href: 'mailto:support@bluebuy.com' },
  { icon: Phone, label: 'Phone', value: '+1 (555) 010-2040', href: 'tel:+15550102040' },
  { icon: MapPin, label: 'Studio', value: '500 Market St, San Francisco', href: null },
];

export default function ContactPage() {
  return (
    <Container className="py-16 sm:py-20">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
        {/* Left: intro + methods */}
        <div className="flex flex-col gap-8">
          <Reveal>
            <div className="flex flex-col gap-4">
              <span className="text-brand text-sm font-semibold tracking-wide uppercase">
                Contact
              </span>
              <h1 className="text-4xl font-semibold text-balance sm:text-5xl">
                We’d love to hear from you
              </h1>
              <p className="text-muted-foreground text-lg text-pretty">
                Questions about a product, an order, or just want to say hello? Our team replies
                within one business day.
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <ul className="flex flex-col gap-3">
              {CONTACT_METHODS.map((method) => {
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

        {/* Right: form */}
        <Reveal delay={0.15}>
          <ContactForm />
        </Reveal>
      </div>
    </Container>
  );
}
