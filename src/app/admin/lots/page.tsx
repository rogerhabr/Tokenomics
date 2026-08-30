import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin';
import { PRODUCTS } from '@/lib/products';
import { RELEASE_SPEC_PCT } from '@/lib/lots';
import LotEditor, { type LotRow } from '@/components/admin/LotEditor';

export const metadata: Metadata = { title: 'Lot register — Axis Labs administration' };

// The register must never be served from a cache on the page that edits it.
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

export default async function AdminLotsPage() {
  const admin = await requireAdmin();

  if (!admin.ok) {
    if (admin.reason === 'unconfigured') {
      return (
        <Notice
          title="Supabase is not configured."
          body="This deployment has no database credentials, so the lot register cannot be read or written here. The storefront is rendering its empty state."
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
  // The admin select policy returns unpublished rows as well — reviewing a lot
  // before it is public is the main reason this page exists.
  const { data, error } = await supabase
    .from('lots')
    .select('*')
    .order('assay_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  return (
    <>
      <h1 className="t-7 text-axis-ink">Lot register</h1>
      <div className="spec-rule mt-[26px]" />
      <p className="t-3 mt-[26px] max-w-measure text-axis-ink-500">
        Every batch assayed, including the ones that failed. Releases, retentions and rejections
        all live in the same table — a register that only carries passes is not evidence of
        anything. Certificates attach here and are served from this site, never a third-party
        link, and a certificate is exactly as public as the lot it belongs to.
      </p>

      {error ? (
        <p className="t-3 mt-[26px] text-axis-rejected">
          The register could not be read: {error.message}. If this deployment has not run
          <span className="data"> 0004_lots.sql</span> and
          <span className="data"> 0007_lot_certificates.sql</span>, run them first.
        </p>
      ) : (
        <LotEditor
          initialLots={(data ?? []) as LotRow[]}
          products={PRODUCTS.map((p) => ({ slug: p.slug, name: p.name }))}
          specPct={RELEASE_SPEC_PCT}
        />
      )}
    </>
  );
}
