/**
 * Screenshots a running dev/prod server for visual review.
 *
 * Usage: npm run build && npm run start &
 *        node scripts/screenshot.mjs <outDir> / /products /products/bpc-157
 *
 * Chromium ships with the container; PLAYWRIGHT_BROWSERS_PATH points at it.
 */
import { chromium } from 'playwright';
const [outDir, ...routes] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
for (const r of routes) {
  const name = r === '/' ? 'home' : r.replace(/^\//, '').replace(/[\/\?=]/g, '-');
  await page.goto('http://localhost:3000' + r, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: true });
  console.log('shot', r);
}
await browser.close();
