import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('CSS reading paths work without JavaScript and connect to related articles', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled:false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:8869/');
  await page.getByRole('navigation',{name:'Learn CSS by topic',exact:true}).getByRole('link',{name:'CSS Selectors and the Cascade',exact:true}).click();
  await expect(page).toHaveURL(/\/topics\/selectors-and-cascade\/$/);
  await page.getByRole('link',{name:'Understanding CSS Specificity (Without the Headaches)',exact:true}).click();
  await expect(page).toHaveURL(/\/articles\/specificity\/$/);
  const related = page.locator('.related-reading');
  await expect(related).toBeVisible();
  await expect(related.locator('li a')).toHaveCount(3);
  await related.getByRole('link',{name:'CSS Selectors and the Cascade',exact:true}).click();
  await expect(page).toHaveURL(/\/topics\/selectors-and-cascade\/$/);
  await context.close();
});

test('topic pages remain readable and accessible on desktop and narrow viewports', async ({ page }, testInfo) => {
  for (const width of [1440,320]) {
    await page.setViewportSize({width,height:1000});
    for (const path of ['/topics/','/topics/responsive-layout/','/topics/selectors-and-cascade/','/topics/animation-and-scrolling/','/topics/typography-and-color/','/topics/forms-and-accessibility/']) {
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await expect(page.locator('h1')).toHaveCount(1);
      const results = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
      expect(results.violations).toEqual([]);
      if (path === '/topics/responsive-layout/') await page.screenshot({path:testInfo.outputPath(`css-topic-${width}.png`),fullPage:true});
    }
  }
  await page.setViewportSize({width:320,height:900});
  await page.goto('/topics/responsive-layout/');
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test('previews stay noindex and the legacy terminology correction is visible', async ({ page }) => {
  await page.goto('/topics/');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content','noindex, follow');
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
  await page.goto('/articles/text-margin-trim/');
  const note = page.getByRole('complementary',{name:'CSS terminology correction'});
  await expect(note).toContainText('text-box-trim');
  await expect(note.getByRole('link',{name:'current text-box-trim example'})).toHaveAttribute('href','/quick-wins/trim-unwanted-spacing-from-text-edges/');
});

test('topic browsing follows the article collection and remains compact and usable', async ({ page }, testInfo) => {
  for (const width of [1440,768,390,320]) {
    await page.setViewportSize({width,height:1000});
    await page.goto('/articles/');
    const navigation=page.getByRole('navigation',{name:'Learn CSS by topic',exact:true});
    const collection=await page.locator('.archive-list').boundingBox();
    const panel=await navigation.boundingBox();
    expect(panel.y).toBeGreaterThan(collection.y+collection.height);
    await expect(navigation.getByRole('link')).toHaveCount(6);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1)).toBe(true);
    await navigation.scrollIntoViewIfNeeded();
    if (width===1440 || width===390) await navigation.screenshot({path:testInfo.outputPath(`topic-navigation-${width}.png`)});
    const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    expect(results.violations).toEqual([]);
    await navigation.getByRole('link',{name:'CSS Selectors and the Cascade',exact:true}).click();
    await expect(page).toHaveURL(/\/topics\/selectors-and-cascade\/$/);
  }
  await page.setViewportSize({width:320,height:900});
  await page.goto('/articles/');
  await page.evaluate(()=>{ document.documentElement.style.fontSize='200%'; });
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1)).toBe(true);
});
