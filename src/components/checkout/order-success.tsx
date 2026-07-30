'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Clock, MessageCircle } from 'lucide-react';
import type { Order } from '@/types/order';
import { Container } from '@/components/layout/container';
import { Button } from '@/components/ui/button';
import { useCurrency } from '@/hooks/use-currency';
import { ESTIMATED_PROCESSING, buildWhatsAppUrl } from '@/lib/order';

/**
 * Post-checkout confirmation screen. Purely presentational — it receives the
 * placed {@link Order} and shows the order number, an estimated processing
 * window, a line summary, and the two next-step actions: keep shopping, or hand
 * the order off to the store on WhatsApp (a pre-filled message; see
 * `@/lib/order/whatsapp`). No online payment is involved.
 */
export function OrderSuccess({ order }: { order: Order }) {
  const whatsAppUrl = buildWhatsAppUrl(order);
  const { formatPrice } = useCurrency();
  const money = (value: number) => formatPrice(value, order.currency);

  return (
    <Container className="py-12 sm:py-16">
      <div className="mx-auto max-w-xl">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center text-center"
        >
          <span className="flex size-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-8" />
          </span>
          <h1 className="mt-5 text-3xl font-semibold sm:text-4xl">Order successful</h1>
          <p className="text-muted-foreground mt-2 text-sm text-pretty">
            Thanks, {order.customer.fullName.split(' ')[0]}! We&apos;ve received your order and will
            be in touch shortly to confirm delivery.
          </p>
        </motion.div>

        {/* Order number + processing */}
        <div className="border-border bg-card mt-8 rounded-2xl border p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Order number
              </p>
              <p className="text-foreground mt-1 font-mono text-lg font-semibold">
                {order.orderId}
              </p>
            </div>
            <div className="text-right">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Estimated processing
              </p>
              <p className="text-foreground mt-1 inline-flex items-center gap-1.5 text-sm font-medium">
                <Clock className="size-4" /> {ESTIMATED_PROCESSING}
              </p>
            </div>
          </div>

          {/* Items */}
          <ul className="divide-border border-border mt-5 divide-y border-t pt-2">
            {order.items.map((item) => (
              <li
                key={item.productId}
                className="flex items-center justify-between gap-4 py-2.5 text-sm"
              >
                <span className="text-foreground min-w-0 truncate">
                  {item.title}
                  <span className="text-muted-foreground"> × {item.quantity}</span>
                </span>
                <span className="tabular-nums">{money(item.lineTotal)}</span>
              </li>
            ))}
          </ul>

          <div className="border-border mt-2 flex items-center justify-between border-t pt-3">
            <span className="font-semibold">Total</span>
            <span className="text-base font-semibold tabular-nums">{money(order.total)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button
            asChild
            size="lg"
            className="flex-1 bg-[#25D366] text-white hover:bg-[#1eb455] dark:text-white"
          >
            <a href={whatsAppUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="size-4" /> Contact on WhatsApp
            </a>
          </Button>
          <Button asChild variant="outline" size="lg" className="flex-1">
            <Link href="/products">
              Continue shopping <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>

        <p className="text-muted-foreground mt-6 text-center text-xs">
          Keep your order number handy — you&apos;ll need it if you contact us about this order.
        </p>
      </div>
    </Container>
  );
}
