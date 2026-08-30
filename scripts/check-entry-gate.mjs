/**
 * Entry-gate contract checks.
 *
 * The gate is an acknowledgement, not an authentication, and the difference
 * matters in both directions: it must actually block the storefront visually
 * and by keyboard, and it must never withhold the document from a crawler, a
 * printer, or a reader whose JavaScript did not run.
 *
 * Needs a server already running. Deliberately not part of `npm run lint`.
 *   node scripts/check-entry-gate.mjs [baseUrl]
 */
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';

const B = process.argv[2] ?? 'http://127.0.0.1:3000';
const EXE = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const launchOpts = existsSync(EXE)
  ? { executablePath: EXE, args: ['--no-sandbox'] }
  : { args: ['--no-sandbox'] };

let fails = 0;
const check = (c, m) => { console.log((c ? 'ok:   ' : 'FAIL: ') + m); if (!c) fails++; };

const browser = await chromium.launch(launchOpts);
const errs = [];

async function fresh() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.route('**', r => /127\.0\.0\.1|localhost/.test(r.request().url()) ? r.continue() : r.abort());
  return { ctx, page };
}

const gate = 'div[role="dialog"][aria-label], div[role="dialog"]';
const enter = 'button:has-text("Enter the catalogue")';

// 1. Gate appears for a first-time visitor, on the home page AND a deep link.
{
  const { ctx, page } = await fresh();
  await page.goto(B + '/', { waitUntil: 'load' });
  await page.waitForSelector('text=Before you view the catalogue', { timeout: 8000 });
  check(true, 'gate appears on the landing page');

  const btn = page.locator(enter);
  check(await btn.isDisabled(), 'Enter is disabled until both statements are confirmed');

  await page.getByRole('checkbox').first().check();
  check(await btn.isDisabled(), 'still disabled with only the age statement confirmed');

  await page.getByRole('checkbox').nth(1).check();
  check(await btn.isEnabled(), 'enabled once both are confirmed');

  // Escape must NOT dismiss a gate.
  await page.keyboard.press('Escape');
  check(await page.locator('text=Before you view the catalogue').isVisible(), 'Escape does not dismiss the gate');

  await btn.click();
  await page.waitForTimeout(400);
  check(!(await page.locator('text=Before you view the catalogue').isVisible()), 'entering dismisses the gate');

  // 2. Acceptance persists across a reload and across routes.
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(500);
  check(!(await page.locator('text=Before you view the catalogue').isVisible()), 'acceptance persists across a reload');

  await page.goto(B + '/products', { waitUntil: 'load' });
  await page.waitForTimeout(500);
  check(!(await page.locator('text=Before you view the catalogue').isVisible()), 'acceptance persists across routes');
  await ctx.close();
}

// 3. A deep link is gated too — not just the landing page.
{
  const { ctx, page } = await fresh();
  await page.goto(B + '/products/bpc-157', { waitUntil: 'load' });
  await page.waitForTimeout(600);
  check(await page.locator('text=Before you view the catalogue').isVisible(), 'a deep-linked product page is gated too');

  // 4. Declining shows a terminal state and does not let you through.
  await page.getByRole('button', { name: 'I do not confirm' }).click();
  await page.waitForTimeout(300);
  check(await page.locator('text=This catalogue is not for you').isVisible(), 'declining shows a terminal state');
  check(!(await page.locator(enter).isVisible()), 'declining removes the way in');

  // 5. A decline is not persisted — a shared machine is not locked out.
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(500);
  check(await page.locator('text=Before you view the catalogue').isVisible(), 'a decline is not stored');
  await ctx.close();
}

// 6. The document underneath is complete regardless.
{
  const { ctx, page } = await fresh();
  await page.goto(B + '/', { waitUntil: 'load' });
  await page.waitForTimeout(500);
  const html = await page.content();
  check(html.includes('Purity you can check'), 'page content is present in the DOM behind the gate');
  await ctx.close();
}

console.log('CONSOLE/PAGE ERRORS:', errs.length ? errs : 'none');
console.log(fails === 0 ? '\nALL ENTRY-GATE CHECKS PASSED' : `\n${fails} FAILURES`);
await browser.close();
process.exit(fails === 0 ? 0 : 1);
