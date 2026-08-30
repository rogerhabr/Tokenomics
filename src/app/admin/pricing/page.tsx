import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin, STANDARD_VIAL_SIZES_MG } from '@/lib/admin';
import { PRODUCTS } from '@/lib/products';
import PricingEditor, { type EditorRow } from '@/components/admin/PricingEditor';

export const metadata: Metadata = { title: 'Pricing — Axis Labs administration' };

// Prices must never be served from a cache on the page that edits them.
export const dynamic = 'force-dynamic';

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-axis-rule-3 bg-axis-sunk p-[26px]">
      <h1 className="t-6 text-axis-ink">{title}</h1>
      <p className="t-3 mt-[13px] max-w-measure text-axis-ink-500">{body}</p>
      <p className="t-3 mt-[20px]">
        <Link href="/login" className="text-axis-ink underline underline-offset-[4px]">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default async function AdminPricingPage() {
  const admin = await requireAdmin();

  if (!admin.ok) {
    if (admin.reason === 'unconfigured') {
      return (
        <Notice
          title="Supabase is not configured."
          body="This deployment has no database credentials, so prices cannot be read or changed here. The storefront is running on the prices compiled into the repository."
        />
      );
    }
    if (admin.reason === 'signed-out') {
      return <Notice title="Sign in required." body="This page is for administrators only." />;
    }
    return (
      <Notice
        title="Administrator access required."
        body="Your account is signed in but does not have the admin role. Ask an existing administrator to set profiles.role to 'admin' for your user."
      />
    );
  }

  const supabase = createClient();
  // The admin select policy returns retired sizes too, which is the point —
  // this is the only place a deactivated row can be brought back.
  const { data, error } = await supabase
    .from('product_variants')
    .select('id, product_slug, label, size_mg, price_cents, kit_size, kit_price_cents, active, sort_order')
    .order('product_slug', { ascending: true })
    .order('sort_order', { ascending: true });

  if (error) {
    return (
      <Notice
        title="Could not read the price list."
        body="The product_variants table may not exist or may not carry the kit columns yet. Migrations apply on deploy once SUPABASE_DB_URL is set; you can also run npm run migrate directly."
      />
    );
  }

  const rows: EditorRow[] = (data ?? []).map((r) => ({
    id: r.id as string,
    productSlug: r.product_slug as string,
    label: r.label as string,
    sizeMg: r.size_mg === null ? null : Number(r.size_mg),
    priceCents: r.price_cents as number,
    kitPriceCents: r.kit_price_cents === null ? null : (r.kit_price_cents as number),
    kitSize: (r.kit_size as number | null) ?? 10,
    active: r.active as boolean,
  }));

  const products = PRODUCTS.map((p) => ({ slug: p.slug, name: p.name }));

  return (
    <>
      <h1 className="t-7 text-axis-ink">Pricing</h1>
      <p className="t-4 mt-[20px] max-w-measure text-axis-ink-500">
        Every compound, every concentration, the price of a single vial and the price of a
        ten-vial kit. Clear a kit price to sell that size as single vials only. Changes take
        effect on the storefront immediately — the product pages are purged from cache when
        you save.
      </p>
      <div className="spec-rule mt-[26px]" />

      <PricingEditor
        rows={rows}
        products={products}
        standardSizes={[...STANDARD_VIAL_SIZES_MG]}
      />
    </>
  );
}
