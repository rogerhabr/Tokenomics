'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Reports which record in the register is currently under the reading line.
 *
 * This is the site's answer to parallax. A long ruled table gives no sense of
 * its own extent while you are inside it, and the usual fix is to fake depth by
 * moving backgrounds at different speeds — which tells the reader nothing and
 * costs a scroll handler. A record number tells them exactly where they are,
 * in the same mono the register uses for every other fact, and it happens to be
 * true.
 *
 * Implementation notes:
 *
 * - `IntersectionObserver`, not a scroll listener. It fires off the main thread
 *   and does not run per pixel.
 * - The observed band is a thin slice around 40% of the viewport height — the
 *   reading line — so the number changes when a row reaches where the eye
 *   actually is, not when it clips the bottom edge.
 * - It renders nothing until it has observed something, so a reader with no
 *   JavaScript, or a printed page, sees no empty instrument.
 */
export default function RegisterPosition({ total }: { total: number }) {
  const [current, setCurrent] = useState<number | null>(null);
  const observed = useRef<HTMLElement[]>([]);

  useEffect(() => {
    const rows = Array.from(
      document.querySelectorAll<HTMLElement>('.register-row[data-record]')
    );
    if (rows.length === 0) return;
    observed.current = rows;

    // A band around the reading line. Negative top/bottom margins collapse the
    // viewport to that slice.
    const observer = new IntersectionObserver(
      (entries) => {
        // Take the lowest-numbered row currently crossing the line, so the
        // readout moves monotonically rather than flickering between two rows
        // that both touch the band.
        const crossing = entries
          .filter((e) => e.isIntersecting)
          .map((e) => Number((e.target as HTMLElement).dataset.record))
          .filter((n) => Number.isFinite(n));
        if (crossing.length > 0) setCurrent(Math.min(...crossing));
      },
      { rootMargin: '-40% 0px -55% 0px', threshold: 0 }
    );

    rows.forEach((row) => observer.observe(row));
    return () => observer.disconnect();
  }, []);

  if (current === null) return null;

  const width = String(total).length;
  // aria-live is off deliberately: a number that changes on every scroll tick
  // would make a screen reader unusable, and the register itself is already
  // navigable by heading and by link.
  return (
    <p
      aria-live="off"
      className="data t-1 sticky top-[calc(var(--header-h)+13px)] z-[1] text-right tabular-nums text-axis-ink-300"
    >
      <span className="text-axis-ink">{String(current).padStart(width, '0')}</span>
      {' / '}
      {total}
    </p>
  );
}
