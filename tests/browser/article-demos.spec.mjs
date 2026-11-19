import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { articleDemos } from '../../src/build/article-demos.mjs';
import { readFeature } from '../../src/build/homepage-feature.mjs';
import { cssInAction } from '../../src/build/css-in-action.mjs';
import { loadContent } from '../../src/build/content.mjs';
const config = await readFeature();
const articles = (await loadContent()).filter(entry => entry.type === 'article');
async function openDemo(page, id) {
  await page.route('**/*', async route => {
    if (new URL(route.request().url()).pathname !== '/') return route.continue();
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace(/<section class="css-in-action"[\s\S]*?<\/section>/, cssInAction(articles, { config: { ...config, mode:'manual', pinned:id } })) });
  });
  await page.goto('/?example=' + id + '#css-in-action');
}
for (const [id, demo] of Object.entries(articleDemos)) {
  test(`${id}: real article demo, matching CSS, interactions and narrow reflow`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await openDemo(page, id);
    const workbench = page.locator('.article-demo');
    await expect(workbench).toBeVisible();
    expect(await page.locator('.css-in-action-code pre').textContent()).toBe(demo.css);
    await expect(page.getByRole('link', { name:'Read the full breakdown' })).toHaveAttribute('href', `/articles/${id}/`);
    if (id === 'specificity') {
      await page.getByLabel('Enable the ID rule').check();
      await expect(page.locator('.ad-id-winner')).toBeVisible();
      expect(await page.locator('#ad-invitation').evaluate(el=>getComputedStyle(el).borderColor)).toBe('rgb(32, 55, 43)');
    } else if (id === 'style-queries') {
      await page.getByLabel('Use the warm context').check();
      expect(await page.locator('.ad-style-card').evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(250, 236, 218)');
    } else if (id === 'popovers-anchors') {
      await page.getByRole('button', {name:'Open reading note',exact:true}).click();
      await expect(page.locator('#ad-reading-note')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('#ad-reading-note')).toBeHidden();
    } else if (id === 'page-transitions') {
      await page.getByRole('button',{name:'Open reading view'}).click();
      await expect(page.locator('.ad-page-caption')).toHaveText('The reading view');
    } else if (id === 'modern-resets') {
      await page.getByLabel('Apply a minimal baseline').check();
      expect(await page.locator('.ad-reset-box').evaluate(el=>getComputedStyle(el).boxSizing)).toBe('border-box');
    } else if (id === 'subgrid') {
      expect(await page.locator('.ad-grid-card').first().evaluate(el=>getComputedStyle(el).gridTemplateRows)).toContain('subgrid');
      await page.getByLabel('Share row tracks').uncheck();
      expect(await page.locator('.ad-grid-card').first().evaluate(el=>getComputedStyle(el).gridTemplateRows)).not.toContain('subgrid');
    } else if (id === 'text-margin-trim') {
      await page.getByLabel('Trim the second specimen').check();
      if (await page.evaluate(()=>CSS.supports('text-box-trim','trim-both'))) expect(await page.locator('.ad-trimmed').evaluate(el=>getComputedStyle(el).textBoxTrim)).toBe('trim-both');
    } else if (id === 'flex-safe') {
      await page.getByLabel('Add more invitations').check();
      expect(await page.locator('.ad-flex-row').evaluate(el=>getComputedStyle(el).justifyContent)).toBe('safe center');
    } else if (id === 'color-mix') {
      await page.getByRole('slider',{name:/Amber proportion/}).press('End');
      await expect(page.locator('output')).toHaveText('100%');
    } else if (id === 'smart-selectors') {
      await page.getByLabel('Include a cover image').uncheck();
      await expect(page.locator('.ad-selector-card img')).toHaveCount(0);
      expect(await page.locator('.ad-selector-card').evaluate(el=>getComputedStyle(el).borderWidth)).toBe('2px');
    } else if (id === 'calc-size') {
      const before = (await page.locator('.ad-intrinsic').boundingBox()).height;
      await page.getByLabel('Give this note extra room').check();
      if (await page.evaluate(()=>CSS.supports('block-size','calc-size(auto, size + 4rem)'))) await expect.poll(async ()=>(await page.locator('.ad-intrinsic').boundingBox()).height).toBeGreaterThan(before+40);
      else await expect(page.locator('.ad-fallback')).toBeVisible();
    } else if (id === 'the-layer-rule') {
      await page.getByLabel('Put the base layer last').check();
      await expect(page.locator('.ad-layer-reversed')).toBeVisible();
      expect(await page.locator('.ad-layer-reversed').evaluate(el=>getComputedStyle(el).borderColor)).toBe('rgb(32, 55, 43)');
    } else if (id === 'transition-behavior') {
      await page.getByLabel('Show reading note').uncheck();
      await expect(page.locator('.ad-discrete-note')).toBeHidden();
      await page.getByLabel('Show reading note').check();
      await expect(page.locator('.ad-discrete-note')).toBeVisible();
      await expect(page.locator('.ad-discrete-note')).toHaveCSS('opacity','1');
    } else if (id === 'sibling-index') {
      await page.getByRole('button',{name:'Show forty notes'}).click();
      await expect(page.locator('.ad-notes li')).toHaveCount(40);
      await expect(page.locator('.ad-notes li').last()).toHaveCSS('opacity','1');
    } else if (id === 'scroll-state') {
      await page.locator('.ad-scroll').evaluate(el=>{el.scrollTop=150;});
      await expect(page.locator('.ad-scroll h4')).toBeVisible();
    }
    await page.setViewportSize({width:320,height:900});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    const result = await new AxeBuilder({page}).include('#css-in-action').withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
    expect(result.violations.map(item=>({id:item.id,nodes:item.nodes.map(node=>node.target)}))).toEqual([]);
    await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('all article demos have readable static fallbacks without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({javaScriptEnabled:false,viewport:{width:320,height:900}});
  const page = await context.newPage();
  for (const id of Object.keys(articleDemos)) {
    await page.unrouteAll();
    await openDemo(page,id);
    await expect(page.locator('.article-demo')).toBeVisible();
    await expect(page.locator('.css-in-action-code pre')).toContainText(articleDemos[id].css);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    if (id === 'color-mix') await expect(page.locator('#ad-mix')).toBeHidden();
    if (id === 'page-transitions') await expect(page.getByRole('button',{name:'Open reading view'})).toBeHidden();
  }
  await context.close();
});
