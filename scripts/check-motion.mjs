/**
 * Motion contract checks.
 *
 * These assert the three promises the motion layer makes, which are easy to
 * break silently and impossible to see in a screenshot:
 *
 *   1. Smooth scroll is a desktop-pointer affordance only.
 *   2. `prefers-reduced-motion: reduce` mounts nothing at all — and the page
 *      is still complete, not a set of empty stages.
 *   3. No content depends on an animation having run.
 *
 * Needs a server already running (`npm run build && npm run start`), so this
 * is deliberately NOT part of `npm run lint`, which must stay fast and offline.
 *
 *   node scripts/check-motion.mjs [baseUrl]
 */

import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
const B = process.argv[2] ?? 'http://127.0.0.1:3000';
// The sandbox ships a pinned Chromium; fall back to Playwright's own resolution
// anywhere else.
const EXE = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const launchOpts = existsSync(EXE)
  ? { executablePath: EXE, args: ['--no-sandbox'] }
  : { args: ['--no-sandbox'] };
let fails = 0;
const check = (c, m) => { console.log((c ? 'ok:   ' : 'FAIL: ') + m); if (!c) fails++; };

// Does the page have Lenis mounted? Lenis adds classes to <html>.
const lenisActive = (page) => page.evaluate(() =>
  document.documentElement.className.includes('lenis') ||
  !!document.querySelector('[data-lenis-prevent], .lenis'));

(async () => {
  const browser = await chromium.launch(launchOpts);

  // --- 1. Desktop, motion allowed: Lenis should mount ---
  let ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  let page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(B + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  check(await lenisActive(page), 'desktop + motion allowed -> Lenis mounts');
  const contentVisible = await page.evaluate(() => {
    const h1 = document.querySelector('h1');
    if (!h1) return false;
    const s = getComputedStyle(h1);
    return s.opacity === '1' && s.visibility === 'visible';
  });
  check(contentVisible, 'h1 fully visible (no hidden initial state)');
  await ctx.close();

  // --- 2. Reduced motion: nothing should mount ---
  ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  page = await ctx.newPage();
  page.on('pageerror', e => errs.push('RM PAGEERROR: ' + e.message));
  await page.goto(B + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  check(!(await lenisActive(page)), 'reduced motion -> Lenis does NOT mount');
  const smooth = await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior);
  check(smooth !== 'smooth', `reduced motion -> scroll-behavior not smooth (got "${smooth}")`);
  // Content must still be complete and reachable.
  const bodyLen = (await page.textContent('body')).trim().length;
  check(bodyLen > 2000, `reduced motion -> page content complete (${bodyLen} chars)`);
  await ctx.close();

  // --- 3. Touch device: Lenis must not mount even with motion allowed ---
  ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
  });
  page = await ctx.newPage();
  await page.goto(B + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  check(!(await lenisActive(page)), 'touch device -> Lenis does NOT mount');
  await ctx.close();

  console.log('CONSOLE/PAGE ERRORS:', errs.length ? errs : 'none');
  console.log(fails === 0 ? '\nALL PHASE 1 CHECKS PASSED' : `\n${fails} FAILURES`);
  await browser.close();
  process.exit(fails === 0 ? 0 : 1);
})();
