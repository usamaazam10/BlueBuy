/**
 * WhatsApp order handoff.
 *
 * This is a no-online-payment flow: after placing an order the customer is
 * offered a one-tap WhatsApp message to the store to arrange payment/delivery.
 * We build a pre-filled `wa.me` deep link containing the order number, the
 * customer's name and phone, an itemised list and the total — everything the
 * store needs to pick up the conversation without looking anything up.
 *
 * The store number is supplied by the caller — components read it from the CMS
 * (`site_settings.whatsappNumber`) via `useWhatsApp()`, so an admin can change
 * it without a rebuild. `env.storeWhatsApp` (`NEXT_PUBLIC_STORE_WHATSAPP`) is
 * only the fallback for settings docs that predate the CMS field.
 */
import { env } from '@/lib/env';
import { formatPrice } from '@/lib/format';
import type { Order } from '@/types/order';

/** Build the plain-text WhatsApp message body for an order. */
export function buildWhatsAppMessage(order: Order): string {
  const lines = order.items
    .map(
      (item) =>
        `• ${item.title} × ${item.quantity} — ${formatPrice(item.lineTotal, order.currency)}`
    )
    .join('\n');

  return [
    `Hi! I'd like to confirm my BlueBuy order.`,
    ``,
    `Order: ${order.orderId}`,
    `Name: ${order.customer.fullName}`,
    `Phone: ${order.customer.phone}`,
    ``,
    `Items:`,
    lines,
    ``,
    `Total: ${formatPrice(order.total, order.currency)}`,
  ].join('\n');
}

/**
 * Build the full `https://wa.me/…` link for an order, with the message
 * pre-filled and URL-encoded. Opens the store's WhatsApp chat when followed.
 */
export function buildWhatsAppUrl(order: Order, storeNumber?: string): string {
  const number = (storeNumber || env.storeWhatsApp).replace(/\D/g, '');
  const text = encodeURIComponent(buildWhatsAppMessage(order));
  return `https://wa.me/${number}?text=${text}`;
}
