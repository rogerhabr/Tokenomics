'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { MOTION_OK, DESKTOP } from './motion';

type Ctx = { motionOK: boolean; isDesktop: boolean };

/**
 * The single place breakpoints and `prefers-reduced-motion` are branched.
 *
 * `gsap.matchMedia()` reverts everything it created when a query stops
 * matching, which is what makes a live OS-preference toggle safe: the visitor
 * turns on Reduce Motion and every tween, timeline and ScrollTrigger built
 * under `no-preference` is torn down, leaving the static document.
 *
 * The callback is only ever invoked when motion is permitted. Callers do not
 * need their own reduced-motion check, and must not add one — a second source
 * of truth is how these things drift.
 *
 * GSAP is imported dynamically so the ~35 KB never lands in a route that does
 * not animate.
 */
export function useCinematic(
  scope: RefObject<HTMLElement>,
  build: (ctx: Ctx & { gsap: typeof import('gsap').gsap }) => void
) {
  // Keep the latest builder without making it a dependency: re-running the
  // effect on every render would tear down and rebuild the timeline each time.
  const buildRef = useRef(build);
  buildRef.current = build;

  useEffect(() => {
    if (!scope.current) return;

    let revert: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ]);
      if (cancelled || !scope.current) return;

      gsap.registerPlugin(ScrollTrigger);

      const mm = gsap.matchMedia(scope.current);
      mm.add({ motionOK: MOTION_OK, isDesktop: DESKTOP }, (context) => {
        const { motionOK, isDesktop } = context.conditions as Ctx;
        if (!motionOK) return;
        buildRef.current({ motionOK, isDesktop, gsap });
      });

      revert = () => mm.revert();
    })();

    return () => {
      cancelled = true;
      revert?.();
    };
  }, [scope]);
}
