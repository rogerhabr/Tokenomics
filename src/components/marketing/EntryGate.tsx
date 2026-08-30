'use client';

import { useEffect, useRef, useState } from 'react';
import Logo from './Logo';
import { event as trackEvent } from '@/lib/analytics';

const STORAGE_KEY = 'axis-labs-entry-ack-v1';
const MINIMUM_AGE = 21;

/**
 * The entry acknowledgement.
 *
 * Two affirmations before the storefront is shown: that the visitor is over
 * {@link MINIMUM_AGE}, and that they understand the compounds are supplied for
 * laboratory research only.
 *
 * Deliberate positions:
 *
 * - **It renders on every storefront page, not only the home page.** A gate on
 *   `/` alone is bypassed by every search result that lands on a product page,
 *   which is most inbound traffic — so it would be a gesture rather than a
 *   control.
 *
 * - **The page underneath is never hidden or unmounted.** The overlay covers it
 *   visually; the document stays complete for crawlers, for print, and for
 *   anyone whose JavaScript never runs. This is an acknowledgement, not an
 *   authentication, and pretending otherwise by withholding the HTML would
 *   break the site for readers it was never meant to stop.
 *
 * - **Escape does not dismiss it.** Every other dialog on this site closes on
 *   Escape; a gate that did would be decoration. Declining is an explicit
 *   action with its own explicit outcome.
 *
 * - **Only acceptance is stored.** A decline writes nothing, so it is never a
 *   permanent lockout of a shared machine.
 */
export default function EntryGate() {
  // `null` means "not yet read from storage" — distinct from "read, and absent".
  // Rendering nothing during that window is what stops the gate flashing over
  // the page for a visitor who already acknowledged it.
  const [accepted, setAccepted] = useState<boolean | null>(null);
  const [isOfAge, setIsOfAge] = useState(false);
  const [understandsResearchUse, setUnderstandsResearchUse] = useState(false);
  const [declined, setDeclined] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      // Private mode, or storage disabled. Show the gate; the cost of asking
      // twice is lower than the cost of not asking.
    }
    setAccepted(stored === 'true');
  }, []);

  const open = accepted === false;

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    headingRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !panelRef.current) return;
      // Trap focus inside the dialog. Without this, tabbing walks into the page
      // behind an aria-modal dialog, which is a 2.4.3 failure.
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  function accept() {
    try {
      window.localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // Unstorable is not a reason to refuse entry — the visitor answered.
    }
    setAccepted(true);
    trackEvent({ name: 'entry_accepted' });
  }

  const bothConfirmed = isOfAge && understandsResearchUse;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-axis-paper px-[26px] py-[39px]">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-gate-heading"
        className="max-h-full w-full max-w-[560px] overflow-y-auto"
      >
        <Logo />
        <div className="spec-rule mt-[26px]" />

        {declined ? (
          <>
            <h2
              id="entry-gate-heading"
              ref={headingRef}
              tabIndex={-1}
              data-dialog-heading
              className="t-6 mt-[39px] text-axis-ink"
            >
              This catalogue is not for you.
            </h2>
            <p className="t-3 mt-[20px] text-axis-ink-500">
              Axis Labs supplies research compounds to laboratories and qualified researchers
              only. Nothing here is a consumer product, and nothing here is for human or
              veterinary use.
            </p>
            <p className="t-3 mt-[20px] text-axis-ink-500">
              If you reached this page in error, you can close the tab. If you answered by
              mistake, reload the page to be asked again.
            </p>
          </>
        ) : (
          <>
            <h2
              id="entry-gate-heading"
              ref={headingRef}
              tabIndex={-1}
              data-dialog-heading
              className="t-6 mt-[39px] text-axis-ink"
            >
              Before you view the catalogue.
            </h2>
            <p className="t-3 mt-[20px] max-w-measure text-axis-ink-500">
              Axis Labs supplies compounds for laboratory research and in vitro study. Please
              confirm both statements below.
            </p>

            <div className="mt-[39px] border-t border-axis-rule-2">
              <label className="flex cursor-pointer gap-[16px] border-b border-axis-rule-1 py-[20px]">
                <input
                  type="checkbox"
                  checked={isOfAge}
                  onChange={(e) => setIsOfAge(e.target.checked)}
                  className="mt-[3px] h-[18px] w-[18px] shrink-0 accent-[color:var(--ink-900)]"
                />
                <span className="t-3 text-axis-ink">
                  I am {MINIMUM_AGE} years of age or older.
                </span>
              </label>

              <label className="flex cursor-pointer gap-[16px] border-b border-axis-rule-1 py-[20px]">
                <input
                  type="checkbox"
                  checked={understandsResearchUse}
                  onChange={(e) => setUnderstandsResearchUse(e.target.checked)}
                  className="mt-[3px] h-[18px] w-[18px] shrink-0 accent-[color:var(--ink-900)]"
                />
                <span className="t-3 text-axis-ink">
                  I understand these compounds are supplied strictly for laboratory research and
                  in vitro study — they are not drugs, foods, cosmetics or medical devices, and
                  are not for human or veterinary consumption, clinical use or diagnostic
                  application.
                </span>
              </label>
            </div>

            <div className="mt-[39px] flex flex-wrap items-center gap-[16px]">
              <button
                type="button"
                onClick={accept}
                disabled={!bothConfirmed}
                className="border border-axis-ink bg-axis-ink px-[26px] py-[11px] t-3 text-axis-paper disabled:cursor-not-allowed disabled:opacity-40"
              >
                Enter the catalogue
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeclined(true);
                  trackEvent({ name: 'entry_declined' });
                }}
                className="t-3 text-axis-ink-500 underline underline-offset-[4px]"
              >
                I do not confirm
              </button>
            </div>

            <p aria-live="polite" className="t-2 mt-[20px] text-axis-ink-300">
              {bothConfirmed ? 'Both statements confirmed.' : 'Both statements must be confirmed to continue.'}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
