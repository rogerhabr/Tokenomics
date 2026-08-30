import { NextResponse } from 'next/server';
import { createPublicClient } from '@/lib/supabase/public';

/**
 * Serves a lot's certificate of analysis from our own origin.
 *
 * The file lives in a private Storage bucket whose read policy joins back to
 * `lots.published`, so this route does not decide who may see a certificate —
 * the database does. Unpublishing a lot revokes its certificate in the same
 * action, with no second switch to forget.
 *
 * It is proxied rather than redirected for two reasons: the URL a buyer copies
 * stays first-party and permanent, and no third-party storage origin appears in
 * the page or in their history. That matters on a site whose argument is that
 * the record is checkable — a certificate URL that expires or points somewhere
 * unfamiliar undermines it.
 */
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: { lot: string } }
) {
  const lotCode = decodeURIComponent(params.lot);

  // Returns null rather than throwing when the environment is unconfigured, so
  // a preview deploy without env vars degrades instead of erroring.
  const supabase = createPublicClient();
  if (!supabase) {
    return new NextResponse('Certificate lookup is not configured.', { status: 503 });
  }

  // The session-free client is governed by the same RLS as any other reader, so
  // an unpublished lot simply does not come back.
  const { data: lot, error } = await supabase
    .from('lots')
    .select('coa_path, lot_code')
    .eq('lot_code', lotCode)
    .maybeSingle();

  if (error) {
    return new NextResponse('Certificate lookup failed.', { status: 502 });
  }
  if (!lot?.coa_path) {
    return new NextResponse('No certificate is published for this lot.', { status: 404 });
  }

  const { data: file, error: downloadError } = await supabase.storage
    .from('certificates')
    .download(lot.coa_path);

  if (downloadError || !file) {
    return new NextResponse('No certificate is published for this lot.', { status: 404 });
  }

  return new NextResponse(file, {
    headers: {
      'Content-Type': 'application/pdf',
      // Inline: a certificate is meant to be read, and a forced download is a
      // worse experience for the one document the buyer came to check.
      'Content-Disposition': `inline; filename="${lot.lot_code.replace(/[^A-Za-z0-9._-]/g, '_')}.pdf"`,
      // Certificates are immutable once published, but the row's published flag
      // is not — so this is cached briefly and revalidated rather than pinned.
      'Cache-Control': 'public, max-age=300, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
