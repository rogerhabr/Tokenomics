import type { ReactNode } from 'react';
import { STAGE_HEIGHTS, type StageLength } from './motion';

/**
 * The primitive every pinned moment is built on.
 *
 * **Sticky owns layout; JS owns motion.** The pin here is CSS `position:
 * sticky` inside a parent given explicit scroll distance — never a JS library
 * setting heights. GSAP, where it is used at all, only scrubs *inside* the
 * window this has already created. That split is why newsroom scrollytelling
 * feels solid where library-pinned parallax feels rubbery: the layout is
 * correct before a single frame of JS runs.
 *
 * Consequences worth stating:
 *
 * - **Reduced motion collapses the spacer**, it does not merely stop the
 *   animation. Disabling motion while leaving a 300vh parent behind would
 *   strand the reader in an empty column — the classic naive implementation.
 *   The scroll distance is applied only inside `no-preference`, via the
 *   `motion-stage` class in globals.css.
 * - **`100svh`, never `100vh`.** `vh` includes the mobile address bar, so a
 *   stage sized in `vh` overflows the moment the bar collapses.
 * - The stage renders its children in normal flow with no hidden initial
 *   state, so the content is complete in print, in a screenshot, with JS off,
 *   and before any timeline advances.
 */
export default function StickyStage({
  children,
  length = 'standard',
  className = '',
  id,
}: {
  children: ReactNode;
  length?: StageLength;
  className?: string;
  id?: string;
}) {
  return (
    <div
      id={id}
      className={`motion-stage ${className}`}
      style={{ '--stage-vh': STAGE_HEIGHTS[length] } as React.CSSProperties}
    >
      <div className="motion-stage-pin">{children}</div>
    </div>
  );
}
