import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Compass, Leaf, Sparkles } from 'lucide-react';
import { Container } from '@/components/layout/container';
import { Button } from '@/components/ui/button';
import { SectionTitle } from '@/components/common/section-title';
import { Reveal, Stagger, StaggerItem } from '@/components/common/motion';
import { absoluteUrl } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'About',
  description:
    'BlueBuy designs premium, minimal technology for everyday life — built to last and made responsibly.',
  alternates: { canonical: absoluteUrl('/about/') },
};

const STATS = [
  { value: '250k+', label: 'Happy customers' },
  { value: '40+', label: 'Countries shipped' },
  { value: '4.8/5', label: 'Average rating' },
  { value: '2015', label: 'Founded' },
];

const VALUES = [
  {
    icon: Compass,
    title: 'Design-led',
    description:
      'Every product starts with the experience. If it does not feel effortless, it is not ready.',
  },
  {
    icon: Leaf,
    title: 'Made responsibly',
    description:
      'Recycled materials, carbon-neutral shipping and packaging that respects the planet.',
  },
  {
    icon: Sparkles,
    title: 'Built to last',
    description:
      'Premium components and a 2-year warranty, because good things should not be disposable.',
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
                Our story
              </span>
            </Reveal>
            <Reveal delay={0.05}>
              <h1 className="mt-4 text-4xl font-semibold text-balance sm:text-6xl">
                Technology that gets out of your way
              </h1>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="text-muted-foreground mt-6 max-w-xl text-lg text-pretty">
                BlueBuy started with a simple belief: the best technology is the kind you barely
                notice. We design premium, minimal products that just work — beautifully.
              </p>
            </Reveal>
          </div>
        </Container>
      </section>

      {/* Stats */}
      <Container className="pb-8">
        <Stagger className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {STATS.map((stat) => (
            <StaggerItem key={stat.label}>
              <div className="border-border flex flex-col items-center gap-1 rounded-2xl border py-8 text-center">
                <span className="text-3xl font-semibold sm:text-4xl">{stat.value}</span>
                <span className="text-muted-foreground text-sm">{stat.label}</span>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </Container>

      {/* Values */}
      <section className="py-20 sm:py-24">
        <Container>
          <SectionTitle eyebrow="What we believe" title="The principles behind every product" />
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

      {/* Mission band */}
      <Container className="pb-20">
        <Reveal>
          <div className="border-border grid grid-cols-1 gap-8 rounded-3xl border p-8 sm:p-14 lg:grid-cols-2 lg:items-center">
            <div className="flex flex-col gap-4">
              <h2 className="text-3xl font-semibold text-balance">
                We sweat the details so you don’t have to
              </h2>
              <p className="text-muted-foreground text-pretty">
                From the first unboxing to years of daily use, we obsess over the moments that make
                a product feel considered. That means intuitive setup, materials that age well, and
                support from real people whenever you need it.
              </p>
              <div>
                <Button asChild variant="brand">
                  <Link href="/products">
                    Explore our products <ArrowRight className="size-4" />
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
