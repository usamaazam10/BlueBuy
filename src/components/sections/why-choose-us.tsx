import { Container } from '@/components/layout/container';
import { SectionTitle } from '@/components/common/section-title';
import { Stagger, StaggerItem } from '@/components/common/motion';
import { TRUST_SIGNALS } from '@/components/common/trust-signals';

/**
 * The homepage benefits grid, sourced from the canonical claims so it can never
 * contradict the reassurance shown on the product page, cart or checkout.
 */
const FEATURES = [
  TRUST_SIGNALS.shipping,
  TRUST_SIGNALS.returns,
  TRUST_SIGNALS.warranty,
  TRUST_SIGNALS.support,
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
            <StaggerItem key={feature.id}>
              <div className="border-border hover:border-foreground/15 flex h-full flex-col gap-4 rounded-2xl border p-6 transition-colors">
                <span className="bg-brand/10 text-brand flex size-12 items-center justify-center rounded-xl">
                  <feature.icon className="size-6" aria-hidden />
                </span>
                <div className="flex flex-col gap-1.5">
                  <h3 className="font-semibold">{feature.label}</h3>
                  <p className="text-muted-foreground text-sm text-pretty">{feature.detail}</p>
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </Container>
    </section>
  );
}
