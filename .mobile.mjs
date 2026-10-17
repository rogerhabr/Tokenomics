import { chromium } from 'playwright';
const [outDir, ...routes] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
for (const r of routes) {
  const name = 'm-' + (r === '/' ? 'home' : r.replace(/^\//,'').replace(/[\/\?=]/g,'-'));
  await p.goto('http://localhost:3000' + r, { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  // Horizontal overflow is the classic failure of a table-heavy layout on a phone.
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log(`${r} overflowX=${overflow}px`);
  await p.screenshot({ path: `${outDir}/${name}.png`, fullPage: true });
}
await b.close();
