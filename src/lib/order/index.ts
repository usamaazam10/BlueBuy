/**
 * Barrel export for order domain helpers (pricing config, status metadata,
 * WhatsApp handoff). Import from `@/lib/order`.
 */
export { CHECKOUT_PRICING_CONFIG } from './config';
export {
  ORDER_STATUS_META,
  type OrderStatusMeta,
  orderStatusLabel,
  nextStatuses,
  canTransition,
  isTerminalStatus,
} from './status';
export { buildWhatsAppMessage, buildWhatsAppUrl } from './whatsapp';
