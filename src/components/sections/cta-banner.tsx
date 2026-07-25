'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Container } from '@/components/layout/container';
import { Button } from '@/components/ui/button';
import { Reveal } from '@/components/common/motion';
import { useHomepage } from '@/hooks/queries';

/**
 * Promotional CTA band, driven by the homepage CMS (`promoBanner`). Renders
 * nothing when the editor disables it.
 */
export function CtaBanner() {
  const { data: homepage } = useHomepage();
  const promo = homepage!.promoBanner;

  if (!promo.enabled || !promo.title) return null;

  return (
    <section className="py-8 sm:py-12">
      <Container>
        <Reveal>
          <div className="bg-foreground text-background relative overflow-hidden rounded-3xl px-8 py-16 sm:px-16 sm:py-20">
            {/* Decorative geometry */}
            <div
              aria-hidden
              className="bg-brand/40 absolute -top-16 -right-16 size-72 rounded-full blur-3xl"
            />
            <div
              aria-hidden
              className="absolute -bottom-24 -left-10 size-72 rounded-full bg-white/10 blur-3xl"
            />

            <div className="relative mx-auto flex max-w-2xl flex-col items-center text-center">
              <h2 className="text-3xl font-semibold text-balance sm:text-4xl">{promo.title}</h2>
              {promo.subtitle && (
                <p className="text-background/70 mt-4 max-w-lg text-pretty sm:text-lg">
                  {promo.subtitle}
                </p>
              )}
              {promo.cta.label && (
                <Button asChild variant="brand" size="lg" className="mt-8">
                  <Link href={promo.cta.href || '/'}>
                    {promo.cta.label} <ArrowRight className="size-4" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
