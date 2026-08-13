import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BadgeCheck, MessageCircle, Package } from 'lucide-react';
import { Container } from '@/components/layout/container';
import { Button } from '@/components/ui/button';
import { SectionTitle } from '@/components/common/section-title';
import { Reveal, Stagger, StaggerItem } from '@/components/common/motion';
import { BLUEBUY_COLLECTION } from '@/lib/collection';
import { absoluteUrl } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'About',
  description:
    'BlueBuy is an online store offering a carefully selected range of products, from trusted brands and our own BlueBuy Collection.',
  alternates: { canonical: absoluteUrl('/about/') },
};

/**
 * How the store works — each point describes something the storefront actually
 * does. No founding dates, customer counts, ratings or awards: none of that has
 * been supplied, and inventing it to look established would be a lie to
 * shoppers.
 */
const VALUES = [
  {
    icon: BadgeCheck,
    title: 'Selected, not stocked at random',
    description:
      'Products are added to the catalogue one at a time, chosen for quality, usefulness and value rather than to fill a shelf.',
  },
  {
    icon: Package,
    title: BLUEBUY_COLLECTION.name,
    description:
      'Some products are sourced by us directly rather than carrying a well-known label. Those are offered under the BlueBuy Collection — our own curated product line.',
  },
  {
    icon: MessageCircle,
    title: 'Talk to us before you buy',
    description:
      'Not sure which product is right, or whether something is in stock? Message us and a person will answer — before you order, not just after.',
  },
];

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)] opacity-50" />
        <Container className="relative py-20 sm:py-28">
          <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
            <Reveal>
              <span className="text-brand text-sm font-semibold tracking-wide uppercase">
                About BlueBuy
              </span>
            </Reveal>
            <Reveal delay={0.05}>
              <h1 className="mt-4 text-4xl font-semibold text-balance sm:text-6xl">
                A shop for products worth keeping
              </h1>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="text-muted-foreground mt-6 max-w-xl text-lg text-pretty">
                BlueBuy is an online store. We put together a growing catalogue of products across
                several categories — from brands you know, and from our own BlueBuy Collection — and
                make them simple to browse, compare and order.
              </p>
            </Reveal>
            <Reveal delay={0.15}>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild variant="brand" size="lg">
                  <Link href="/products">
                    Shop now <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/contact">Contact us</Link>
                </Button>
              </div>
            </Reveal>
          </div>
        </Container>
      </section>

      {/* How we shop for you */}
      <section className="py-20 sm:py-24">
        <Container>
          <SectionTitle eyebrow="How we work" title="What you can expect from BlueBuy" />
          <Stagger className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
            {VALUES.map((value) => (
              <StaggerItem key={value.title}>
                <div className="border-border flex h-full flex-col gap-4 rounded-2xl border p-8">
                  <span className="bg-brand/10 text-brand flex size-12 items-center justify-center rounded-xl">
                    <value.icon className="size-6" />
                  </span>
                  <h3 className="text-lg font-semibold">{value.title}</h3>
                  <p className="text-muted-foreground text-sm text-pretty">{value.description}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </Container>
      </section>

      {/* Ordering band */}
      <Container className="pb-20">
        <Reveal>
          <div className="border-border grid grid-cols-1 gap-8 rounded-3xl border p-8 sm:p-14 lg:grid-cols-2 lg:items-center">
            <div className="flex flex-col gap-4">
              <h2 className="text-3xl font-semibold text-balance">Ordering is straightforward</h2>
              <p className="text-muted-foreground text-pretty">
                Add what you want to your cart, place the order with your name, contact number and
                delivery address, and we&apos;ll confirm it with you directly. There is no online
                payment step and no card details are collected — payment is arranged on delivery.
              </p>
              <div>
                <Button asChild variant="brand">
                  <Link href="/products">
                    Browse the catalogue <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            </div>
            <div
              aria-hidden
              className="from-brand/20 relative hidden aspect-[4/3] overflow-hidden rounded-2xl bg-gradient-to-br to-transparent lg:block"
            >
              <div className="bg-brand/30 absolute top-1/2 left-1/2 size-48 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl" />
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 gap-3 p-6 opacity-70">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="border-border/60 rounded-xl border" />
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </>
  );
}
