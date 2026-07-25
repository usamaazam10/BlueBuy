import type { Metadata } from 'next';
import { CheckoutView } from '@/components/checkout';

export const metadata: Metadata = {
  title: 'Checkout',
  description: 'Enter your delivery details to place your BlueBuy order.',
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return <CheckoutView />;
}
