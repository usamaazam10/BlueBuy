'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, Loader2, ShoppingBag } from 'lucide-react';
import { useCart } from '@/context/cart-context';
import { usePlaceOrder } from '@/hooks/queries';
import { useCurrency } from '@/hooks/use-currency';
import { Container } from '@/components/layout/container';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { CartSummary } from '@/components/cart/cart-summary';
import { TrustSignals } from '@/components/common/trust-signals';
import { calculateTotals } from '@/lib/cart/pricing';
import { CHECKOUT_PRICING_CONFIG } from '@/lib/order';
import { checkoutCustomerSchema } from '@/lib/validations';
import { toAppError } from '@/firebase';
import { OrderSuccess } from './order-success';
import type { Order } from '@/types/order';

/** Shape of the controlled form; all fields are strings (raw input values). */
interface FormState {
  fullName: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  fullName: '',
  phone: '',
  email: '',
  city: '',
  address: '',
  notes: '',
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

/** A labelled storefront field with an inline error line. */
function Field({
  id,
  label,
  error,
  optional,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {optional && <span className="text-muted-foreground font-normal"> (optional)</span>}
        {!optional && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-destructive flex items-center gap-1 text-xs" role="alert">
          <AlertCircle className="size-3.5" /> {error}
        </p>
      )}
    </div>
  );
}

/**
 * Checkout page: a validated delivery-details form beside a live order summary.
 * On submit it prices the cart with the checkout config, places the order (which
 * decrements stock atomically), clears the cart and shows the success screen.
 *
 * There is no online payment — this collects contact/delivery details for a
 * manual/cash-on-delivery flow, with a WhatsApp handoff on success.
 */
export function CheckoutView() {
  const { items, isEmpty, hydrated, clear } = useCart();
  const placeOrder = usePlaceOrder();
  const { currency, formatPrice } = useCurrency();

  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [placedOrder, setPlacedOrder] = React.useState<Order | null>(null);

  // Totals include shipping (the cart itself is subtotal-only).
  const totals = React.useMemo(() => calculateTotals(items, CHECKOUT_PRICING_CONFIG), [items]);

  const setField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    // Clear a field's error as the user corrects it.
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitError(null);

    const parsed = checkoutCustomerSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FormState;
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    try {
      // Stamp the store's current currency so the order is a faithful record of
      // what the customer was quoted, even if the setting changes later.
      const order = await placeOrder.mutateAsync({ customer: parsed.data, items, currency });
      clear();
      setPlacedOrder(order);
      // Scroll to top so the success screen is in view.
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setSubmitError(toAppError(error).message);
    }
  }

  // Success — replace the whole view with the confirmation screen.
  if (placedOrder) {
    return <OrderSuccess order={placedOrder} />;
  }

  // Avoid a flash of the empty state before localStorage has been read.
  if (!hydrated) {
    return (
      <Container className="py-20">
        <div className="text-muted-foreground animate-pulse text-sm">Loading checkout…</div>
      </Container>
    );
  }

  if (isEmpty) {
    return (
      <Container className="py-16 sm:py-24">
        <div className="mx-auto flex max-w-md flex-col items-center text-center">
          <span className="border-border bg-secondary text-muted-foreground flex size-14 items-center justify-center rounded-2xl border">
            <ShoppingBag className="size-6" />
          </span>
          <h1 className="mt-5 text-2xl font-semibold">Your cart is empty</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Add a few items before heading to checkout.
          </p>
          <Button asChild variant="brand" size="lg" className="mt-6">
            <Link href="/products">Browse products</Link>
          </Button>
        </div>
      </Container>
    );
  }

  const submitting = placeOrder.isPending;

  return (
    <Container className="py-12 sm:py-16">
      <div className="mb-8">
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground mb-3 -ml-3">
          <Link href="/cart">
            <ArrowLeft className="size-4" /> Back to cart
          </Link>
        </Button>
        <h1 className="text-3xl font-semibold sm:text-4xl">Checkout</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Enter your delivery details — no payment is taken online. We&apos;ll confirm your order
          directly.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_360px]">
          {/* Delivery details */}
          <div className="flex flex-col gap-5">
            <h2 className="text-lg font-semibold">Delivery details</h2>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field id="fullName" label="Full name" error={errors.fullName}>
                <Input
                  id="fullName"
                  name="name"
                  autoComplete="name"
                  value={form.fullName}
                  onChange={(e) => setField('fullName', e.target.value)}
                  placeholder="Jane Cooper"
                  aria-invalid={Boolean(errors.fullName)}
                />
              </Field>
              <Field id="phone" label="Phone number" error={errors.phone}>
                <Input
                  id="phone"
                  name="tel"
                  type="tel"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={(e) => setField('phone', e.target.value)}
                  placeholder="+1 555 123 4567"
                  aria-invalid={Boolean(errors.phone)}
                />
              </Field>
            </div>

            <Field id="email" label="Email" optional error={errors.email}>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
                placeholder="jane@example.com"
                aria-invalid={Boolean(errors.email)}
              />
            </Field>

            <Field id="city" label="City" error={errors.city}>
              <Input
                id="city"
                name="city"
                autoComplete="address-level2"
                value={form.city}
                onChange={(e) => setField('city', e.target.value)}
                placeholder="San Francisco"
                aria-invalid={Boolean(errors.city)}
              />
            </Field>

            <Field id="address" label="Complete address" error={errors.address}>
              <Textarea
                id="address"
                name="street-address"
                autoComplete="street-address"
                value={form.address}
                onChange={(e) => setField('address', e.target.value)}
                placeholder="Street address, apartment, landmark…"
                className="min-h-24"
                aria-invalid={Boolean(errors.address)}
              />
            </Field>

            <Field id="notes" label="Order notes" optional error={errors.notes}>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
                placeholder="Delivery instructions, preferred time, etc."
                className="min-h-20"
              />
            </Field>
          </div>

          {/* Order summary */}
          <aside className="h-fit lg:sticky lg:top-24">
            <div className="bg-card border-border rounded-2xl border p-6">
              <h2 className="mb-4 text-lg font-semibold">Order summary</h2>

              <ul className="divide-border border-border mb-4 divide-y border-b">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm"
                  >
                    <span className="text-foreground min-w-0 truncate">
                      {item.title}
                      <span className="text-muted-foreground"> × {item.quantity}</span>
                    </span>
                    <span className="tabular-nums">
                      {formatPrice(item.unitPrice * item.quantity)}
                    </span>
                  </li>
                ))}
              </ul>

              <CartSummary totals={totals}>
                {submitError && (
                  <div className="border-destructive/30 bg-destructive/10 text-destructive mt-1 flex items-start gap-2 rounded-xl border p-3 text-xs">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}
                <Button
                  type="submit"
                  variant="brand"
                  size="lg"
                  className="mt-2 w-full"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Placing order…
                    </>
                  ) : (
                    <>Place order</>
                  )}
                </Button>
                <p className="text-muted-foreground text-center text-xs">
                  No online payment — we&apos;ll confirm your order and arrange delivery.
                </p>
                <TrustSignals
                  variant="list"
                  items={['noPayment', 'support']}
                  className="border-border mt-4 border-t pt-4"
                />
              </CartSummary>
            </div>
          </aside>
        </div>
      </form>
    </Container>
  );
}
