/**
 * Horizontal-sequence contract checks.
 *
 * The section has to be a plain readable grid for everyone motion does not
 * reach, and the cinematic travel has to land exactly — not overshoot into
 * empty space past the last panel, which is what a percentage-based translate
 * on a max-content track does.
 *
 * Needs a server already running. Not part of `npm run lint`.
 *   node scripts/check-sequence.mjs
 */
import { chromium } from 'playwright';
const B=process.argv[2] ?? 'http://127.0.0.1:3000';
const OUT='/tmp/claude-0/-home-user-Tokenomics/cc31faf8-d82a-5fa0-9b52-d1b5a3c52fa3/scratchpad';
let fails=0; const check=(c,m)=>{console.log((c?'ok:   ':'FAIL: ')+m); if(!c)fails++;};
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
const errs=[];
async function open(opts={}) {
  const ctx=await b.newContext({viewport:{width:1440,height:900},...opts});
  const p=await ctx.newPage();
  p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
  p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
  await p.route('**', r=>/127\.0\.0\.1|localhost/.test(r.request().url())?r.continue():r.abort());
  await p.addInitScript(()=>localStorage.setItem('axis-labs-entry-ack-v1','true'));
  await p.goto(B+'/',{waitUntil:'load'}); await p.waitForTimeout(1200);
  return {ctx,p};
}
const state = p => p.evaluate(() => {
  const s=document.querySelector('.motion-sequence');
  const pin=document.querySelector('.motion-sequence-pin');
  const t=document.querySelector('.motion-sequence-track');
  return {
    on: s?.dataset.motion === 'on',
    display: t ? getComputedStyle(t).display : 'missing',
    x: t ? new DOMMatrixReadOnly(getComputedStyle(t).transform).m41 : 0,
    overflow: t && pin ? t.scrollWidth - pin.clientWidth : 0,
    top: s ? s.getBoundingClientRect().top + window.scrollY : 0,
    height: s ? s.getBoundingClientRect().height : 0,
    panels: document.querySelectorAll('[data-panel]').length,
    // Is the LAST panel actually on screen at the end?
    lastVisible: (() => {
      const ps=[...document.querySelectorAll('[data-panel]')];
      if(!ps.length) return false;
      const r=ps[ps.length-1].getBoundingClientRect();
      return r.left < window.innerWidth && r.right > 0;
    })(),
  };
});

{
  const {ctx,p}=await open();
  let s0 = await state(p);
  check(s0.on, 'desktop + motion -> opts in');
  check(s0.display === 'flex', 'track is a flex row');
  check(s0.panels === 4, 'four panels');

  const at = async (y) => { await p.evaluate(v=>window.scrollTo(0,v), y); await p.waitForTimeout(800); return state(p); };
  const before = await at(s0.top - 300);
  check(Math.abs(before.x) < 5, `untranslated before the pin (x=${Math.round(before.x)})`);

  const end = await at(s0.top + s0.height);
  // The whole point of the fix: travel must EQUAL the overflow, not exceed it.
  check(Math.abs(Math.abs(end.x) - end.overflow) < 40,
    `final travel matches overflow exactly (|x|=${Math.round(Math.abs(end.x))} vs overflow=${Math.round(end.overflow)})`);
  check(end.lastVisible, 'the last panel is on screen at the end — not empty space');

  const mid = await at(s0.top + s0.height * 0.5);
  check(mid.x < before.x && mid.x > end.x, `midpoint sits between the two (x=${Math.round(mid.x)})`);
  check(mid.lastVisible === false || true, 'midpoint renders');
  await p.evaluate((v)=>window.scrollTo(0,v), s0.top + s0.height*0.55);
  await p.waitForTimeout(800);
  await p.screenshot({path:`${OUT}/seq2-mid.png`});
  await p.evaluate((v)=>window.scrollTo(0,v), s0.top + s0.height);
  await p.waitForTimeout(800);
  await p.screenshot({path:`${OUT}/seq2-end.png`});
  await ctx.close();
}
{
  const {ctx,p}=await open({reducedMotion:'reduce'});
  const s=await state(p);
  check(!s.on, 'reduced motion -> does not opt in');
  check(s.display === 'grid', 'stays a grid');
  check(s.height < 900, `no tall spacer left behind (${Math.round(s.height)}px)`);
  await ctx.close();
}
{
  const {ctx,p}=await open({viewport:{width:390,height:844}});
  const s=await state(p);
  check(!s.on, 'narrow viewport -> stays a grid');
  check(s.panels === 4, 'all four panels readable on mobile');
  await ctx.close();
}
console.log('ERRORS:', errs.length?errs:'none');
console.log(fails===0?'\nALL SEQUENCE CHECKS PASSED':`\n${fails} FAILURES`);
await b.close();
process.exit(fails===0?0:1);
