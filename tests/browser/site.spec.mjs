import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { loadContent } from '../../src/build/content.mjs';

const published = await loadContent();
const articles = published.filter(entry => entry.type === 'article').sort((a, b) => (b.date || '').localeCompare(a.date || ''));
const quickWins = published.filter(entry => entry.type === 'quick-win');

test('every article has a unique loaded hero and the archive feature uses the same file', async ({ page, request }) => {
  const images = new Map();
  for (const article of articles) {
    await page.goto(article.path);
    const image = page.locator('.article-cover');
    await expect(image).toBeVisible();
    await expect(image).toHaveAttribute('alt', /\S/);
    await expect.poll(() => image.evaluate(img => img.naturalWidth)).toBe(1200);
    expect(await image.evaluate(img => img.naturalHeight)).toBe(630);
    const source = await image.getAttribute('src');
    const response = await request.get(source);
    expect(response.headers()['content-type']).toBe('image/jpeg');
    images.set(article.path, source);
  }
  expect(new Set(images.values()).size).toBe(articles.length);
  await page.goto('/articles/');
  const feature = page.locator('.archive-feature');
  expect(await feature.locator('img').getAttribute('src')).toBe(images.get(await feature.getAttribute('href')));
});

test('article syntax highlighting is rendered in HTML and copies the original code', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.copiedCode = text; } } });
  });
  await page.goto('/articles/transition-behavior/');
  const css = page.locator('.code-block').filter({ has: page.locator('code.language-css') }).first();
  const html = page.locator('.code-block').filter({ has: page.locator('code.language-html') }).first();
  const js = page.locator('.code-block').filter({ has: page.locator('code.language-javascript') }).first();
  for (const panel of [css, html, js]) {
    expect(await panel.locator('[class^="hljs-"]').count()).toBeGreaterThan(0);
    const original = await panel.locator('pre').textContent();
    await panel.getByRole('button', { name: 'Copy code', exact: true }).click();
    expect(await page.evaluate(() => window.copiedCode)).toBe(original);
  }
  await page.emulateMedia({ forcedColors: 'active' });
  const colorCount = await page.locator('pre code').first().evaluate(code => new Set([code, ...code.querySelectorAll('span')].map(node => getComputedStyle(node).color)).size);
  expect(colorCount).toBe(1);
});

test('rounded interior paper fills mobile viewports and keeps desktop gutters', async ({ page }) => {
  for (const width of [320, 390, 767, 768, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/articles/', '/articles/container-query-units/', '/quick-wins/', '/quick-wins/simplify-slideshows-with-scroll-snap/', '/resources/', '/resources/mdn-web-docs/', '/search/', '/missing-page/']) {
      await page.goto(path);
      const shape = await page.locator('.interior-paper').evaluate(paper => {
        const style = getComputedStyle(paper);
        const box = paper.getBoundingClientRect();
        return { radius: parseFloat(style.borderTopLeftRadius), overflow: style.overflow, background: style.backgroundColor,
          left: box.left, right: innerWidth - box.right, width: box.width };
      });
      expect(shape.radius).toBeGreaterThanOrEqual(32);
      expect(shape.overflow).toBe('visible');
      expect(shape.background).toBe('rgb(250, 236, 218)');
      if (width < 768) {
        expect(Math.abs(shape.left)).toBeLessThan(1);
        expect(Math.abs(shape.width - width)).toBeLessThan(1);
      } else expect(shape.left).toBeGreaterThanOrEqual(12);
      expect(Math.abs(shape.left - shape.right)).toBeLessThan(1);
      expect(shape.width).toBeLessThanOrEqual(1392);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    }
  }
});

test('article opening follows the reading column and the footer clears the content panel', async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/articles/container-query-units/');
    const opening = page.locator('.article-opening');
    const prose = await page.locator('.prose').boundingBox();
    const intro = await opening.boundingBox();
    expect(Math.abs(intro.x - prose.x)).toBeLessThan(1);
    expect(intro.width).toBeLessThanOrEqual(prose.width);
    const letter = await opening.locator('p').evaluate(p => ({
      float: getComputedStyle(p, '::first-letter').float,
      size: parseFloat(getComputedStyle(p, '::first-letter').fontSize),
      textSize: parseFloat(getComputedStyle(p).fontSize),
    }));
    expect(letter.float).toBe('none');
    expect(letter.size).toBeLessThanOrEqual(letter.textSize * 1.1);
    const paper = await page.locator('.interior-paper').boundingBox();
    const footer = await page.getByRole('contentinfo').boundingBox();
    expect(footer.y - (paper.y + paper.height)).toBeGreaterThanOrEqual(40);
  }
});

test('button hovers stay clean and decorative link icons never become underlined text', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  for (const button of await page.locator('.home-button').all()) {
    const resting = await button.evaluate(element => getComputedStyle(element).backgroundColor);
    await button.hover();
    const hovered = await button.evaluate(element => ({ background: getComputedStyle(element).backgroundColor,
      decoration: getComputedStyle(element).textDecorationLine }));
    expect(hovered.decoration).toBe('none');
    expect(hovered.background).not.toBe(resting);
    await page.mouse.move(0, 0);
  }
  await expect(page.locator('.home-button-primary > svg.link-icon')).toHaveAttribute('aria-hidden', 'true');
  await page.goto('/search/');
  const searchButton = page.locator('.search-form .button');
  await searchButton.hover();
  expect(await searchButton.evaluate(element => getComputedStyle(element).textDecorationLine)).toBe('none');
  for (const [path, selector] of [['/resources/mdn-web-docs/', '.back-link'], ['/resources/mdn-web-docs/', '.text-link'],
    ['/articles/container-query-units/', '.contents-top'], ['/missing-page/', '.text-link']]) {
    await page.goto(path);
    const link = page.locator(selector).first();
    await expect(link.locator('svg.link-icon')).toHaveAttribute('aria-hidden', 'true');
    expect(await link.locator('svg').evaluate(element => getComputedStyle(element).textDecorationLine)).toBe('none');
  }
  await page.goto('/resources/');
  const shortlist = page.getByRole('button', { name: 'Show your shortlist', exact: true });
  await shortlist.hover();
  expect(await shortlist.evaluate(element => getComputedStyle(element).textDecorationLine)).toBe('none');
  expect(await shortlist.locator('span').first().evaluate(element => getComputedStyle(element).textDecorationLine)).toBe('underline');
  expect(await shortlist.locator('.resource-saved-count').evaluate(element => getComputedStyle(element).textDecorationLine)).toBe('none');
});

test('home leads to an article with a directly addressable section', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Browse articles', exact: true }).click();
  await expect(page).toHaveURL(/\/articles\/$/);
  const destination = await page.locator('.archive-feature').getAttribute('href');
  await page.locator('.archive-feature').click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const contents = page.getByRole('navigation', { name: 'On this page' });
  if (await contents.locator('details:not([open])').count()) await contents.locator('summary').click();
  const section = contents.getByRole('link').first();
  const hash = await section.getAttribute('href');
  await section.click();
  await page.reload();
  expect(new URL(page.url()).pathname + new URL(page.url()).hash).toBe(destination + hash);
  await expect(page.locator('.prose pre').first()).toBeVisible();
});

for (const method of ['pointer', 'keyboard']) {
  test(`home actions and preserved navigation open their destinations with ${method}`, async ({ page }) => {
    const activate = async link => {
      if (method === 'pointer') await link.click();
      else {
        await link.focus();
        await link.press('Enter');
      }
    };
    const latest = articles[0].path;
    await page.goto('/');
    const latestAction = page.getByRole('link', { name: 'Read the latest', exact: true });
    await expect(latestAction).toHaveAttribute('href', latest);
    await activate(latestAction);
    await expect(page).toHaveURL(new RegExp(`${latest}$`));
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.goto('/');
    await activate(page.getByRole('link', { name: 'Browse articles', exact: true }));
    await expect(page).toHaveURL(/\/articles\/$/);
    for (const [name, path, heading] of [['Articles', '/articles/', 'In-depth CSS for real-world builders.'], ['Quick Wins', '/quick-wins/', 'Quick Wins'], ['Resources', '/resources/', 'Trusted CSS resources in one place.']]) {
      await page.goto('/');
      const link = page.getByRole('navigation', { name: 'Main', exact: true }).getByRole('link', { name, exact: true });
      await expect(link).toHaveAttribute('href', path);
      await expect(page.getByRole('navigation', { name: 'Footer', exact: true }).getByRole('link', { name, exact: true })).toHaveAttribute('href', path);
      await activate(link);
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByRole('heading', { name: heading, level: 1, exact: true })).toBeVisible();
    }
  });
}

for (const method of ['Enter', 'button']) {
  test(`home search submits with ${method} and displays results`, async ({ page }) => {
    await page.goto('/');
    const search = page.getByRole('search', { name: 'Search the Lounge' });
    const query = search.getByRole('searchbox', { name: 'Search the Lounge', exact: true });
    await expect(query).toHaveAttribute('maxlength', '100');
    await expect(query).toHaveAttribute('required', '');
    await query.fill('subgrid');
    if (method === 'Enter') await query.press('Enter');
    else await search.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page).toHaveURL(/\/search\/\?q=subgrid$/);
    await expect(page.getByRole('link', { name: 'When Grid Finally Lines Up with subgrid', exact: true })).toBeVisible();
  });
}

test('home reflows at 320px with enlarged text', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 850 });
  await page.goto('/');
  await page.evaluate(async () => {
    await document.fonts.ready;
    document.documentElement.style.fontSize = '200%';
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test('search returns articles and attributed CSS lookup entries', async ({ page }) => {
  await page.goto('/search/');
  await page.getByRole('searchbox', { name: 'Search CSS', exact: true }).fill('subgrid');
  await page.getByRole('search', { name: 'Search CSS', exact: true }).getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page).toHaveURL(/q=subgrid/);
  await expect(page.getByRole('link', { name: 'When Grid Finally Lines Up with subgrid' })).toBeVisible();
  await page.goto('/search/?q=%40layer');
  await expect(page.getByRole('heading', { name: 'CSS reference · MDN' })).toBeVisible();
  await expect(page.getByRole('link', { name: '@layer', exact: true })).toHaveAttribute('href', /^https:\/\/developer.mozilla.org/);
  await page.goto('/search/?q=does-not-exist-in-tcl');
  await expect(page.getByRole('status').first()).toContainText('No results');
});

test('Quick Wins topic and Resources support direct links', async ({ page, request }) => {
  await page.goto('/quick-wins/?topic=typography');
  await expect(page.getByRole('radio', { name: 'Typography', exact: true })).toBeChecked();
  await expect(page.getByRole('link', { name: 'Balance multi-line headings automatically', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Simplify slideshows with scroll snap', exact: true })).toBeHidden();
  await page.getByRole('link', { name: 'Balance multi-line headings automatically', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Balance multi-line headings automatically');
  await expect(page.locator('pre')).toContainText('text-wrap: balance');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Resources' }).click();
  await page.getByRole('link', { name: 'MDN Web Docs', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Visit MDN Web Docs' })).toBeVisible();
  expect((await request.get('/invalid-route/')).status()).toBe(404);
});

test('legacy demo has keyboard controls and a reported state', async ({ page }) => {
  await page.goto('/articles/transition-behavior/');
  const toggle = page.getByRole('button', { name: 'Close panel' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await toggle.press('Enter');
  await expect(page.getByRole('button', { name: 'Open panel' })).toHaveAttribute('aria-expanded', 'false');
});

test('every indexed TCL slug serves a distinct direct route', async ({ request }) => {
  const index = await (await request.get('/search-index.json')).json();
  expect(new Set(index.content.map(item => item.url)).size).toBe(index.content.length);
  for (const { url, title } of index.content) {
    const response = await request.get(url);
    expect(response.status(), url).toBe(200);
    const escaped = title.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
    const html = await response.text();
    expect(html, url).toContain(`<h1 id="article-title">${escaped}</h1>`);
    expect(html, url).not.toMatch(/watercooler/i);
    expect(html, url).toContain('class="masthead-search"');
    expect(html, url).toContain('class="site-footer"');
  }
});

for (const path of ['/', '/articles/', '/articles/container-query-units/', '/quick-wins/', '/resources/', '/search/?q=%40layer']) {
  test(`WCAG scan and 320px reflow at ${path}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 850 });
    await page.goto(path);
    const violation = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(violation).toBe(false);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(results.violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) }))).toEqual([]);
  });
}

test('curated archive links retain the complete published collection', async ({ page }) => {
  await page.goto('/articles/');
  const feature = page.getByRole('link', { name: 'Sizing Components with Container Query Units', exact: true });
  await expect(feature).toHaveAttribute('href', '/articles/container-query-units/');
  await expect(feature.locator('time')).toHaveAttribute('datetime', '2026-04-09');
  await expect(page.locator('.archive-list a').first()).toHaveAttribute('href', '/articles/modern-resets/');
  expect(await page.locator('.archive-feature,.archive-row').count()).toBe(articles.length);
  await feature.press('Enter');
  await expect(page).toHaveURL(/\/articles\/container-query-units\/$/);
  await page.goto('/articles/');
  await page.getByRole('link', { name: 'Rethinking CSS Resets for Modern CSS', exact: true }).click();
  await expect(page).toHaveURL(/\/articles\/modern-resets\/$/);
});

test('Quick Win showcase copies the expanded example and preserves its source snippet', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.copiedExample = text; } } });
  });
  await page.goto('/quick-wins/simplify-slideshows-with-scroll-snap/');
  const expanded = '.container {\n  scroll-snap-type: x mandatory;\n  overflow-x: auto;\n  display: flex;\n  gap: 1rem;\n}';
  expect(await page.locator('.showcase-code pre').textContent()).toBe(expanded);
  expect(await page.locator('.prose pre').textContent()).toBe('.container {\n  scroll-snap-type: x mandatory;\n}');
  await page.locator('.showcase-code').getByRole('button', { name: 'Copy code', exact: true }).click();
  expect(await page.evaluate(() => window.copiedExample)).toBe(expanded);
  await expect(page.locator('.showcase-code').getByRole('status')).toHaveText('Copied.');
  await expect(page.locator('.quick-published time')).toHaveAttribute('datetime', '2026-03-08');
  await expect(page.locator('.credit')).toHaveCount(0);
});

test('Resources categories resolve to populated sections and real detail routes', async ({ page }) => {
  await page.goto('/resources/');
  for (const [title, id] of [['Documentation', 'documentation'], ['Tools', 'tools'], ['Patterns', 'patterns'], ['Community', 'community']]) {
    await page.getByRole('navigation', { name: 'Resource categories' }).getByRole('link', { name: title, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`#${id}$`));
    await page.reload();
    await expect(page.locator(`#${id}`).getByRole('heading', { level: 2, name: title, exact: true })).toBeInViewport();
    expect(await page.locator(`#${id} a`).count()).toBeGreaterThan(0);
  }
  await expect(page.locator('#tools').getByRole('link', { name: 'Chrome DevTools CSS guide', exact: true })).toHaveAttribute('href', 'https://developer.chrome.com/docs/devtools/css/');
  await page.locator('#documentation').getByRole('link', { name: 'MDN Web Docs', exact: true }).click();
  await expect(page).toHaveURL(/\/resources\/mdn-web-docs\/$/);
  await expect(page.getByRole('link', { name: 'Visit MDN Web Docs' })).toBeVisible();
});

test('article bookmark, share fallback, disclosure, and print work with keyboard', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.copiedArticle = text; } } });
    window.print = () => { window.articlePrinted = true; };
  });
  await page.goto('/articles/container-query-units/');
  const bookmark = page.getByRole('button', { name: 'Bookmark article', exact: true });
  await expect(bookmark).toHaveAttribute('aria-pressed', 'false');
  await bookmark.press('Enter');
  await expect(bookmark).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(bookmark).toHaveAttribute('aria-pressed', 'true');
  await bookmark.click();
  await expect(bookmark).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Share article', exact: true }).click();
  expect(await page.evaluate(() => window.copiedArticle)).toBe(page.url());
  const more = page.getByLabel('More article actions', { exact: true });
  await more.press('Enter');
  await page.getByRole('button', { name: 'Copy link', exact: true }).press('Enter');
  await expect(page.locator('.article-more')).not.toHaveAttribute('open', '');
  await expect(more).toBeFocused();
  await more.press('Enter');
  await page.keyboard.press('Escape');
  await expect(more).toBeFocused();
  await more.press('Enter');
  await page.getByRole('button', { name: 'Print', exact: true }).click();
  expect(await page.evaluate(() => window.articlePrinted)).toBe(true);
  await page.goto('/articles/container-query-units/#why');
  await page.reload();
  await expect(page.locator('#why')).toBeInViewport();
});

test('article actions handle unavailable local storage and clipboard', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new Error('Storage unavailable'); } });
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
  });
  await page.goto('/articles/container-query-units/');
  await expect(page.getByRole('button', { name: 'Bookmark article', exact: true })).toBeHidden();
  await page.getByRole('button', { name: 'Share article', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Article link', exact: true })).toHaveValue(page.url());
  await expect(page.getByRole('textbox', { name: 'Article link', exact: true })).toBeFocused();
  await expect(page.locator('.article-actions').getByRole('status')).toHaveText('Select and copy the article link.');
});

test('all templates share the compact footer and native masthead search', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const path of ['/', '/articles/', '/articles/container-query-units/', '/quick-wins/', '/quick-wins/simplify-slideshows-with-scroll-snap/', '/resources/', '/resources/mdn-web-docs/', '/search/', '/missing-page/']) {
    await page.goto(path);
    await expect(page.locator('.masthead .lounge-brand')).toHaveAccessibleName('The Cascade Lounge');
    await expect(page.getByRole('search', { name: 'Search the Lounge', exact: true })).toBeVisible();
    await expect(page.getByRole('contentinfo').getByRole('link', { name: 'The Cascade Lounge', exact: true })).toHaveCount(1);
    expect((await page.getByRole('contentinfo').boundingBox()).height).toBeLessThan(140);
    expect(await page.locator('body').innerHTML()).not.toMatch(/watercooler/i);
  }
  await page.goto('/resources/mdn-web-docs/');
  await page.getByRole('searchbox', { name: 'Search the Lounge', exact: true }).fill('subgrid');
  await page.getByRole('searchbox', { name: 'Search the Lounge', exact: true }).press('Enter');
  await expect(page).toHaveURL(/\/search\/\?q=subgrid$/);
  await expect(page.getByRole('link', { name: 'When Grid Finally Lines Up with subgrid', exact: true })).toBeVisible();
});

test('desktop reading guide stays sticky and follows a section jump', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/articles/container-query-units/#why');
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => window.scrollBy(0, 500));
  const guide = page.getByRole('navigation', { name: 'On this page', exact: true });
  await expect.poll(async () => Math.round((await guide.boundingBox()).y)).toBe(24);
  await page.evaluate(() => window.scrollBy(0, 450));
  await expect.poll(async () => Math.round((await guide.boundingBox()).y)).toBe(24);
  await expect(guide.locator('ul a[aria-current="location"]')).toHaveCount(1);
  await guide.locator('a[href="#gotchas"]').click();
  await expect(page).toHaveURL(/#gotchas$/);
  await expect(guide.locator('a[href="#gotchas"]')).toHaveAttribute('aria-current', 'location');
  await page.reload();
  await expect(page.locator('#gotchas')).toBeInViewport();
  await expect(guide.locator('a[href="#gotchas"]')).toHaveAttribute('aria-current', 'location');
});

test('phone reading guide expands with keyboard and preserves the native deep link', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 850 });
  await page.goto('/articles/container-query-units/');
  const guide = page.getByRole('navigation', { name: 'On this page', exact: true });
  await expect(guide.locator('details')).not.toHaveAttribute('open', '');
  await guide.locator('summary').press('Enter');
  await expect(guide.locator('details')).toHaveAttribute('open', '');
  await guide.locator('a[href="#why"]').press('Enter');
  await expect(page).toHaveURL(/#why$/);
  await expect(page.locator('#why')).toBeInViewport();
  expect(await guide.evaluate(el => getComputedStyle(el).position)).toBe('static');
});

test('Quick Wins copy is readable and reflows at 320px with enlarged text', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 850 });
  await page.goto('/quick-wins/');
  await expect(page.locator('.quick-list')).toContainText('expand/collapse');
  await expect(page.locator('.quick-list')).not.toContainText('&#x2F;');
  await page.evaluate(async () => {
    await document.fonts.ready;
    document.documentElement.style.fontSize = '200%';
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test('Quick Wins is a compact three-column toolkit with copyable source snippets', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.quickCopied = text; } } });
  });
  await page.goto('/quick-wins/');
  expect((await page.locator('.quick-workbench').boundingBox()).y).toBeLessThan(360);
  const cards = page.locator('.quick-card');
  await expect(cards).toHaveCount(quickWins.length);
  const first = await cards.nth(0).boundingBox();
  const second = await cards.nth(1).boundingBox();
  const third = await cards.nth(2).boundingBox();
  expect(Math.abs(first.y - second.y)).toBeLessThan(1);
  expect(Math.abs(first.y - third.y)).toBeLessThan(1);
  const original = await cards.first().locator('pre').textContent();
  await cards.first().getByRole('button', { name: 'Copy code', exact: true }).click();
  expect(await page.evaluate(() => window.quickCopied)).toBe(original);
  const has = page.locator('.quick-card').filter({ hasText: 'Style one element based on another' });
  await has.getByRole('checkbox', { name: 'Include an image' }).check();
  await expect(has.locator('.qp-has-target img')).toBeVisible();
  expect(await has.locator('.qp-has-target').evaluate(target => getComputedStyle(target).borderColor)).toBe('rgb(163, 68, 12)');
});

test('Quick Wins combines topic and keyword filters, preserves URLs, and recovers from empty results', async ({ page }) => {
  await page.goto('/quick-wins/');
  await page.getByRole('radio', { name: 'Typography', exact: true }).check();
  await page.getByRole('searchbox', { name: 'Find a quick win', exact: true }).fill('clamp');
  await expect(page.locator('.quick-grid > li:visible')).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Create fluid typography that scales', exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.get('topic')).toBe('typography');
  expect(new URL(page.url()).searchParams.get('q')).toBe('clamp');
  await page.reload();
  await expect(page.getByRole('searchbox', { name: 'Find a quick win', exact: true })).toHaveValue('clamp');
  await expect(page.locator('.quick-grid > li:visible')).toHaveCount(1);
  await page.getByRole('searchbox', { name: 'Find a quick win', exact: true }).fill('no-matching-technique');
  await expect(page.getByRole('heading', { name: 'No quick wins found.' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(page.locator('.quick-grid > li:visible')).toHaveCount(quickWins.length);
  await expect(page.getByRole('radio', { name: 'All wins', exact: true })).toBeChecked();
  expect(new URL(page.url()).search).toBe('');
});
