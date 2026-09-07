'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

export type EditorRow = {
  id: string;
  productSlug: string;
  label: string;
  sizeMg: number | null;
  priceCents: number;
  active: boolean;
};

type ProductRef = { slug: string; name: string };

/** Cents -> a dollars string for the input. Money never becomes a float in
 *  storage; this conversion exists only so a person types 89.00 and not 8900. */
function toDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Dollars string -> integer cents, or null if it isn't a usable number.
 *  Rounding here rather than truncating means 89.005 becomes 89.01, not 89.00. */
function toCents(dollars: string): number | null {
  const n = Number(dollars.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export default function PricingEditor({
  rows,
  products,
  standardSizes,
}: {
  rows: EditorRow[];
  products: ProductRef[];
  standardSizes: number[];
}) {
  const router = useRouter();

  // Edits are held locally and sent in one save, so a slip on one row can be
  // corrected before anything reaches the storefront.
  const [draft, setDraft] = useState<Record<string, { price: string; active: boolean }>>(() =>
    Object.fromEntries(rows.map((r) => [r.id, { price: toDollars(r.priceCents), active: r.active }]))
  );
  const [newSlug, setNewSlug] = useState(products[0]?.slug ?? '');
  const [newSize, setNewSize] = useState(String(standardSizes[0] ?? 10));
  const [newPrice, setNewPrice] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const byProduct = useMemo(() => {
    const map = new Map<string, EditorRow[]>();
    for (const r of rows) {
      const list = map.get(r.productSlug) ?? [];
      list.push(r);
      map.set(r.productSlug, list);
    }
    return map;
  }, [rows]);

  const dirty = useMemo(
    () =>
      rows.filter((r) => {
        const d = draft[r.id];
        return d && (toCents(d.price) !== r.priceCents || d.active !== r.active);
      }),
    [rows, draft]
  );

  const existingSizes = new Set(
    (byProduct.get(newSlug) ?? []).map((r) => (r.sizeMg === null ? NaN : r.sizeMg))
  );

  async function save() {
    setStatus('saving');
    setMessage('');

    const updates = dirty.map((r) => ({
      id: r.id,
      priceCents: toCents(draft[r.id].price) ?? r.priceCents,
      active: draft[r.id].active,
    }));

    const creates =
      newPrice.trim() && newSlug
        ? [
            {
              productSlug: newSlug,
              sizeMg: Number(newSize),
              priceCents: toCents(newPrice) ?? 0,
            },
          ]
        : [];

    if (updates.length === 0 && creates.length === 0) {
      setStatus('idle');
      setMessage('Nothing has changed.');
      return;
    }

    try {
      const res = await fetch('/api/admin/variants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates, creates }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus('error');
        setMessage(json.error ?? 'Could not save.');
        return;
      }
      setStatus('saved');
      setMessage(
        `Saved ${json.updated} price${json.updated === 1 ? '' : 's'}` +
          (json.created ? ` and added ${json.created} size.` : '.')
      );
      setNewPrice('');
      router.refresh();
    } catch {
      setStatus('error');
      setMessage('Could not reach the server.');
    }
  }

  const field =
    'data h-[40px] rounded-plate border border-axis-rule-3 bg-axis-plate px-[10px] text-[16px] text-axis-ink';

  return (
    <div className="mt-[39px]">
      {/* Add a size ------------------------------------------------------- */}
      <section className="border border-axis-rule-3 bg-axis-sunk p-[20px]">
        <h2 className="t-1 text-axis-ink-300">Add a vial size</h2>
        <div className="mt-[13px] flex flex-wrap items-end gap-[13px]">
          <label className="flex flex-col gap-[6px]">
            <span className="t-1 text-axis-ink-300">Compound</span>
            <select
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              className={`${field} w-[240px]`}
            >
              {products.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-[6px]">
            <span className="t-1 text-axis-ink-300">Size</span>
            <select
              value={newSize}
              onChange={(e) => setNewSize(e.target.value)}
              className={`${field} w-[140px]`}
            >
              {standardSizes.map((s) => (
                <option key={s} value={s} disabled={existingSizes.has(s)}>
                  {s} mg{existingSizes.has(s) ? ' — exists' : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-[6px]">
            <span className="t-1 text-axis-ink-300">Price (USD)</span>
            <input
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              className={`${field} w-[140px]`}
            />
          </label>
        </div>
        <p className="t-2 mt-[13px] text-axis-ink-500">
          Sizes outside this list — the 2 mg oxytocin vial, the 60 mg tirzepatide vial, the
          multi-vial kits — already exist and are edited in the table below.
        </p>
      </section>

      {/* Price table ------------------------------------------------------ */}
      <div className="mt-[39px] space-y-[39px]">
        {products.map((p) => {
          const list = byProduct.get(p.slug) ?? [];
          if (list.length === 0) return null;
          return (
            <section key={p.slug}>
              <h2 className="t-4 text-axis-ink">{p.name}</h2>
              <div className="mt-[13px] overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-axis-rule-3">
                    <th className="t-1 py-[8px] pr-[16px] text-axis-ink-300">Size</th>
                    <th className="t-1 py-[8px] pr-[16px] text-axis-ink-300">Price (USD)</th>
                    <th className="t-1 py-[8px] pr-[16px] text-axis-ink-300">$/mg</th>
                    <th className="t-1 py-[8px] text-axis-ink-300">Listed</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((r) => {
                    const d = draft[r.id] ?? { price: toDollars(r.priceCents), active: r.active };
                    const cents = toCents(d.price);
                    const rate =
                      cents !== null && r.sizeMg && r.sizeMg > 0 ? cents / 100 / r.sizeMg : null;
                    return (
                      <tr key={r.id} className="border-b border-axis-rule-1">
                        <td className="py-[10px] pr-[16px]">
                          <span className="t-2 text-axis-ink">{r.label}</span>
                        </td>
                        <td className="py-[10px] pr-[16px]">
                          <input
                            value={d.price}
                            inputMode="decimal"
                            aria-label={`Price for ${p.name} ${r.label}`}
                            onChange={(e) =>
                              setDraft((prev) => ({
                                ...prev,
                                [r.id]: { ...d, price: e.target.value },
                              }))
                            }
                            className={`${field} w-[120px]`}
                          />
                        </td>
                        <td className="py-[10px] pr-[16px]">
                          <span className="data t-2 text-axis-ink-500">
                            {rate === null ? '—' : `$${rate.toFixed(2)}`}
                          </span>
                        </td>
                        <td className="py-[10px]">
                          <label className="inline-flex items-center gap-[8px]">
                            <input
                              type="checkbox"
                              checked={d.active}
                              aria-label={`List ${p.name} ${r.label} on the storefront`}
                              onChange={(e) =>
                                setDraft((prev) => ({
                                  ...prev,
                                  [r.id]: { ...d, active: e.target.checked },
                                }))
                              }
                              className="h-[18px] w-[18px] accent-[#101215]"
                            />
                            <span className="t-2 text-axis-ink-500">
                              {d.active ? 'Listed' : 'Hidden'}
                            </span>
                          </label>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </section>
          );
        })}
      </div>

      {/* Save ------------------------------------------------------------- */}
      <div className="sticky bottom-0 mt-[39px] border-t border-axis-rule-3 bg-axis-sunk py-[16px]">
        <div className="flex flex-wrap items-center gap-[16px]">
          <button
            type="button"
            onClick={save}
            disabled={status === 'saving'}
            className="t-3 min-h-[48px] rounded-plate bg-axis-ink px-[26px] text-axis-paper disabled:opacity-45"
          >
            {status === 'saving' ? 'Saving…' : 'Save changes'}
          </button>
          <span className="t-2 text-axis-ink-500">
            {dirty.length > 0
              ? `${dirty.length} unsaved change${dirty.length === 1 ? '' : 's'}`
              : 'No unsaved changes'}
          </span>
          {message && (
            <span
              role="status"
              className={`t-2 ${status === 'error' ? 'text-axis-rejected' : 'text-axis-released'}`}
            >
              {message}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
