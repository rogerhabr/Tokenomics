'use client';

import { useEffect } from 'react';
import { MOTION_OK, FINE_POINTER } from './motion';

/**
 * Registers GSAP once and, on pointer devices only, mounts Lenis.
 *
 * Three deliberate positions, each of which costs us something and is worth it:
 *
 * 1. **Lenis never runs on touch.** Native iOS/Android momentum scrolling is
 *    already tuned and expected; a JS layer fighting it feels worse, and it
 *    moves scrolling onto the main thread where mobile has the least budget to
 *    spare. Smooth scroll is a desktop affordance here, nothing more.
 *
 * 2. **One rAF loop.** Lenis is driven from GSAP's ticker rather than its own
 *    `requestAnimationFrame`, so the page never runs two animation loops that
 *    can drift against each other. `lagSmoothing(0)` stops GSAP from
 *    fast-forwarding after a long task, which would desynchronise a scrub.
 *
 * 3. **`normalizeScroll` is never enabled.** It fixes iOS address-bar flicker
 *    by moving scrolling to the JS thread — and scroll handlers on the main
 *    thread count toward INP. We take the flicker and keep the responsiveness.
 *
 * Under `prefers-reduced-motion: reduce` this mounts nothing at all: no Lenis,
 * no ticker, no listeners.
 */
export default function MotionProvider() {
  useEffect(() => {
    // Bail before importing anything if the visitor has asked for less motion,
    // or if the device is touch-first. Both checks are live: a visitor who
    // toggles the OS setting gets the change without a reload.
    const motionQuery = window.matchMedia(MOTION_OK);
    const pointerQuery = window.matchMedia(FINE_POINTER);

    let teardown: (() => void) | undefined;
    let cancelled = false;

    async function mount() {
      if (!motionQuery.matches || !pointerQuery.matches) return;

      const [{ gsap }, { ScrollTrigger }, { default: Lenis }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
        import('lenis'),
      ]);
      if (cancelled) return;

      gsap.registerPlugin(ScrollTrigger);

      // Skip a ScrollTrigger refresh when only the viewport *height* changes on
      // a touch-capable device — that is the mobile address bar collapsing, not
      // a real layout change, and refreshing mid-scroll produces a visible jump.
      ScrollTrigger.config({ ignoreMobileResize: true });

      const lenis = new Lenis({
        // Never fake touch scrolling; see (1) above.
        syncTouch: false,
      });

      const tick = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
      lenis.on('scroll', ScrollTrigger.update);

      teardown = () => {
        gsap.ticker.remove(tick);
        gsap.ticker.lagSmoothing(500, 33); // restore GSAP's default
        lenis.destroy();
      };
    }

    void mount();

    // Re-evaluate when the OS preference or the pointer type changes.
    const remount = () => {
      teardown?.();
      teardown = undefined;
      void mount();
    };
    motionQuery.addEventListener('change', remount);
    pointerQuery.addEventListener('change', remount);

    return () => {
      cancelled = true;
      motionQuery.removeEventListener('change', remount);
      pointerQuery.removeEventListener('change', remount);
      teardown?.();
    };
  }, []);

  return null;
}
