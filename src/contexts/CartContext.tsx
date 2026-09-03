'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getVariant } from '@/lib/products';
import { mgFromLabel, type PricedVariant } from '@/lib/pricing';

const STORAGE_KEY = 'axis-labs-cart-v1';

/**
 * Prices live in the database so an administrator can change them without a
 * deploy, but the order tray runs in the browser and needs them to show a
 * subtotal. So the provider fetches the public price list once and resolves
 * against it, falling back to the compiled-in catalogue until it arrives (and
 * permanently, if the request fails).
 *
 * This only affects what is DISPLAYED. /api/orders re-prices every line from
 * the database when the order is placed, so a stale tab cannot buy at an old
 * price.
 */
type PriceBook = Record<string, PricedVariant[]>;

/** Only the variant id and quantity are persisted — names and prices are
 *  always re-read from the catalogue, so a price change never leaves a stale
 *  amount sitting in someone's saved cart. */
export type CartLine = { variantId: string; quantity: number };

export type ResolvedLine = {
  variantId: string;
  quantity: number;
  productSlug: string;
  productName: string;
  variantLabel: string;
  unitPriceCents: number;
  /** Total milligrams, for the $/mg figure. Null where mass isn't a number. */
  sizeMg: number | null;
  lineTotalCents: number;
};

type CartCtx = {
  lines: CartLine[];
  resolved: ResolvedLine[];
  itemCount: number;
  subtotalCents: number;
  drawerOpen: boolean;
  /** True once the persisted cart has been read, so the UI can avoid rendering
   *  an empty cart on the server and a full one on hydration. */
  hydrated: boolean;
  add: (variantId: string, quantity?: number) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
  setDrawerOpen: (open: boolean) => void;
};

const Ctx = createContext<CartCtx | null>(null);

const MAX_QTY = 99;

function readStored(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Drop anything that no longer resolves against the catalogue (a compound
    // discontinued since the cart was saved).
    return parsed
      .filter(
        (l): l is CartLine =>
          !!l &&
          typeof (l as CartLine).variantId === 'string' &&
          Number.isFinite((l as CartLine).quantity)
      )
      .map((l) => ({ variantId: l.variantId, quantity: Math.min(MAX_QTY, Math.max(1, Math.round(l.quantity))) }))
      .filter((l) => !!getVariant(l.variantId));
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [priceBook, setPriceBook] = useState<PriceBook | null>(null);

  useEffect(() => {
    setLines(readStored());
    setHydrated(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/catalogue')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled && json?.variants) setPriceBook(json.variants as PriceBook);
      })
      .catch(() => {
        // Keep the compiled-in prices. A failed price-list fetch must not empty
        // someone's order.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // A full or blocked localStorage must not break checkout.
    }
  }, [lines, hydrated]);

  const add = useCallback((variantId: string, quantity = 1) => {
    if (!getVariant(variantId)) return;
    setLines((prev) => {
      const existing = prev.find((l) => l.variantId === variantId);
      if (existing) {
        return prev.map((l) =>
          l.variantId === variantId
            ? { ...l, quantity: Math.min(MAX_QTY, l.quantity + quantity) }
            : l
        );
      }
      return [...prev, { variantId, quantity: Math.min(MAX_QTY, Math.max(1, quantity)) }];
    });
  }, []);

  const setQuantity = useCallback((variantId: string, quantity: number) => {
    setLines((prev) =>
      quantity <= 0
        ? prev.filter((l) => l.variantId !== variantId)
        : prev.map((l) =>
            l.variantId === variantId
              ? { ...l, quantity: Math.min(MAX_QTY, Math.round(quantity)) }
              : l
          )
    );
  }, []);

  const remove = useCallback((variantId: string) => {
    setLines((prev) => prev.filter((l) => l.variantId !== variantId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const resolved = useMemo<ResolvedLine[]>(
    () =>
      lines.flatMap((line) => {
        const found = getVariant(line.variantId);
        if (!found) return [];
        const { product } = found;

        // The live list wins where it has the variant; the compiled catalogue
        // covers the window before it loads and the case where it never does.
        const live = priceBook?.[product.slug]?.find((v) => v.id === line.variantId);
        const variant: PricedVariant = live ?? {
          ...found.variant,
          sizeMg: mgFromLabel(found.variant.label),
        };

        return [
          {
            variantId: line.variantId,
            quantity: line.quantity,
            productSlug: product.slug,
            productName: product.name,
            variantLabel: variant.label,
            unitPriceCents: variant.priceCents,
            sizeMg: variant.sizeMg,
            lineTotalCents: variant.priceCents * line.quantity,
          },
        ];
      }),
    [lines, priceBook]
  );

  const itemCount = useMemo(() => resolved.reduce((n, l) => n + l.quantity, 0), [resolved]);
  const subtotalCents = useMemo(
    () => resolved.reduce((n, l) => n + l.lineTotalCents, 0),
    [resolved]
  );

  const value = useMemo(
    () => ({
      lines,
      resolved,
      itemCount,
      subtotalCents,
      drawerOpen,
      hydrated,
      add,
      setQuantity,
      remove,
      clear,
      setDrawerOpen,
    }),
    [lines, resolved, itemCount, subtotalCents, drawerOpen, hydrated, add, setQuantity, remove, clear]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart(): CartCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCart must be used inside a CartProvider');
  return ctx;
}
