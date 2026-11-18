import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFragment } from 'parse5';
import { loadContent, nodeText, walk } from '../../src/build/content.mjs';
import { highlightCodeBlocks } from '../../src/build/highlight.mjs';
import { detail } from '../../src/build/pages.mjs';

const panels = html => walk(parseFragment(html)).filter(node => node.tagName === 'pre');

test('Highlighting preserves every published article snippet exactly', async () => {
  let count = 0;
  for (const entry of (await loadContent()).filter(entry => entry.type === 'article')) {
    const before = panels(entry.html);
    const after = panels(detail(entry));
    assert.deepEqual(after.map(nodeText), before.map(nodeText), entry.slug);
    assert.ok(after.every(pre => pre.childNodes.some(node => node.tagName === 'code')), entry.slug);
    count += after.length;
  }
  assert.ok(count > 0);
});

test('CSS, HTML and JavaScript use their own grammars without executing markup', () => {
  const css = highlightCodeBlocks('<pre>.card { color: red; margin: 1rem; /* example */ }</pre>');
  assert.match(css, /hljs-selector-class/);
  assert.match(css, /hljs-attribute/);
  assert.match(css, /hljs-number/);
  assert.match(css, /hljs-comment/);
  const html = highlightCodeBlocks('<pre>&lt;button type="button"&gt;Open&lt;/button&gt;</pre>');
  assert.match(html, /language-html/);
  assert.match(html, /hljs-name/);
  assert.equal(walk(parseFragment(html)).filter(node => node.tagName === 'button').length, 0);
  const js = highlightCodeBlocks('<pre>const button = document.querySelector("button");</pre>');
  assert.match(js, /language-javascript/);
  assert.match(js, /hljs-keyword/);
  assert.match(js, /hljs-string/);
});

test('Explicit languages, plain text, attributes and surrounding content are preserved', () => {
  const html = '<h2 id="example">Example</h2><pre id="sample"><code id="source" class="language-js">const count = 2;</code></pre><p>After</p>';
  const result = highlightCodeBlocks(html);
  assert.match(result, /^<h2 id="example">Example<\/h2><pre id="sample">/);
  assert.match(result, /id="source"/);
  assert.match(result, /hljs-keyword/);
  assert.match(result, /<p>After<\/p>$/);
  assert.equal(nodeText(panels(result)[0]), 'const count = 2;');
  for (const classes of ['language-unknown', 'no-highlight']) {
    const plain = highlightCodeBlocks(`<pre class="${classes}">&lt;tag&gt; &amp; value</pre>`);
    assert.doesNotMatch(plain, /<span/);
    assert.equal(nodeText(panels(plain)[0]), '<tag> & value');
  }
});
