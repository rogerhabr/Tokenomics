/**
 * Shared motion constants and the reduced-motion query.
 *
 * The site's CSS authors motion default-OFF: every rule lives inside
 * `prefers-reduced-motion: no-preference`, so reduced motion is the *absence*
 * of rules rather than an override of them (see the Motion section of
 * globals.css). The JS layer follows the same discipline — nothing here starts
 * a timeline unless the query below matches.
 */

/** Matches the CSS convention exactly. Used by `gsap.matchMedia()`. */
export const MOTION_OK = '(prefers-reduced-motion: no-preference)';

/** Pointer-based devices only. Lenis is never mounted on touch. */
export const FINE_POINTER = '(pointer: fine)';

export const DESKTOP = '(min-width: 1024px)';

/**
 * Scroll distance, in viewport heights, that a pinned stage occupies. Kept
 * here so the CSS spacer and any JS that reads it cannot drift apart.
 */
export const STAGE_HEIGHTS = { short: 2, standard: 2.5, long: 3 } as const;
export type StageLength = keyof typeof STAGE_HEIGHTS;
