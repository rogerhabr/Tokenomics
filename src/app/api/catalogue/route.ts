import { NextResponse } from 'next/server';
import { getAllVariants } from '@/lib/variants';

/**
 * The public price list.
 *
 * The order tray lives in the visitor's browser, so it needs prices on the
 * client to show a running subtotal. Everything server-rendered (the register,
 * the product page) reads the database directly and does not use this route.
 *
 * It is deliberately read-only and contains nothing that is not already
 * printed on the product pages. The authoritative price is still the one
 * /api/orders computes at checkout — this endpoint informs the display, it
 * never sets what is charged.
 */
export const revalidate = 300;

export async function GET() {
  const variants = await getAllVariants();
  return NextResponse.json(
    { variants },
    {
      headers: {
        // Short cache: a price change should reach open tabs within minutes,
        // and the payload is small enough that revalidating is cheap.
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    }
  );
}
