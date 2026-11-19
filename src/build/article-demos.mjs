import { escapeHtml as e } from './content.mjs';

const check = (id, text, checked = false) => `<label class="ad-control"><input type="checkbox" id="${id}"${checked ? ' checked' : ''}><span>${text}</span></label>`;
const sample = (text = 'A little room for good ideas.') => `<div class="ad-sample">${text}</div>`;
export const articleDemos = {
  'scroll-state': {
    help: 'Scroll the reading panel. Its heading stays nearby; supported browsers label it when stuck.',
    html: `<div class="ad-scroll" tabindex="0" role="region" aria-label="Scrollable reading example"><p>Scroll a little to reach the chapter.</p><h4><span>A quiet corner</span><span class="ad-stuck"> · Reading now</span></h4>${Array.from({length:6},(_,i)=>`<p>A little space for idea ${i+1}. Keep reading, and notice how the heading stays within reach.</p>`).join('')}</div>`,
    css: `.ad-scroll { max-block-size: 16rem; overflow: auto; }

.ad-scroll h4 {
  position: sticky;
  top: 0;
  container-name: reading-heading;
  container-type: scroll-state;
}

.ad-scroll .ad-stuck { display: none; }

@container reading-heading scroll-state(stuck: top) {
  .ad-stuck { display: inline; }
}`,
    support: 'container-type: scroll-state',
    fallback: 'Sticky headings and native scrolling still work here. This browser does not support the extra scroll-state label.',
  },
  specificity: {
    help: 'Enable a class rule, an ID rule, or both. The stronger selector determines the invitation’s border and message.',
    html: `${check('ad-class-rule','Enable the class rule',true)}${check('ad-id-rule','Enable the ID rule')}<div class="ad-specificity-target" id="ad-invitation"><strong>You’re always welcome.</strong><p class="ad-class-winner">Class rule wins</p><p class="ad-id-winner">ID rule wins</p></div>`,
    css: `.ad-specificity .ad-specificity-target { border: 4px solid #49604c; }

.ad-specificity:has(#ad-class-rule:checked) .ad-specificity-target {
  border-color: #a3440c;
}

.ad-specificity:has(#ad-id-rule:checked) #ad-invitation {
  border-color: #20372b;
}

.ad-class-winner, .ad-id-winner { display: none; }

.ad-specificity:has(#ad-class-rule:checked):not(:has(#ad-id-rule:checked)) .ad-class-winner,
.ad-specificity:has(#ad-id-rule:checked) .ad-id-winner { display: block; }`,
  },
  'style-queries': {
    help: 'Choose a warm context. A custom property carries that context to the nested invitation.',
    html: `${check('ad-warm','Use the warm context')}<div class="ad-style-context"><div class="ad-style-card"><h4>Make yourself at home.</h4><p>One component, styled by its surroundings.</p></div></div>`,
    css: `.ad-style-context { --lounge-mood: quiet; }

.ad-style-queries:has(#ad-warm:checked) .ad-style-context {
  --lounge-mood: warm;
}

.ad-style-context .ad-style-card { padding: 1.5rem; background: #e7ecdf; border: 3px solid #49604c; }

@container style(--lounge-mood: warm) {
  .ad-style-context .ad-style-card { padding: 2.5rem; background: #faecda; border-color: #a3440c; }
}`,
    fallback: 'The base invitation stays readable. Style-query support varies independently of size queries; compare the two states in your target browser.',
  },
  'popovers-anchors': {
    help: 'Open the reading note. Click outside or press Escape to dismiss the native popover.',
    html: `<button type="button" popovertarget="ad-reading-note" class="ad-anchor-trigger">Open reading note</button><div id="ad-reading-note" popover><h4>A note worth keeping.</h4><p>The browser handles the overlay and dismissal.</p><button type="button" popovertarget="ad-reading-note" popovertargetaction="hide">Close note</button></div>`,
    css: `.ad-anchor-trigger { anchor-name: --reading-note; }

#ad-reading-note {
  max-inline-size: min(22rem, calc(100vw - 2rem));
  padding: 1.5rem;
  background: #faecda;
  color: #20372b;
}

@supports (position-area: block-end) {
  #ad-reading-note {
    position-anchor: --reading-note;
    position-area: block-end;
    position-try-fallbacks: flip-block, flip-inline;
    margin: .5rem;
  }
}`,
    support: 'position-area: block-end',
    fallback: 'The native popover uses its default placement when anchor positioning is unavailable. Browsers without popovers show the note in normal flow.',
  },
  'page-transitions': {
    help: 'Switch between the collection and reading views. View Transitions connects the two states when available.',
    html: `<div class="ad-page-view"><p class="ad-page-caption">The collection</p><h4 class="ad-page-title">A little room for good ideas.</h4><p class="ad-page-description">An invitation to read something new.</p></div><button type="button" data-ad-action="page" hidden>Open reading view</button><noscript><p>The collection view stays readable without JavaScript.</p></noscript>`,
    css: `.ad-page-view { view-transition-name: lounge-reading-view; }

.ad-page-transitions[data-reading="true"] .ad-page-view { padding-block: 3rem; background: #20372b; color: #fff9eb; }

::view-transition-group(lounge-reading-view) { animation-duration: .3s; }

@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*) { animation: none !important; }
}`,
    fallback: 'Without View Transitions, the button changes views immediately. This is a same-document navigation preview; real article routes remain normal links.',
  },
  'modern-resets': {
    help: 'Compare content-box with border-box. Both frames request the same width and padding.',
    html: `${check('ad-reset','Apply a minimal baseline')}<div class="ad-reset-frame"><div class="ad-reset-box"><h4>Room, measured.</h4><p>Padding belongs inside this frame when border-box is enabled.</p><button type="button">A native control</button></div></div><p>The baseline also removes the heading’s default margin and lets the button inherit its font.</p>`,
    css: `.ad-reset-box { box-sizing: content-box; width: 75%; padding: 1.5rem; border: 3px solid #a3440c; }

.ad-modern-resets:has(#ad-reset:checked) .ad-reset-box,
.ad-modern-resets:has(#ad-reset:checked) .ad-reset-box * { box-sizing: border-box; }

.ad-modern-resets:has(#ad-reset:checked) .ad-reset-box h4 { margin: 0; }

.ad-modern-resets:has(#ad-reset:checked) .ad-reset-box button { font: inherit; }`,
  },
  subgrid: {
    help: 'Toggle shared tracks. The longer description shows why nested cards benefit from subgrid.',
    html: `${check('ad-subgrid','Share row tracks',true)}<div class="ad-grid">${['A quiet corner','Something worth reading','Stay a while'].map((title,i)=>`<div class="ad-grid-card"><h4>${title}</h4><p>${i===1?'A longer description takes a little more room, while the other cards keep their copy short.':'A good idea, close at hand.'}</p><span>Reading notes</span></div>`).join('')}</div>`,
    css: `.ad-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; }

.ad-grid-card { display: grid; grid-row: span 3; grid-template-rows: auto 1fr auto; gap: 1rem; }

.ad-subgrid:has(#ad-subgrid:checked) .ad-grid-card { grid-template-rows: subgrid; }

@media (max-width: 40rem) { .ad-grid { grid-template-columns: minmax(0, 1fr); } }`,
    support: 'grid-template-rows: subgrid',
    fallback: 'Independent grids keep all card content readable when shared subgrid tracks are unavailable.',
  },
  'text-margin-trim': {
    help: 'Toggle text-edge trimming and compare the line boxes against the specimen borders. The current CSS property is text-box-trim.',
    html: `${check('ad-trim','Trim the second specimen')}<div class="ad-type-specimen">Good ideas.</div><div class="ad-type-specimen ad-trimmed">Good ideas.</div><p>The first line box is unchanged. The second uses cap-height and alphabetic-baseline edges when supported.</p>`,
    css: `.ad-type-specimen { font: 500 2.75rem/1.7 Newsreader, Georgia, serif; border-block: 2px solid #a3440c; margin-block: 1.5rem; }

.ad-text-margin-trim:has(#ad-trim:checked) .ad-trimmed {
  text-box-trim: trim-both;
  text-box-edge: cap alphabetic;
}`,
    support: 'text-box-trim: trim-both',
    fallback: 'Both specimens retain their original line boxes in this browser. The article’s older property name needs editorial review.',
  },
  'flex-safe': {
    help: 'Add more invitations, then choose safe centering. Overflow should begin where the first item stays reachable.',
    html: `${check('ad-safe','Use safe centering',true)}${check('ad-more-items','Add more invitations')}<div class="ad-flex-row" tabindex="0" role="region" aria-label="Scrollable alignment comparison">${Array.from({length:7},(_,i)=>`<span${i>2?' class="ad-extra"':''}>Idea ${i+1}</span>`).join('')}</div>`,
    css: `.ad-flex-row { display: flex; justify-content: center; gap: .75rem; overflow: auto; max-inline-size: 24rem; }

.ad-flex-row > span { flex: 0 0 6rem; padding: 1rem; background: #e7ecdf; }

.ad-flex-safe:has(#ad-safe:checked) .ad-flex-row { justify-content: safe center; }

.ad-flex-safe .ad-extra { display: none; }

.ad-flex-safe:has(#ad-more-items:checked) .ad-extra { display: block; }`,
  },
  'color-mix': {
    help: 'Adjust the amber proportion. Compare two real CSS color spaces; the labels stay readable independently of the swatches.',
    html: `<div data-ad-enhancement hidden><label class="ad-control" for="ad-mix">Amber proportion <output for="ad-mix">35%</output></label><input id="ad-mix" type="range" min="0" max="100" value="35" data-ad-property="--mix" data-ad-unit="%"></div><noscript><p>Static comparison: 35% amber in each color space.</p></noscript><div class="ad-swatches"><div><span class="ad-swatch ad-srgb"></span><strong>sRGB</strong></div><div><span class="ad-swatch ad-oklch"></span><strong>OKLCH</strong></div></div>`,
    css: `.ad-color-mix { --mix: 35%; }

.ad-swatch { display: block; block-size: 8rem; background: #49604c; border: 1px solid #49604c; }

.ad-srgb { background: color-mix(in srgb, #efb185 var(--mix), #20372b); }

.ad-oklch { background: color-mix(in oklch, #efb185 var(--mix), #20372b); }`,
    support: 'background: color-mix(in oklch, red, blue)',
    fallback: 'Fixed green swatches remain visible here. Color mixing does not guarantee text contrast; labels use a separate fixed palette.',
  },
  'smart-selectors': {
    help: 'Include a cover image. :has() notices the content; :is() groups matching elements and :where() keeps the baseline selector gentle.',
    html: `<div data-ad-enhancement hidden>${check('ad-include-image','Include a cover image',true)}</div><div class="ad-selector-card"><img src="/assets/lounge-reading-nook.webp" alt="Warm lounge reading corner" width="1440" height="960"><h4>Good ideas belong here.</h4><p>A card that notices its own content.</p></div>`,
    css: `.ad-smart-selectors :where(.ad-selector-card) { border: 2px solid #49604c; padding: 1rem; }

.ad-selector-card :is(h4, p) { margin-block: .75rem; }

.ad-selector-card:has(img) { border-color: #a3440c; border-width: 5px; }

.ad-selector-card img { max-block-size: 10rem; inline-size: 100%; object-fit: cover; }`,
  },
  'calc-size': {
    help: 'Ask for extra room around an intrinsically sized note. Supported browsers calculate from auto instead of guessing a fixed height.',
    html: `${check('ad-extra-room','Give this note extra room')}<div class="ad-intrinsic"><h4>A note worth keeping.</h4><p>The content determines the starting height.</p></div>`,
    css: `.ad-intrinsic { block-size: auto; padding: 1rem; border: 2px solid #a3440c; transition: block-size .35s; }

.ad-calc-size:has(#ad-extra-room:checked) .ad-intrinsic {
  block-size: calc-size(auto, size + 4rem);
}

@media (prefers-reduced-motion: reduce) { .ad-intrinsic { transition: none; } }`,
    support: 'block-size: calc-size(auto, size + 4rem)',
    fallback: 'calc-size() is unavailable here. The note keeps its ordinary content-based height rather than clipping content.',
  },
  'the-layer-rule': {
    help: 'Compare two declared layer orders. The selectors are identical in strength; the order of the layers decides the border.',
    html: `${check('ad-layer-order','Put the base layer last')}<div class="ad-layer-standard">Utilities last · amber border</div><div class="ad-layer-reversed">Base last · green border</div>`,
    css: `@layer lounge-base, lounge-utilities;
@layer lounge-utilities-first, lounge-base-last;

@layer lounge-base { .ad-layer-standard { border: 4px solid #20372b; } }
@layer lounge-utilities { .ad-layer-standard { border: 4px solid #a3440c; } }

@layer lounge-utilities-first { .ad-layer-reversed { border: 4px solid #a3440c; } }
@layer lounge-base-last { .ad-layer-reversed { border: 4px solid #20372b; } }

.ad-layer-reversed { display: none; }
.ad-the-layer-rule:has(#ad-layer-order:checked) .ad-layer-standard { display: none; }
.ad-the-layer-rule:has(#ad-layer-order:checked) .ad-layer-reversed { display: block; }`,
    fallback: 'This example uses normal declarations. Important declarations reverse layer precedence; unlayered normal styles also have different precedence.',
  },
  'transition-behavior': {
    help: 'Show and hide the note. Supporting browsers coordinate opacity with the discrete display change.',
    html: `${check('ad-note-open','Show reading note',true)}<div class="ad-discrete-note"><h4>Stay a little longer.</h4><p>A gentle entrance, and an unhurried goodbye.</p></div>`,
    css: `.ad-discrete-note {
  display: none;
  opacity: 0;
  transition: opacity .35s, display .35s allow-discrete;
}

.ad-transition-behavior:has(#ad-note-open:checked) .ad-discrete-note { display: block; opacity: 1; }

@starting-style {
  .ad-transition-behavior:has(#ad-note-open:checked) .ad-discrete-note { opacity: 0; }
}

@media (prefers-reduced-motion: reduce) { .ad-discrete-note { transition: none; } }`,
    support: 'transition-behavior: allow-discrete',
    fallback: 'The checkbox still opens and closes the note immediately when discrete transitions are unsupported.',
  },
  'sibling-index': {
    help: 'Switch between seven and forty notes and replay the decorative entrance. Every line of text is readable immediately.',
    html: `<button type="button" data-ad-action="batch" hidden>Show forty notes</button><button type="button" data-ad-action="replay" hidden>Replay decoration</button><ol class="ad-notes" tabindex="0" aria-label="Reading notes">${Array.from({length:7},(_,i)=>`<li>Reading note ${i+1}: a good idea is ready.</li>`).join('')}</ol>`,
    css: `.ad-notes { max-block-size: 18rem; overflow: auto; }

.ad-notes li { position: relative; padding-inline-start: .75rem; }

@supports (animation-delay: calc(min(sibling-index(), 5) * 40ms)) {
  .ad-notes.ad-replay li::before {
    content: '';
    position: absolute;
    inset: .2rem auto .2rem 0;
    inline-size: 3px;
    background: #a3440c;
    animation: lounge-note .25s both;
    animation-delay: calc((min(sibling-index(), 5) - 1) * 40ms);
  }
}

@keyframes lounge-note { from { transform: scaleY(0); } to { transform: scaleY(1); } }

@media (prefers-reduced-motion: reduce) { .ad-notes li::before { animation: none !important; } }`,
    support: 'animation-delay: calc(min(sibling-index(), 5) * 40ms)',
    fallback: 'This browser shows a static, fully readable list. The motion budget is capped at the fifth note when sibling-index() is supported.',
  },
};

const effects = {
  'scroll-state': 'The chapter heading stays visible. In supporting browsers, a Reading now label appears while it is stuck to the top edge.',
  specificity: 'The invitation border and winner label reveal which of the two competing selectors wins.',
  'page-transitions': 'The collection changes into a reading preview, with a shared named view and a native transition when supported.',
  'modern-resets': 'The box changes how it accounts for padding and borders; heading margins and the native control font adopt a minimal baseline.',
  'color-mix': 'Two swatches respond to the same amber proportion, showing the difference between sRGB and OKLCH mixing.',
  'smart-selectors': 'Adding a cover changes the border through :has(); the CSS shows :is() grouping and a low-specificity :where() baseline.',
};
for (const [id,result] of Object.entries(effects)) articleDemos[id].result = result;

export function renderArticleDemo(id) {
  const demo = articleDemos[id];
  return `<div class="article-demo ad-${id}" data-article-demo="${id}"><p class="ad-help">${e(demo.help)}</p><div class="ad-workbench">${demo.html}</div>${demo.fallback ? `<p class="ad-fallback"${demo.support ? ` data-ad-support="${e(demo.support)}"` : ''}>${e(demo.fallback)}</p>` : ''}</div>`;
}

export const demoStyles = `
.article-demo { padding:clamp(1rem,3vw,2.5rem); border:1px solid #7e8b6d; border-radius:1rem; background:#faecda; color:#20372b; min-width:0; }
.article-demo .ad-help { max-width:70ch; margin-bottom:1.5rem; }
.article-demo .ad-workbench { min-width:0; }
.article-demo h4 { font:500 1.7rem/1.15 Newsreader,Georgia,serif; margin:0 0 .75rem; overflow-wrap:anywhere; }
.article-demo p { margin-block:.75rem; }
.article-demo .ad-control { display:inline-flex; gap:.65rem; align-items:center; min-height:44px; margin:0 1rem 1rem 0; font-size:1rem; }
.article-demo .ad-control { max-inline-size:100%; flex-wrap:wrap; }
.article-demo .ad-control > span { flex:1; min-inline-size:0; }
.article-demo input[type=checkbox] { flex:none; padding:0; inline-size:1.2rem; min-height:1.2rem; block-size:1.2rem; accent-color:#a3440c; }
.article-demo button { padding:.65rem 1rem; min-height:44px; border:1px solid #49604c; border-radius:.5rem; background:#20372b; color:#fff9eb; font:600 1rem/1.3 'DM Sans',sans-serif; margin:.25rem .5rem .75rem 0; cursor:pointer; }
.article-demo .ad-fallback { font-size:.875rem; border-top:1px solid #b4b799; padding-top:1rem; }
.article-demo input[type=range] { inline-size:min(100%,28rem); padding:0; accent-color:#a3440c; min-height:44px; }
.article-demo .ad-specificity-target,.article-demo .ad-style-card,.article-demo .ad-grid-card,.article-demo .ad-selector-card,.article-demo .ad-discrete-note,.article-demo .ad-page-view,.article-demo .ad-layer-standard,.article-demo .ad-layer-reversed { padding:1.5rem; background:#fff9eb; border-radius:.6rem; }
.article-demo .ad-scroll { padding:1rem; background:#fff9eb; }
.article-demo .ad-scroll h4 { background:#e7ecdf; padding:1rem; }
.article-demo .ad-scroll p { padding-block:1rem; }
.article-demo .ad-reset-frame { overflow:auto; padding:1rem; background:#e7ecdf; }
.article-demo .ad-reset-box h4 { margin-block:1.33em; }
.article-demo .ad-reset-box button { font:13px Arial,sans-serif; }
.article-demo .ad-grid-card { min-width:0; }
.article-demo .ad-swatches { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:1rem; margin-block:1rem; }
.article-demo .ad-notes { padding-inline:1.5rem; }
.article-demo .ad-notes li { margin-block:.75rem; }
.home-composition .article-demo :focus-visible { outline-color:#a3440c; }
@media(forced-colors:active) { .article-demo,.article-demo .ad-workbench,.article-demo .ad-workbench * { background:Canvas; color:CanvasText; border-color:CanvasText; } }
` + Object.values(articleDemos).map(demo => demo.css).join('\n\n');
