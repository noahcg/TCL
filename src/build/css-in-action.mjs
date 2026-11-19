import { readFeature, selection } from './homepage-feature.mjs';
import { readFileSync } from 'node:fs';
import { escapeHtml as e } from './content.mjs';
import { highlightCode } from './highlight.mjs';

// Manually curated: replace this feature and its scoped demo together.
const feature = {
  eyebrow: 'Ideas to settle into',
  title: 'A Closer Look',
  topic: 'Container queries',
  headline: 'Components that respond to their own space.',
  explanation: 'Container queries let a component adapt to its available width instead of relying on the viewport.',
  articleSlug: 'container-query-units',
  demo: {
    label: 'Make yourself at home',
    title: 'A little room for good ideas.',
    description: 'A comfortable corner. A fresh perspective. Somewhere to stay curious.',
    image: '/assets/lounge-reading-nook.webp',
    imageAlt: 'A caramel lounge chair, a design book and coffee beside a glowing amber lamp in an olive-green reading nook.',
  },
};

// The code window uses the actual demo rules, including their blank lines.
const styles = readFileSync(new URL('../assets/css-in-action.css', import.meta.url), 'utf8');
const baseSnippet = styles.split('/* Demo layout start */')[1].split('/* Demo layout end */')[0].trim();

const homepageConfig = await readFeature();

export function cssInAction(articles, { config = homepageConfig, date = new Date(process.env.TCL_HOMEPAGE_MONTH ? process.env.TCL_HOMEPAGE_MONTH + '-01T12:00:00Z' : Date.now()) } = {}) {
  const selected = selection(config, date);
  const current = { ...feature, ...selected };
  const extra = selected.id === 'container-queries' ? '' : styles.split(`/* ${selected.id} start */`)[1].split(`/* ${selected.id} end */`)[0].trim();
  const snippet = baseSnippet + (extra ? `\n\n${extra}` : '');
  const article = articles.find(entry => entry.type === 'article' && entry.slug === feature.articleSlug && selected.id === 'container-queries');
  return `<section class="css-in-action" id="css-in-action" tabindex="-1" aria-labelledby="css-in-action-title">
    <header class="css-in-action-heading">
      <div><p class="css-in-action-eyebrow">${e(feature.eyebrow)}</p><h2 id="css-in-action-title">${e(feature.title)}<span aria-hidden="true">.</span></h2></div>
      <p class="css-in-action-heading-note">Modern CSS.<br> A little space to explore.</p>
    </header>
    <div class="css-in-action-intro">
      <div><p class="css-in-action-topic">${e(current.topic)}</p><h3>${e(current.headline)}</h3></div>
      <div class="css-in-action-story"><p>${e(current.explanation)}</p><p>Explore the details by adjusting the space around the card.</p>
        ${article ? `<a class="css-in-action-article" href="${e(article.path)}">Read the full breakdown</a>` : ''}
      </div>
    </div>
    <div class="css-in-action-demo" data-technique="${selected.id}">
      <div class="css-in-action-controls" hidden>
        <div class="css-in-action-control-label"><label for="css-in-action-width">Adjust container width</label><span class="css-in-action-readout" id="css-in-action-readout" aria-live="off"></span></div>
        <input id="css-in-action-width" type="range" min="18" max="48" step="0.25" value="40" aria-controls="css-in-action-container" aria-describedby="css-in-action-help">
        <p id="css-in-action-help">Slide to give the card more room. Below 28rem, the image and copy stack. On small screens, the card fits the available space.</p>
      </div>
      <div class="css-in-action-demo-frame">
        <p class="css-in-action-frame-label">One component. Room to change.</p>
        <div class="css-in-action-container" id="css-in-action-container">
          <div class="css-in-action-card">
            <div class="css-in-action-art"><img src="${e(feature.demo.image)}" alt="${e(feature.demo.imageAlt)}" width="1440" height="960" loading="lazy" decoding="async"></div>
            <div class="css-in-action-card-copy"><p>${e(feature.demo.label)}</p><h4>${e(current.demoTitle)}</h4><p>${e(current.demoDescription)}</p><span class="css-in-action-card-signature">The Cascade Lounge</span></div>
          </div>
          <p class="css-in-action-layout" aria-live="off"><span class="css-in-action-stacked">${selected.id === 'aspect-ratio' ? 'Wide image frame · 16:9' : 'Stacked layout · a moment for each detail'}</span><span class="css-in-action-horizontal">${selected.id === 'aspect-ratio' ? 'Square image frame · 1:1' : 'Horizontal layout · a little more room to settle in'}</span></p>
        </div>
      </div>
      <noscript><p class="css-in-action-note">This card adapts to the space available. Enable JavaScript to adjust its width here; the layout itself uses CSS.</p></noscript>
      <p class="css-in-action-unsupported">This browser shows the stacked fallback. Container-query support enables the side-by-side layout.</p>
    </div>
    <div class="css-in-action-source">
      <div><p class="css-in-action-eyebrow">Under the surface</p><h3 id="css-in-action-css-title">The CSS behind it</h3><p>A named container defines the space. A few lines of CSS let the component find its place.</p></div>
      <div class="code-block css-in-action-code"><div class="code-toolbar"><span class="css-in-action-code-label" aria-hidden="true">CSS / ${e(current.topic)}</span><span class="copy-feedback" role="status" aria-live="polite" aria-atomic="true"></span><button type="button" class="css-in-action-copy" hidden>Copy CSS</button></div><pre tabindex="0" aria-labelledby="css-in-action-css-title">${highlightCode(snippet)}</pre></div>
    </div>
  </section>`;
}
