import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, webkit } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { serveExample } from './example/serve.mjs';
import { makePalette } from './example/lib/palette.js';

assert.deepEqual(makePalette(35),['hsl(35 40% 86%)','hsl(35 40% 64%)','hsl(35 40% 38%)']);
assert.deepEqual(makePalette(360),makePalette(0));
assert.deepEqual(makePalette(-1),makePalette(359));
assert.throws(()=>makePalette(NaN),TypeError);
const server=serveExample();
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const out='artifacts/browser-import-maps';await mkdir(out,{recursive:true});
const results=[];
try {
 for(const [engine,launcher] of [['Chromium',chromium],['WebKit',webkit]]) {
  const browser=await launcher.launch({headless:true});
  try {
   const context=await browser.newContext({viewport:{width:1280,height:900}});
   const page=await context.newPage();
   const errors=[],requests=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('request',r=>requests.push(r.url()));
   for(const path of ['/','/nested/page/']) {
    const response=await page.goto(origin+path);await page.waitForLoadState('networkidle');
    assert(response.headers()['content-security-policy'].includes("'sha256-"));
    assert.equal(await page.locator('#hue').isDisabled(),false);
    assert.deepEqual(await page.locator('.swatch-card code').allTextContents(),makePalette(35));
    await page.locator('#hue').focus();await page.keyboard.press('ArrowRight');
    assert.deepEqual(await page.locator('.swatch-card code').allTextContents(),makePalette(36));
    const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    assert.equal(axe.violations.length,0,JSON.stringify(axe.violations));
    for(const width of [320,768,1280]) {
     await page.setViewportSize({width,height:900});
     assert(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1));
    }
    results.push({engine,version:browser.version(),path,enhancement:true,csp:'self plus exact map hash',accessibilityViolations:0});
   }
   assert.equal(errors.length,0,JSON.stringify(errors));
   assert(requests.every(url=>new URL(url).origin===origin));
   await page.screenshot({path:`${out}/${engine.toLowerCase()}-palette.png`,fullPage:true});
   const quiet=await browser.newContext({javaScriptEnabled:false});
   const fallback=await quiet.newPage();await fallback.goto(origin);
   assert.equal(await fallback.locator('.swatch-card').count(),3);
   assert(await fallback.locator('#hue').isDisabled());await quiet.close();
   await page.goto(origin+'/broken/');await page.waitForLoadState('networkidle');
   assert(await page.locator('#hue').isDisabled());
   assert.equal(await page.locator('.swatch-card').count(),3);
   results.push({engine,path:'/broken/',staticFallback:true});
  } finally {await browser.close();}
 }
 await writeFile(`${out}/results.json`,JSON.stringify(results,null,2)+'\n');
 console.log(JSON.stringify(results,null,2));
} finally {await new Promise(resolve=>server.close(resolve));}
