'use client';

import { useRef, type ReactNode } from 'react';
import { useCinematic } from './useCinematic';

/**
 * A sequence of panels moved horizontally by vertical scroll.
 *
 * Horizontal scroll is usually a gimmick. It is justified here because the
 * content is genuinely a sequence — the steps a lot passes through before it is
 * released — so left-to-right carries the same meaning the numbers already do.
 * Nothing else on this site gets this treatment.
 *
 * HOW IT DEGRADES, WHICH IS THE HARD PART
 *
 * The horizontal layout is applied by CSS keyed to `data-motion="on"`, and that
 * attribute is set only after the client has confirmed motion is permitted. So:
 *
 *   - No JavaScript      -> attribute absent -> the panels are a normal grid.
 *   - Reduced motion     -> attribute absent -> the panels are a normal grid.
 *   - Narrow viewport    -> attribute absent -> the panels are a normal grid.
 *   - Print, crawlers    -> attribute absent -> the panels are a normal grid.
 *
 * That ordering matters. A horizontal track that exists in CSS by default and
 * is "turned off" by JS leaves a broken row for everyone the JS never reaches.
 * Here the readable layout is the default and the cinematic one is the
 * exception, which is the same discipline the rest of this stylesheet uses.
 *
 * The pin itself is `position: sticky` — GSAP only translates inside the window
 * sticky has already created, so the layout is correct before a frame of JS
 * runs.
 */
export default function HorizontalSequence({
  children,
  heading,
  count,
  label,
}: {
  children: ReactNode;
  /**
   * Rendered inside the pin, so it stays on screen for the whole sequence.
   * Left above the pin it scrolls away immediately and the reader is left with
   * unlabelled steps drifting past.
   */
  heading?: ReactNode;
  /** Panel count; sets the scroll distance so no pixel of the pin is dead. */
  count: number;
  label: string;
}) {
  const scope = useRef<HTMLDivElement>(null);

  useCinematic(scope, ({ gsap, isDesktop }) => {
    const root = scope.current;
    if (!root || !isDesktop || count < 2) return;

    const track = root.querySelector<HTMLElement>('[data-track]');
    if (!track) return;

    // Opt the layout in only now that motion is confirmed permitted.
    root.dataset.motion = 'on';

    const pin = root.querySelector<HTMLElement>('.motion-sequence-pin');
    const panels = gsap.utils.toArray<HTMLElement>('[data-panel]', track);
    if (!pin || panels.length < 2) return;

    // Both distances are measured from the DOM rather than derived from the
    // panel count, and BOTH come from the same two elements — so they cannot
    // desynchronise the way a hand-computed pair does.
    //
    //   travel  = how far the track must move to bring the last panel flush
    //   scrolled = how far the section can actually stay pinned
    //
    // Using xPercent here would be wrong: it is a percentage of the TRACK's own
    // width, which is the sum of every panel, so -100 * (n-1) percent overshoots
    // by a factor of n and parks the reader in empty space past the last panel.
    const travel = () => track.scrollWidth - pin.clientWidth;
    const scrolled = () => root.offsetHeight - pin.offsetHeight;

    gsap.to(track, {
      // A pixel transform, so this stays on the compositor. `left` would be
      // layout, once per frame, for the whole section.
      x: () => -travel(),
      ease: 'none',
      scrollTrigger: {
        trigger: root,
        start: 'top top',
        // Function-based so a resize recomputes rather than keeping a distance
        // measured against the old viewport.
        end: () => `+=${scrolled()}`,
        scrub: 0.6,
        invalidateOnRefresh: true,
      },
    });

    return () => {
      // matchMedia reverts the tween; the attribute is ours to clean up, or the
      // layout stays horizontal with nothing driving it.
      delete root.dataset.motion;
    };
  });

  return (
    <div ref={scope} className="motion-sequence" aria-label={label}>
      <div className="motion-sequence-pin">
        {heading && <div className="motion-sequence-heading">{heading}</div>}
        <div data-track className="motion-sequence-track">
          {children}
        </div>
      </div>
    </div>
  );
}
