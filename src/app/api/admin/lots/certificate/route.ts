import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import * as Sentry from '@sentry/nextjs';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin';

/**
 * Uploads a certificate of analysis and attaches it to a lot.
 *
 * The file is stored under the lot's id rather than its lot code, so renaming a
 * lot code never orphans its certificate, and a code containing a slash or a
 * space cannot escape the intended prefix.
 *
 * Only PDFs are accepted. A certificate is a document of record; accepting an
 * image would invite a screenshot of one, which is not the same thing and
 * cannot be text-searched or verified.
 */

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB — generous for a scanned CoA.
const PDF_MAGIC = '%PDF-';

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.reason }, { status: admin.reason === 'unconfigured' ? 503 : 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Expected a multipart form.' }, { status: 400 });
  }

  const lotId = String(form.get('lotId') ?? '').trim();
  const file = form.get('file');

  if (!lotId) return NextResponse.json({ error: 'A lot id is required.' }, { status: 400 });
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'Attach a PDF certificate.' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'That file is larger than 10 MB.' }, { status: 413 });
  }

  const bytes = await file.arrayBuffer();

  // Check the magic number, not the declared MIME type or the extension —
  // both are supplied by the client and neither is evidence of anything.
  const head = new TextDecoder('latin1').decode(bytes.slice(0, 5));
  if (head !== PDF_MAGIC) {
    return NextResponse.json({ error: 'That file is not a PDF.' }, { status: 415 });
  }

  const supabase = createClient();

  const { data: lot, error: lotError } = await supabase
    .from('lots')
    .select('id, product_slug, coa_path')
    .eq('id', lotId)
    .maybeSingle();

  if (lotError || !lot) {
    return NextResponse.json({ error: 'That lot does not exist.' }, { status: 404 });
  }

  const path = `${lot.id}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from('certificates')
    .upload(path, bytes, { contentType: 'application/pdf', upsert: true });

  if (uploadError) {
    Sentry.captureException(uploadError);
    return NextResponse.json({ error: 'Could not store the certificate.' }, { status: 500 });
  }

  const { error: updateError } = await supabase
    .from('lots')
    .update({ coa_path: path })
    .eq('id', lot.id);

  if (updateError) {
    Sentry.captureException(updateError);
    return NextResponse.json({ error: 'The file uploaded but the lot could not be updated.' }, { status: 500 });
  }

  revalidatePath('/lots');
  revalidatePath(`/products/${lot.product_slug}`);
  return NextResponse.json({ ok: true, coa_path: path }, { status: 201 });
}

export async function DELETE(request: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.reason }, { status: admin.reason === 'unconfigured' ? 503 : 403 });
  }

  const lotId = String(new URL(request.url).searchParams.get('lotId') ?? '').trim();
  if (!lotId) return NextResponse.json({ error: 'A lot id is required.' }, { status: 400 });

  const supabase = createClient();
  const { data: lot } = await supabase
    .from('lots')
    .select('id, product_slug, coa_path')
    .eq('id', lotId)
    .maybeSingle();

  if (!lot) return NextResponse.json({ error: 'That lot does not exist.' }, { status: 404 });

  if (lot.coa_path) {
    await supabase.storage.from('certificates').remove([lot.coa_path]);
  }
  const { error } = await supabase.from('lots').update({ coa_path: null }).eq('id', lot.id);
  if (error) {
    Sentry.captureException(error);
    return NextResponse.json({ error: 'Could not detach the certificate.' }, { status: 500 });
  }

  revalidatePath('/lots');
  revalidatePath(`/products/${lot.product_slug}`);
  return NextResponse.json({ ok: true });
}
