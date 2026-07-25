import type { Metadata } from 'next';
import { CartView } from '@/components/cart/cart-view';

export const metadata: Metadata = {
  title: 'Cart',
  description: 'Review the items in your BlueBuy shopping cart.',
};

export default function CartPage() {
  return <CartView />;
}
