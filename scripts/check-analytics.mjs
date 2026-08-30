/**
 * Analytics contract checks.
 *
 * Two things are being verified, and the second matters more than the first:
 *
 *   1. The funnel events fire where they should.
 *   2. NO event property carries personal data. This is a research-chemical
 *      storefront — who bought what is exactly what must not reach an
 *      analytics vendor — so every payload is inspected against the details a
 *      test buyer typed in, and the test fails if any of them appear.
 *
 * Needs a server already running. Not part of `npm run lint`.
 *   node scripts/check-analytics.mjs [baseUrl]
 */
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';

const B = process.argv[2] ?? 'http://127.0.0.1:3000';
const EXE = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const launchOpts = existsSync(EXE) ? { executablePath: EXE, args: ['--no-sandbox'] } : { args: ['--no-sandbox'] };

let fails = 0;
const check = (c, m) => { console.log((c ? 'ok:   ' : 'FAIL: ') + m); if (!c) fails++; };

// Details a buyer types. None may ever appear in an analytics payload.
const PII = {
  name: 'Dr Ada Lovelace', email: 'ada@analytical.example',
  address: '17 Chromatography Way', city: 'Cambridgeport',
  postal: 'CB99 9ZZ', phone: '+15550002222', org: 'Analytical Institute',
};

const browser = await chromium.launch(launchOpts);
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();
const sent = [];

// Analytics is disabled locally, so the real beacon never fires. Capture the
// call at the source instead — that is where the payload is decided.
await page.addInitScript(() => {
  window.__events = [];
  // @vercel/analytics calls `window.va('event', { name, data })` — one object,
  // not separate name and property arguments.
  Object.defineProperty(window, 'va', {
    configurable: true,
    get: () => (kind, payload) => {
      if (kind === 'event' && payload && typeof payload === 'object') {
        window.__events.push({ name: payload.name, props: payload.data ?? null });
      }
    },
    set: () => {},
  });
});
await page.route('**', r => /127\.0\.0\.1|localhost/.test(r.request().url()) ? r.continue() : r.abort());

const drain = async () => {
  const e = await page.evaluate(() => { const x = window.__events ?? []; window.__events = []; return x; });
  sent.push(...e); return e;
};

// 1. Entry gate
await page.goto(B + '/', { waitUntil: 'load' });
await page.waitForTimeout(900);
await page.getByRole('checkbox').first().check();
await page.getByRole('checkbox').nth(1).check();
await page.getByRole('button', { name: /enter/i }).click();
await page.waitForTimeout(600);
let e = await drain();
check(e.some(x => x.name === 'entry_accepted'), 'entry_accepted fires on acceptance');

// 2. Add to cart
await page.goto(B + '/products/kpv', { waitUntil: 'load' });
await page.waitForTimeout(800);
await page.getByRole('button', { name: /add to order|add to cart/i }).first().click();
await page.waitForTimeout(700);
e = await drain();
const add = e.find(x => x.name === 'add_to_cart');
check(!!add, 'add_to_cart fires');
check(add?.props?.product === 'kpv', `carries the product slug (${add?.props?.product})`);
check(typeof add?.props?.quantity === 'number', 'carries a numeric quantity');

// 3. Checkout started + a failing submit
await page.goto(B + '/checkout', { waitUntil: 'load' });
await page.waitForTimeout(900);
e = await drain();
const started = e.find(x => x.name === 'checkout_started');
check(!!started, 'checkout_started fires with a cart');
check(typeof started?.props?.subtotal_cents === 'number', 'carries a numeric subtotal');

await page.fill('#name', PII.name);
await page.fill('#email', PII.email);
await page.fill('#addressLine1', PII.address);
await page.fill('#city', PII.city);
await page.fill('#postalCode', PII.postal);
await page.selectOption('#country', 'United States');
const phone = page.locator('#phone'); if (await phone.count()) await phone.fill(PII.phone);
const org = page.locator('#organization'); if (await org.count()) await org.fill(PII.org);
await page.getByRole('checkbox').last().check();
await page.getByRole('button', { name: /place order/i }).click();
await page.waitForTimeout(1500);
e = await drain();
const failed = e.find(x => x.name === 'checkout_failed');
check(!!failed, 'checkout_failed fires when the server refuses (Supabase unconfigured here)');
check(typeof failed?.props?.reason === 'string' && failed.props.reason.length < 24,
  `carries a short reason code, not a message (${failed?.props?.reason})`);

// 4. THE ONE THAT MATTERS: no payload may contain anything the buyer typed.
const blob = JSON.stringify(sent);
const leaked = Object.entries(PII).filter(([, v]) => blob.includes(v)).map(([k]) => k);
check(leaked.length === 0, `no personal data in any payload (${leaked.length ? 'LEAKED: ' + leaked.join(', ') : 'checked ' + sent.length + ' events'})`);

console.log('\nevents captured:', sent.map(x => x.name).join(', ') || 'none');
console.log(fails === 0 ? '\nALL ANALYTICS CHECKS PASSED' : `\n${fails} FAILURES`);
await browser.close();
process.exit(fails === 0 ? 0 : 1);
