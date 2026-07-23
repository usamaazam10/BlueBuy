import { Truck, ShieldCheck, RotateCcw, Headphones } from 'lucide-react';
import { Container } from '@/components/layout/container';
import { SectionTitle } from '@/components/common/section-title';
import { Stagger, StaggerItem } from '@/components/common/motion';

const FEATURES = [
  {
    icon: Truck,
    title: 'Free, fast shipping',
    description: 'Complimentary carbon-neutral delivery on every order, worldwide.',
  },
  {
    icon: RotateCcw,
    title: '30-day returns',
    description: 'Changed your mind? Send it back within 30 days, no questions asked.',
  },
  {
    icon: ShieldCheck,
    title: '2-year warranty',
    description: 'Every product is backed by our comprehensive, hassle-free warranty.',
  },
  {
    icon: Headphones,
    title: 'Human support',
    description: 'Real people, ready to help you 7 days a week via chat or email.',
  },
];

export function WhyChooseUs() {
  return (
    <section className="py-20 sm:py-24">
      <Container>
        <SectionTitle
          eyebrow="Why BlueBuy"
          title="Designed around you"
          description="We sweat the details so every purchase feels effortless — before, during and after."
        />

        <Stagger className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <StaggerItem key={feature.title}>
              <div className="border-border hover:border-foreground/15 flex h-full flex-col gap-4 rounded-2xl border p-6 transition-colors">
                <span className="bg-brand/10 text-brand flex size-12 items-center justify-center rounded-xl">
                  <feature.icon className="size-6" />
                </span>
                <div className="flex flex-col gap-1.5">
                  <h3 className="font-semibold">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm text-pretty">{feature.description}</p>
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </Container>
    </section>
  );
}
