import hljs from 'highlight.js/lib/core';
import css from 'highlight.js/lib/languages/css';
import javascript from 'highlight.js/lib/languages/javascript';
import xml from 'highlight.js/lib/languages/xml';
import { parseFragment, serializeOuter } from 'parse5';
import { escapeHtml, nodeText, walk } from './content.mjs';

hljs.registerLanguage('css', css);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('xml', xml);

function languageFor(text, classes = '') {
  if (/\b(?:no-highlight|nohighlight)\b/i.test(classes)) return 'plaintext';
  const specified = /\b(?:language|lang)-([\w-]+)/i.exec(classes)?.[1].toLowerCase();
  if (specified) return hljs.getLanguage(specified) ? specified : 'plaintext';
  if (/^\s*<\/?[a-z][\w:-]*(?:\s|>)/i.test(text)) return 'html';
  if (/^\s*(?:const|let|var|import|export|function)\b/.test(text)) return 'javascript';
  return 'css';
}

export function highlightCode(text, language = 'css') {
  const value = hljs.getLanguage(language)
    ? hljs.highlight(text, { language, ignoreIllegals: true }).value
    : escapeHtml(text);
  return `<code class="hljs language-${language}">${value}</code>`;
}

// Work only inside each existing panel; source bodies and copyable text stay intact.
export function highlightCodeBlocks(html) {
  const fragment = parseFragment(html, { sourceCodeLocationInfo: true });
  const panels = walk(fragment).filter(node => node.tagName === 'pre');
  for (const pre of panels.reverse()) {
    const { startTag, endTag } = pre.sourceCodeLocation;
    if (!endTag) continue;
    const code = pre.childNodes.find(node => node.tagName === 'code');
    const classes = [...pre.attrs, ...(code?.attrs || [])]
      .filter(attr => attr.name === 'class').map(attr => attr.value).join(' ');
    const highlighted = parseFragment(highlightCode(nodeText(pre), languageFor(nodeText(pre), classes))).childNodes[0];
    if (code) {
      // Retain authored IDs and other attributes on the code element.
      highlighted.attrs = code.attrs.filter(attr => attr.name !== 'class').concat({
        name: 'class', value: [code.attrs.find(attr => attr.name === 'class')?.value, highlighted.attrs[0].value].filter(Boolean).join(' '),
      });
    }
    html = html.slice(0, startTag.endOffset) + serializeOuter(highlighted) + html.slice(endTag.startOffset);
  }
  return html;
}
