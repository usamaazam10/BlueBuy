'use client';

/**
 * Cart state, persistence and actions — the single source of truth for the
 * shopping cart across the storefront.
 *
 * Design:
 *  - A `useReducer` holds the item list plus transient drawer UI state. Every
 *    mutation is a clamped, snapshot-refreshing reducer case, so quantities can
 *    never exceed stock and re-adding a product picks up its latest price/image.
 *  - Persistence is a two-way sync with localStorage: hydrate once on mount,
 *    then write on every change (after hydration, so we never clobber saved data
 *    with the empty initial state during SSR/first paint).
 *  - Totals are derived, not stored — computed from items + a pluggable
 *    {@link PricingConfig} via the pure engine, memoised for consumers.
 *
 * Consume it with {@link useCart}. Mount {@link CartProvider} once, above any UI
 * that reads the cart (see `src/app/layout.tsx`).
 */
import * as React from 'react';
import type { CartAddable, CartItem, CartTotals, PricingConfig } from '@/types/cart';
import { calculateTotals, countItems } from '@/lib/cart/pricing';
import { DEFAULT_PRICING_CONFIG } from '@/lib/cart/config';
import { clearStoredCart, loadCart, saveCart } from '@/lib/cart/storage';

interface CartState {
  items: CartItem[];
  /** True once localStorage has been read — gates persistence + hydration UI. */
  hydrated: boolean;
  drawerOpen: boolean;
}

type CartAction =
  | { type: 'HYDRATE'; items: CartItem[] }
  | { type: 'ADD'; item: CartAddable; quantity: number }
  | { type: 'REMOVE'; id: string }
  | { type: 'SET_QUANTITY'; id: string; quantity: number }
  | { type: 'CLEAR' }
  | { type: 'OPEN_DRAWER' }
  | { type: 'CLOSE_DRAWER' }
  | { type: 'TOGGLE_DRAWER' };

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/** Build a fresh cart line from a catalogue product. */
function toCartItem(product: CartAddable, quantity: number): CartItem {
  const maxQuantity = Math.max(1, product.stock);
  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    unitPrice: product.price,
    compareAtPrice: product.compareAtPrice,
    image: product.thumbnail || undefined,
    accent: product.accent,
    currency: product.currency ?? 'USD',
    maxQuantity,
    quantity: clamp(quantity, 1, maxQuantity),
  };
}

function reducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'HYDRATE':
      return { ...state, items: action.items, hydrated: true };

    case 'ADD': {
      // Out-of-stock products can't be added.
      if (action.item.stock <= 0) return state;
      const existing = state.items.find((i) => i.id === action.item.id);
      if (existing) {
        // Merge quantities and refresh the snapshot to the latest catalogue data.
        const refreshed = toCartItem(action.item, existing.quantity + action.quantity);
        return {
          ...state,
          items: state.items.map((i) => (i.id === action.item.id ? refreshed : i)),
        };
      }
      return { ...state, items: [...state.items, toCartItem(action.item, action.quantity)] };
    }

    case 'REMOVE':
      return { ...state, items: state.items.filter((i) => i.id !== action.id) };

    case 'SET_QUANTITY': {
      // Setting quantity to 0 (or below) removes the line.
      if (action.quantity <= 0) {
        return { ...state, items: state.items.filter((i) => i.id !== action.id) };
      }
      return {
        ...state,
        items: state.items.map((i) =>
          i.id === action.id ? { ...i, quantity: clamp(action.quantity, 1, i.maxQuantity) } : i
        ),
      };
    }

    case 'CLEAR':
      return { ...state, items: [] };

    case 'OPEN_DRAWER':
      return { ...state, drawerOpen: true };
    case 'CLOSE_DRAWER':
      return { ...state, drawerOpen: false };
    case 'TOGGLE_DRAWER':
      return { ...state, drawerOpen: !state.drawerOpen };

    default:
      return state;
  }
}

interface CartContextValue {
  items: CartItem[];
  totals: CartTotals;
  itemCount: number;
  isEmpty: boolean;
  /** True once the persisted cart has been read (avoids badge/UI flicker). */
  hydrated: boolean;
  drawerOpen: boolean;
  /** Add a product to the cart. `openDrawer` slides the cart open on success. */
  addItem: (product: CartAddable, quantity?: number, options?: { openDrawer?: boolean }) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clear: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
}

const CartContext = React.createContext<CartContextValue | null>(null);

interface CartProviderProps {
  children: React.ReactNode;
  /** Pricing rules (discount/shipping/tax). Defaults to the subtotal-only config. */
  config?: PricingConfig;
}

export function CartProvider({ children, config = DEFAULT_PRICING_CONFIG }: CartProviderProps) {
  const [state, dispatch] = React.useReducer(reducer, {
    items: [],
    hydrated: false,
    drawerOpen: false,
  });

  // Hydrate from localStorage once, after mount (static-export / SSR safe).
  React.useEffect(() => {
    dispatch({ type: 'HYDRATE', items: loadCart() });
  }, []);

  // Persist on every change — but only after hydration, so the empty initial
  // state never overwrites a previously saved cart.
  React.useEffect(() => {
    if (!state.hydrated) return;
    if (state.items.length === 0) {
      clearStoredCart();
    } else {
      saveCart(state.items);
    }
  }, [state.items, state.hydrated]);

  // Keep the browser tab in sync when the cart changes in another tab.
  React.useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key === null || event.key === 'bluebuy.cart.v1') {
        dispatch({ type: 'HYDRATE', items: loadCart() });
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const totals = React.useMemo(() => calculateTotals(state.items, config), [state.items, config]);
  const itemCount = React.useMemo(() => countItems(state.items), [state.items]);

  const value = React.useMemo<CartContextValue>(
    () => ({
      items: state.items,
      totals,
      itemCount,
      isEmpty: state.items.length === 0,
      hydrated: state.hydrated,
      drawerOpen: state.drawerOpen,
      addItem: (product, quantity = 1, options) => {
        dispatch({ type: 'ADD', item: product, quantity });
        if (options?.openDrawer && product.stock > 0) dispatch({ type: 'OPEN_DRAWER' });
      },
      removeItem: (id) => dispatch({ type: 'REMOVE', id }),
      updateQuantity: (id, quantity) => dispatch({ type: 'SET_QUANTITY', id, quantity }),
      clear: () => dispatch({ type: 'CLEAR' }),
      openDrawer: () => dispatch({ type: 'OPEN_DRAWER' }),
      closeDrawer: () => dispatch({ type: 'CLOSE_DRAWER' }),
      toggleDrawer: () => dispatch({ type: 'TOGGLE_DRAWER' }),
    }),
    [state.items, state.hydrated, state.drawerOpen, totals, itemCount]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

/** Access the cart API. Must be used within a {@link CartProvider}. */
export function useCart(): CartContextValue {
  const ctx = React.useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a <CartProvider>');
  return ctx;
}
