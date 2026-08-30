'use client';

import { useMemo, useState } from 'react';

export type LotRow = {
  id: string;
  lot_code: string;
  product_slug: string;
  vial_size: string | null;
  receipt_date: string | null;
  assay_date: string | null;
  hplc_purity_pct: string | number | null;
  method: string | null;
  ms_result: string | null;
  lab_legal_name: string | null;
  lab_accreditation_body: string | null;
  lab_accreditation_number: string | null;
  report_number: string | null;
  verify_url: string | null;
  coa_path: string | null;
  status: 'released' | 'retained' | 'rejected';
  published: boolean;
};

type ProductOption = { slug: string; name: string };

const field =
  'border border-axis-rule-3 bg-axis-paper px-[10px] py-[7px] t-2 text-axis-ink outline-none focus-visible:border-axis-ink';
const label = 'flex flex-col gap-[6px]';
const labelText = 't-1 text-axis-ink-300';

const STATUSES = ['released', 'retained', 'rejected'] as const;

const BLANK = {
  lot_code: '',
  product_slug: '',
  vial_size: '',
  receipt_date: '',
  assay_date: '',
  hplc_purity_pct: '',
  method: '',
  ms_result: '',
  lab_legal_name: '',
  lab_accreditation_body: '',
  lab_accreditation_number: '',
  report_number: '',
  verify_url: '',
  status: 'released' as (typeof STATUSES)[number],
};

/**
 * The register's write surface.
 *
 * Two things here are deliberate rather than incidental:
 *
 * 1. **Publishing is a separate, explicit action from saving.** A lot is
 *    transcribed, checked against the certificate in hand, and only then made
 *    public. Conflating the two would make a typo instantly visible on the
 *    storefront.
 *
 * 2. **Nothing is prefilled with a plausible value.** No example lot codes, no
 *    default purity. An administrator transcribing from a certificate should
 *    never be editing around a number the software invented.
 */
export default function LotEditor({
  initialLots,
  products,
  specPct,
}: {
  initialLots: LotRow[];
  products: ProductOption[];
  specPct: number;
}) {
  const [lots, setLots] = useState<LotRow[]>(initialLots);
  const [draft, setDraft] = useState({ ...BLANK, product_slug: products[0]?.slug ?? '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState<'idle' | 'ok' | 'error'>('idle');

  const productName = useMemo(
    () => Object.fromEntries(products.map((p) => [p.slug, p.name])),
    [products]
  );

  function say(text: string, kind: 'ok' | 'error') {
    setMessage(text);
    setTone(kind);
  }

  async function send(method: 'POST' | 'PATCH' | 'DELETE', body?: unknown, query = '') {
    const res = await fetch(`/api/admin/lots${query}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? 'That did not work.');
    return json;
  }

  async function refresh() {
    const res = await fetch('/api/admin/lots');
    if (res.ok) setLots((await res.json()).lots ?? []);
  }

  async function create() {
    setBusy(true);
    try {
      await send('POST', { ...draft, published: false });
      setDraft({ ...BLANK, product_slug: products[0]?.slug ?? '' });
      await refresh();
      say('Lot recorded. It is not public until you publish it.', 'ok');
    } catch (e) {
      say(e instanceof Error ? e.message : 'Could not save.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, values: Record<string, unknown>, note: string) {
    setBusy(true);
    try {
      await send('PATCH', { id, ...values });
      await refresh();
      say(note, 'ok');
    } catch (e) {
      say(e instanceof Error ? e.message : 'Could not update.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string, code: string) {
    if (!window.confirm(`Delete lot ${code}? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await send('DELETE', undefined, `?id=${encodeURIComponent(id)}`);
      await refresh();
      say('Lot deleted.', 'ok');
    } catch (e) {
      say(e instanceof Error ? e.message : 'Could not delete.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function uploadCertificate(id: string, file: File) {
    setBusy(true);
    try {
      const form = new FormData();
      form.append('lotId', id);
      form.append('file', file);
      const res = await fetch('/api/admin/lots/certificate', { method: 'POST', body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Upload failed.');
      await refresh();
      say('Certificate attached.', 'ok');
    } catch (e) {
      say(e instanceof Error ? e.message : 'Upload failed.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function detachCertificate(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/lots/certificate?lotId=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not remove.');
      await refresh();
      say('Certificate removed.', 'ok');
    } catch (e) {
      say(e instanceof Error ? e.message : 'Could not remove.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-[39px]">
      {/* ---- Record a lot ---- */}
      <section className="border border-axis-rule-3 bg-axis-sunk p-[20px]">
        <h2 className="t-1 text-axis-ink-300">Record a lot</h2>
        <p className="t-2 mt-[10px] max-w-measure text-axis-ink-500">
          Transcribe from the certificate. Nothing here is published until you publish it, and
          nothing is prefilled — every figure should come off the document in front of you.
        </p>

        <div className="mt-[20px] grid gap-[13px] sm:grid-cols-2 lg:grid-cols-3">
          <label className={label}>
            <span className={labelText}>Lot code (as printed on the vial)</span>
            <input
              value={draft.lot_code}
              onChange={(e) => setDraft({ ...draft, lot_code: e.target.value })}
              className={field}
            />
          </label>

          <label className={label}>
            <span className={labelText}>Compound</span>
            <select
              value={draft.product_slug}
              onChange={(e) => setDraft({ ...draft, product_slug: e.target.value })}
              className={field}
            >
              {products.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <label className={label}>
            <span className={labelText}>Vial size</span>
            <input
              value={draft.vial_size}
              onChange={(e) => setDraft({ ...draft, vial_size: e.target.value })}
              className={field}
            />
          </label>

          <label className={label}>
            <span className={labelText}>Assayed purity (%)</span>
            <input
              inputMode="decimal"
              value={draft.hplc_purity_pct}
              onChange={(e) => setDraft({ ...draft, hplc_purity_pct: e.target.value })}
              className={field}
            />
          </label>

          <label className={label}>
            <span className={labelText}>Status</span>
            <select
              value={draft.status}
              onChange={(e) =>
                setDraft({ ...draft, status: e.target.value as (typeof STATUSES)[number] })
              }
              className={field}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label className={label}>
            <span className={labelText}>Assay date</span>
            <input
              type="date"
              value={draft.assay_date}
              onChange={(e) => setDraft({ ...draft, assay_date: e.target.value })}
              className={field}
            />
          </label>

          <label className={label}>
            <span className={labelText}>Receipt date</span>
            <input
              type="date"
              value={draft.receipt_date}
              onChange={(e) => setDraft({ ...draft, receipt_date: e.target.value })}
              className={field}
            />
          </label>

          <label className={label}>
            <span className={labelText}>Method</span>
            <input
              value={draft.method}
              onChange={(e) => setDraft({ ...draft, method: e.target.value })}
              className={field}
            />
          </label>

          <label className={label}>
            <span className={labelText}>Mass spectrometry result</span>
            <input
              value={draft.ms_result}
              onChange={(e) => setDraft({ ...draft, ms_result: e.target.value })}
              className={field}
            />
          </label>

          <label className={label}>
            <span className={labelText}>Laboratory name (optional)</span>
            <input
              value={draft.lab_legal_name}
              onChange={(e) => setDraft({ ...draft, lab_legal_name: e.target.value })}
              className={field}
            />
          </label>

          <label className={label}>
            <span className={labelText}>Report number</span>
            <input
              value={draft.report_number}
              onChange={(e) => setDraft({ ...draft, report_number: e.target.value })}
              className={field}
            />
          </label>

          <label className={label}>
            <span className={labelText}>Verification link (https)</span>
            <input
              value={draft.verify_url}
              onChange={(e) => setDraft({ ...draft, verify_url: e.target.value })}
              className={field}
            />
          </label>
        </div>

        <p className="t-2 mt-[13px] max-w-measure text-axis-ink-500">
          Leave the laboratory name blank if you do not have written consent to name them — the
          record still publishes and renders the attribution as withheld.
        </p>

        <button
          type="button"
          onClick={create}
          disabled={busy}
          className="mt-[20px] border border-axis-ink bg-axis-ink px-[16px] py-[9px] t-2 text-axis-paper disabled:opacity-50"
        >
          {busy ? 'Working…' : 'Record lot'}
        </button>
      </section>

      {message && (
        <p
          role="status"
          className={`t-2 mt-[20px] ${tone === 'error' ? 'text-axis-rejected' : 'text-axis-ink'}`}
        >
          {message}
        </p>
      )}

      {/* ---- The register ---- */}
      <section className="mt-[39px]">
        <h2 className="t-4 text-axis-ink">The register</h2>
        {lots.length === 0 ? (
          <p className="t-3 mt-[13px] max-w-measure text-axis-ink-500">
            No lots recorded. Every public surface renders an empty state until the first record
            is entered here.
          </p>
        ) : (
          <ul className="mt-[20px] border-t border-axis-rule-2">
            {lots.map((lot) => {
              const purity =
                lot.hplc_purity_pct === null ? null : Number(lot.hplc_purity_pct);
              const belowSpec = purity !== null && purity < specPct;
              return (
                <li key={lot.id} className="border-b border-axis-rule-1 py-[20px]">
                  <div className="flex flex-wrap items-baseline gap-x-[16px] gap-y-[6px]">
                    <span className="data t-3 text-axis-ink">{lot.lot_code}</span>
                    <span className="t-2 text-axis-ink-500">
                      {productName[lot.product_slug] ?? lot.product_slug}
                    </span>
                    <span className="data t-2 text-axis-ink-500">
                      {purity === null ? 'no assay figure' : `${purity.toFixed(1)}%`}
                    </span>
                    <span className="t-1 uppercase text-axis-ink-300">{lot.status}</span>
                    <span className={`t-1 uppercase ${lot.published ? 'text-axis-ink' : 'text-axis-ink-300'}`}>
                      {lot.published ? 'published' : 'not published'}
                    </span>
                    {belowSpec && lot.status === 'released' && (
                      <span className="t-1 uppercase text-axis-rejected">
                        below the {specPct.toFixed(1)}% specification
                      </span>
                    )}
                  </div>

                  <div className="mt-[13px] flex flex-wrap items-center gap-[13px]">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        patch(
                          lot.id,
                          { published: !lot.published },
                          lot.published ? 'Lot unpublished.' : 'Lot published.'
                        )
                      }
                      className="border border-axis-rule-3 px-[12px] py-[6px] t-2 text-axis-ink disabled:opacity-50"
                    >
                      {lot.published ? 'Unpublish' : 'Publish'}
                    </button>

                    <label className="t-2 cursor-pointer border border-axis-rule-3 px-[12px] py-[6px] text-axis-ink">
                      {lot.coa_path ? 'Replace certificate' : 'Attach certificate'}
                      <input
                        type="file"
                        accept="application/pdf"
                        className="sr-only"
                        disabled={busy}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = '';
                          if (f) void uploadCertificate(lot.id, f);
                        }}
                      />
                    </label>

                    {lot.coa_path && (
                      <>
                        <a
                          href={`/lots/${encodeURIComponent(lot.lot_code)}/certificate`}
                          target="_blank"
                          rel="noreferrer"
                          className="t-2 text-axis-ink underline underline-offset-[4px]"
                        >
                          View certificate
                        </a>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => detachCertificate(lot.id)}
                          className="t-2 text-axis-ink-500 underline underline-offset-[4px] disabled:opacity-50"
                        >
                          Remove certificate
                        </button>
                      </>
                    )}

                    {!lot.published && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => remove(lot.id, lot.lot_code)}
                        className="t-2 text-axis-rejected underline underline-offset-[4px] disabled:opacity-50"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
