import { Container } from '@/components/layout/container';
import { TRUST_SIGNALS } from '@/components/common/trust-signals';

/** The four claims under the hero — all from the canonical {@link TRUST_SIGNALS}. */
const SIGNALS = [
  TRUST_SIGNALS.curated,
  TRUST_SIGNALS.collection,
  TRUST_SIGNALS.support,
  TRUST_SIGNALS.noPayment,
];

/**
 * A slim reassurance bar directly under the hero — the marketplace "why buy
 * here" strip, sourced from the canonical claims so it never contradicts the
 * product page, cart or checkout.
 */
export function TrustStrip() {
  return (
    <section className="py-4" aria-label="Why shop with us">
      <Container>
        <ul className="border-border bg-border grid grid-cols-2 gap-px overflow-hidden rounded-2xl border lg:grid-cols-4">
          {SIGNALS.map((signal) => (
            <li key={signal.id} className="bg-card flex items-center gap-3 p-3.5 sm:p-4">
              <span className="bg-brand/10 text-brand flex size-10 shrink-0 items-center justify-center rounded-xl sm:size-11">
                <signal.icon className="size-5" aria-hidden />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-sm leading-tight font-semibold">{signal.label}</span>
                <span className="text-muted-foreground hidden truncate text-xs sm:block">
                  {signal.detail}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
