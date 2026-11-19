import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';

const layout = page => page.locator('.css-in-action-card').evaluate(card => {
  const [art, copy] = [...card.children].map(child => child.getBoundingClientRect());
  return Math.abs(art.top - copy.top) < 1 ? 'horizontal' : 'stacked';
});
const noOverflow = async page => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);

test('A Closer Look uses container width for layout, with native keyboard controls and a real article', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#css-in-action');
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => page.locator('.css-in-action-art img').evaluate(image => image.naturalWidth)).toBe(1440);
  const slider = page.getByRole('slider', { name: 'Adjust container width', exact: true });
  await slider.focus();
  await slider.press('Home');
  await expect.poll(() => layout(page)).toBe('stacked');
  await expect(page.locator('.css-in-action-stacked')).toBeVisible();
  await expect(page.locator('.css-in-action-readout')).toHaveText('18rem (288px)');
  await slider.press('End');
  await expect.poll(() => layout(page)).toBe('horizontal');
  await expect(page.locator('.css-in-action-horizontal')).toBeVisible();
  await expect(page.locator('.css-in-action-readout')).toHaveText('48rem (768px)');
  await slider.press('ArrowLeft');
  await expect(slider).toHaveValue('47.75');
  await expect(slider).toHaveAttribute('aria-valuetext', '47.75rem requested; 47.75rem (764px) available');
  const styles = await slider.evaluate(input => ({ outline: getComputedStyle(input).outlineStyle, height: input.getBoundingClientRect().height }));
  expect(styles.outline).toBe('solid');
  expect(styles.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => innerWidth)).toBe(1440);
  await expect(page.locator('.home-card,.home-destinations')).toHaveCount(0);
  await page.getByRole('link', { name: 'Read the full breakdown', exact: true }).press('Enter');
  await expect(page).toHaveURL(/\/articles\/container-query-units\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sizing Components with Container Query Units');
});

test('the displayed CSS is the implemented layout and copies with polite feedback', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.copiedDemo = text; } } });
  });
  await page.goto('/#css-in-action');
  const css = await readFile(new URL('../../src/assets/css-in-action.css', import.meta.url), 'utf8');
  const expected = css.split('/* Demo layout start */')[1].split('/* Demo layout end */')[0].trim();
  expect(await page.locator('.css-in-action-code pre').textContent()).toBe(expected);
  expect(expected).toContain('}\n\n.css-in-action-card');
  expect(expected).toContain('}\n\n@container');
  await page.getByRole('button', { name: 'Copy CSS', exact: true }).press('Enter');
  expect(await page.evaluate(() => window.copiedDemo)).toBe(expected);
  await expect(page.locator('.css-in-action-code [role="status"]')).toHaveText('CSS copied.');
  await expect(page.locator('.css-in-action-readout')).toHaveAttribute('aria-live', 'off');
});

for (const clipboard of ['denied', 'unavailable']) {
  test(`copy ${clipboard} leaves selectable CSS and announces the fallback`, async ({ page }) => {
    await page.addInitScript(state => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: state === 'unavailable' ? undefined : { writeText: async () => { throw new Error('Denied'); } } });
    }, clipboard);
    await page.goto('/#css-in-action');
    await page.getByRole('button', { name: 'Copy CSS', exact: true }).click();
    await expect(page.locator('.css-in-action-code [role="status"]')).toHaveText('Could not copy. Select the CSS to copy it manually.');
    expect(await page.locator('.css-in-action-code pre').evaluate(pre => {
      const range = document.createRange();
      range.selectNodeContents(pre);
      getSelection().removeAllRanges();
      getSelection().addRange(range);
      return getSelection().toString();
    })).toContain('container-type: inline-size');
  });
}

test('touch/pointer resizing clamps to its parent and reflows at 200% text size', async ({ page, isMobile }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/#css-in-action');
  const slider = page.getByRole('slider', { name: 'Adjust container width', exact: true });
  await slider.scrollIntoViewIfNeeded();
  const box = await slider.boundingBox();
  if (isMobile) await page.touchscreen.tap(box.x + box.width - 2, box.y + box.height / 2);
  else await page.mouse.click(box.x + box.width - 2, box.y + box.height / 2);
  expect(Number(await slider.inputValue())).toBeGreaterThan(40);
  const readWidth = () => page.locator('.css-in-action-container').evaluate(el => Math.round(el.getBoundingClientRect().width));
  await expect.poll(() => page.locator('.css-in-action-readout').textContent()).toContain(`(${await readWidth()}px)`);
  await expect.poll(() => layout(page)).toBe('stacked');
  await noOverflow(page);
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  await noOverflow(page);
  const results = await new AxeBuilder({ page }).include('.css-in-action').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) }))).toEqual([]);
});

test('the static demo, snippet and article stay useful without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 900 } });
  const page = await context.newPage();
  await page.goto('/#css-in-action');
  await expect(page.getByRole('heading', { name: 'A Closer Look', exact: true })).toBeVisible();
  await expect(page.locator('.css-in-action-card')).toBeVisible();
  await expect(page.getByRole('slider')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Copy CSS', exact: true })).toBeHidden();
  await expect(page.locator('.css-in-action-note')).toBeVisible();
  await expect(page.locator('.css-in-action-code pre')).toContainText('@container lounge-card (min-width: 28rem)');
  await noOverflow(page);
  await context.close();
});

test('the demo stays stacked when container queries are ignored', async ({ page }) => {
  await page.route('**/css-in-action.css', async route => {
    const response = await route.fetch();
    const css = (await response.text()).replaceAll(/@container lounge-card\s*\(min-width:\s*28rem\)/g, '@media not all').replace('@supports not (container-type:inline-size)', '@supports (display:block)');
    await route.fulfill({ response, body: css });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#css-in-action');
  await page.getByRole('slider').press('End');
  await expect.poll(() => layout(page)).toBe('stacked');
  await expect(page.locator('.css-in-action-unsupported')).toBeVisible();
});

test('forced colors and reduced motion preserve the feature and keyboard focus', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await page.goto('/#css-in-action');
  await page.getByRole('slider').focus();
  expect(await page.getByRole('slider').evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
  await noOverflow(page);
  const colors = await page.locator('.css-in-action-code pre code').evaluate(code => new Set([code, ...code.querySelectorAll('span')].map(el => getComputedStyle(el).color)).size);
  expect(colors).toBe(1);
  const results = await new AxeBuilder({ page }).include('.css-in-action').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations.map(item => item.id)).toEqual([]);
});

for (const id of ['fluid-type', 'aspect-ratio']) {
  test(`${id} renders a working CSS-driven variation`, async ({ page }) => {
    const { readFeature } = await import('../../src/build/homepage-feature.mjs');
    const { cssInAction } = await import('../../src/build/css-in-action.mjs');
    const config = await readFeature();
    await page.route('**/', async route => {
      if (new URL(route.request().url()).pathname !== '/') return route.continue();
      const response = await route.fetch();
      const html = (await response.text()).replace(/<section class="css-in-action"[\s\S]*?<\/section>/, cssInAction([], { config: { ...config, mode: 'manual', pinned: id } }));
      await route.fulfill({ response, body: html });
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/#css-in-action');
    const slider = page.getByRole('slider', { name: 'Adjust container width' });
    await slider.press('Home');
    const size = () => page.locator('.css-in-action-card h4').evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    const small = await size();
    if (id === 'aspect-ratio') expect(await page.locator('.css-in-action-art').evaluate(el => getComputedStyle(el).aspectRatio)).toBe('16 / 9');
    await slider.press('End');
    if (id === 'fluid-type') expect(await size()).toBeGreaterThan(small);
    else expect(await page.locator('.css-in-action-art').evaluate(el => getComputedStyle(el).aspectRatio)).toBe('1 / 1');
    await noOverflow(page);
  });
}
