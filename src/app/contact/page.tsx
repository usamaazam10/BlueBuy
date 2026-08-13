import type { Metadata } from 'next';
import { Container } from '@/components/layout/container';
import { ContactForm } from '@/components/sections/contact-form';
import { ContactDetails } from '@/components/sections/contact-details';
import { Reveal } from '@/components/common/motion';
import { absoluteUrl } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Get in touch with BlueBuy about a product, an order or availability — by WhatsApp, email or phone.',
  alternates: { canonical: absoluteUrl('/contact/') },
};

export default function ContactPage() {
  return (
    <Container className="py-16 sm:py-20">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
        {/* Left: intro + methods (CMS-driven) */}
        <ContactDetails />

        {/* Right: form */}
        <Reveal delay={0.15}>
          <ContactForm />
        </Reveal>
      </div>
    </Container>
  );
}
