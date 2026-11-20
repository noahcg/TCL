import assert from 'node:assert/strict';
import { chromium, webkit } from '@playwright/test';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { serveLab } from './example/serve.mjs';

const directory=resolve(process.argv[2] || 'docs/research/nudeps/example');
const out=resolve('artifacts/nudeps-research');
await mkdir(out,{recursive:true});
const results=[];
for (const [engine,launcher] of [['Chromium',chromium],['WebKit',webkit]]) {
  const browser=await launcher.launch({headless:true});
  for (const strict of [false,true]) {
    const server=serveLab({directory,strict});
    await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
    const origin=`http://127.0.0.1:${server.address().port}`;
    const context=await browser.newContext({viewport:{width:1280,height:900}});
    const page=await context.newPage();
    const errors=[]; const requests=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',r=>requests.push(r.url()));
    for (const path of ['/','/nested/page/']) {
      await page.goto(origin+path);
      await page.waitForLoadState('networkidle');
      const blocked=await page.locator('#hue').isDisabled();
      assert.equal(blocked,strict,`${engine} ${path}: unexpected CSP result`);
      if (!strict) {
        const before=await page.locator('.swatch-card code').allTextContents();
        assert(before.every(value=>/^#[a-f0-9]{3,8}$/i.test(value)));
        await page.locator('#hue').focus();
        await page.keyboard.press('ArrowRight');
        assert.notDeepEqual(await page.locator('.swatch-card code').allTextContents(),before);
        assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--size-4').trim()),'1.25rem');
        const csp=await page.evaluate(()=>getComputedStyle(document.querySelector('.palette')).gap);
        assert.equal(csp,'20px');
        await page.screenshot({path:`${out}/${engine.toLowerCase()}-color-desk-desktop.png`,fullPage:true});
        await page.setViewportSize({width:320,height:900});
        assert(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1));
        await page.screenshot({path:`${out}/${engine.toLowerCase()}-color-desk.png`,fullPage:true});
        await page.setViewportSize({width:1280,height:900});
      }
      results.push({engine,version:browser.version(),path,strict,enhanced:!blocked});
    }
    assert(requests.every(url=>new URL(url).origin===origin),'Unexpected third-party request');
    if (!strict) assert.equal(errors.length,0,JSON.stringify(errors));
    else assert(errors.some(error=>/specifier|resolve|module/i.test(error)));
    await context.close();
    if (!strict) {
      const quiet=await browser.newContext({javaScriptEnabled:false});
      const p=await quiet.newPage(); await p.goto(origin);
      assert.equal(await p.locator('.swatch-card').count(),3);
      assert(await p.locator('#hue').isDisabled());
      await quiet.close();
    }
    await new Promise(resolve=>server.close(resolve));
  }
  await browser.close();
}
await writeFile(`${out}/browser-results.json`,JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results,null,2));
