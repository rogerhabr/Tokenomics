'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ContentField, ContentMap } from '@/lib/content';

export default function ContentEditor({
  fields,
  content,
  overridden,
}: {
  fields: ContentField[];
  content: ContentMap;
  /** Keys that currently have a database row, i.e. differ from source. */
  overridden: string[];
}) {
  const router = useRouter();
  const overriddenSet = useMemo(() => new Set(overridden), [overridden]);

  const [draft, setDraft] = useState<ContentMap>(() => ({ ...content }));
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [openGroup, setOpenGroup] = useState<string | null>(fields[0]?.group ?? null);

  const groups = useMemo(() => {
    const map = new Map<string, ContentField[]>();
    for (const f of fields) {
      const list = map.get(f.group) ?? [];
      list.push(f);
      map.set(f.group, list);
    }
    return map;
  }, [fields]);

  const dirty = useMemo(
    () => fields.filter((f) => (draft[f.key] ?? '') !== (content[f.key] ?? '')),
    [fields, draft, content]
  );

  async function save() {
    if (dirty.length === 0) {
      setMessage('Nothing has changed.');
      setStatus('idle');
      return;
    }
    setStatus('saving');
    setMessage('');

    try {
      const res = await fetch('/api/admin/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changes: dirty.map((f) => ({ key: f.key, value: draft[f.key] ?? '' })),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus('error');
        setMessage(json.error ?? 'Could not save.');
        return;
      }
      setStatus('saved');
      setMessage(`Saved ${json.saved} field${json.saved === 1 ? '' : 's'}.`);
      router.refresh();
    } catch {
      setStatus('error');
      setMessage('Could not reach the server.');
    }
  }

  const field =
    'mt-[8px] w-full rounded-plate border border-axis-rule-3 bg-axis-plate px-[13px] py-[10px] text-[16px] leading-[1.5] text-axis-ink';

  return (
    <div className="mt-[39px]">
      <div className="space-y-[13px]">
        {Array.from(groups.entries()).map(([group, list]) => {
          const open = openGroup === group;
          const changedHere = list.filter((f) => (draft[f.key] ?? '') !== (content[f.key] ?? ''));
          return (
            <section key={group} className="border border-axis-rule-3">
              <button
                type="button"
                onClick={() => setOpenGroup(open ? null : group)}
                aria-expanded={open}
                className="flex w-full items-center justify-between bg-axis-sunk px-[20px] py-[13px] text-left"
              >
                <span className="t-1 text-axis-ink">
                  <span aria-hidden="true">{open ? '▾' : '▸'}</span> {group}
                </span>
                <span className="t-2 text-axis-ink-500">
                  {list.length} field{list.length === 1 ? '' : 's'}
                  {changedHere.length > 0 && ` · ${changedHere.length} edited`}
                </span>
              </button>

              {open && (
                <div className="space-y-[26px] p-[20px]">
                  {list.map((f) => {
                    const value = draft[f.key] ?? '';
                    const isOverride = overriddenSet.has(f.key);
                    return (
                      <div key={f.key}>
                        <label htmlFor={f.key} className="t-1 block text-axis-ink-300">
                          {f.label}
                          {isOverride && (
                            <span className="ml-[8px] normal-case text-axis-retained">
                              edited
                            </span>
                          )}
                        </label>

                        {f.kind === 'line' ? (
                          <input
                            id={f.key}
                            value={value}
                            onChange={(e) =>
                              setDraft((p) => ({ ...p, [f.key]: e.target.value }))
                            }
                            className={field}
                          />
                        ) : (
                          <textarea
                            id={f.key}
                            value={value}
                            rows={f.kind === 'list' ? 4 : 3}
                            onChange={(e) =>
                              setDraft((p) => ({ ...p, [f.key]: e.target.value }))
                            }
                            className={`${field} resize-y`}
                          />
                        )}

                        <p className="t-2 mt-[6px] text-axis-ink-300">
                          {f.help ?? ''}
                          {isOverride && (
                            <>
                              {f.help ? ' ' : ''}
                              <button
                                type="button"
                                onClick={() => setDraft((p) => ({ ...p, [f.key]: '' }))}
                                className="underline underline-offset-[3px]"
                              >
                                Clear to restore the original
                              </button>
                            </>
                          )}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>

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
              className={`t-2 max-w-[60ch] ${
                status === 'error' ? 'text-axis-rejected' : 'text-axis-released'
              }`}
            >
              {message}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
