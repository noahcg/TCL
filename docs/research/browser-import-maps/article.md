# Browser Import Maps for a Small CSS Demo

*Unpublished draft · November 20, 2026*

Give a local JavaScript module a readable import name while keeping a small palette interface in ordinary HTML and CSS.

## Start with a page that still works at rest

A palette interface can be useful before its JavaScript runs. Three static swatches show the initial colors. Each swatch has a text label and a printed CSS value. A hue slider starts disabled, then becomes available when the interactive module has loaded successfully.

This tutorial connects that interface to a small local module through a browser import map. The module and application code are written for this example. There are no third-party packages to install; the browser loads the local files directly.

The file structure is small enough to inspect:

```text
index.html
styles.css
main.js
lib/
  palette.js
```

The CSS controls layout and appearance. `palette.js` returns color strings. `main.js` connects those strings to the page. The import map gives that local module a name the application can use.

## Give the local module one clear job

Create `lib/palette.js`:

```js
export function makePalette(hue) {
  if (!Number.isFinite(hue)) {
    throw new TypeError("Hue must be a finite number.");
  }

  const angle = ((hue % 360) + 360) % 360;
  return [86, 64, 38].map(lightness =>
    `hsl(${angle} 40% ${lightness}%)`
  );
}
```

The function accepts a numeric hue and returns three CSS color values. The modulo expression wraps values around the hue circle: `360` produces the same result as `0`, and `-1` produces the same result as `359`.

The chosen lightness values are simply three stops for the demonstration. HSL lightness does not guarantee equal perceived brightness or accessible contrast. A real palette needs evaluation against its intended foregrounds and backgrounds.

Keeping the calculation separate makes its behavior easy to check without opening a page. For an input of `35`, the expected output is:

```js
[
  "hsl(35 40% 86%)",
  "hsl(35 40% 64%)",
  "hsl(35 40% 38%)"
]
```

There is no DOM access in this module. Reusing it elsewhere does not bring the slider or card layout along with it.

## Map a readable name to the file

Add this map to the document head, before the application module:

```html
<script type="importmap">
{
  "imports": {
    "@lounge/palette": "/lib/palette.js"
  }
}
</script>
<script type="module" src="/main.js"></script>
```

Now `main.js` can request the module by that name:

```js
import { makePalette } from "@lounge/palette";
```

`@lounge/palette` is an alias defined by this page. It does not refer to a published npm package. The map associates it with a URL that the server must actually provide.

The leading slash in `/lib/palette.js` is deliberate. It points to the same location when the document is served at `/` or at `/nested/page/`. A document-relative path such as `./lib/palette.js` would describe a different URL at those two locations.

That choice also defines a deployment assumption: this example is served from the origin root. If the application lives under a subdirectory such as `/demo/`, adjust the mapped address and other root-relative asset URLs to match. A readable alias cannot repair an incorrect deployment path.

## Connect the module to the interface

The page needs a labeled slider and three cards. The companion example includes the complete HTML; this is the relevant shape:

```html
<label for="hue">Palette hue</label>
<input id="hue" type="range" min="0" max="360" value="35" disabled>

<div class="palette">
  <article class="swatch-card">
    <div class="swatch swatch-light" aria-hidden="true"></div>
    <h2>Light</h2>
    <code>hsl(35 40% 86%)</code>
  </article>
  <!-- Add the Middle and Deep cards in the same order. -->
</div>

<p id="palette-status" role="status">Static palette.</p>
```

The card order matches the three values returned by `makePalette()`. Use the complete three-card markup from the example when running the code below.

In `main.js`, connect the module to those elements:

```js
import { makePalette } from "@lounge/palette";

const hue = document.querySelector("#hue");
const cards = document.querySelectorAll(".swatch-card");
const status = document.querySelector("#palette-status");

function updatePalette() {
  const colors = makePalette(Number(hue.value));

  cards.forEach((card, index) => {
    card.querySelector(".swatch").style.setProperty("--swatch-color", colors[index]);
    card.querySelector("code").textContent = colors[index];
  });

  status.textContent = `Palette ready at hue ${hue.value} degrees.`;
}

updatePalette();
hue.disabled = false;
hue.addEventListener("input", updatePalette);
```

The initial call happens before the slider is enabled. Successful setup produces visible colors and printed values before inviting interaction. If module loading fails, that enablement step never runs; the static palette remains understandable.

A native range input already supports arrow-key interaction. The status text reports the selected hue, while the printed values keep the result available as text instead of communicating it through color alone.

## Keep the layout in CSS

Each swatch reads a custom property. Its initial value belongs in the stylesheet, so the fallback does not depend on a script:

```css
.palette {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
  gap: 1.25rem;
}

.swatch {
  min-height: 10rem;
  border-radius: 0.5rem;
  background: var(--swatch-color);
}

.swatch-light {
  --swatch-color: hsl(35 40% 86%);
}

.swatch-middle {
  --swatch-color: hsl(35 40% 64%);
}

.swatch-deep {
  --swatch-color: hsl(35 40% 38%);
}
```

At wider sizes the cards can share a row. At narrow sizes the grid makes room for fewer columns. Changing the hue updates values; it does not rebuild the layout or animate the cards. There is no nonessential movement to disable for reduced motion in this example.

The complete stylesheet also supplies visible keyboard focus, readable text, and a forced-colors treatment. Those details are part of the interface, even though the import map is the feature being demonstrated.

## Include the map in your security policy

The map above is inline. A site using a policy that permits only same-origin script files needs to account for it explicitly.

The companion server calculates a SHA-256 hash of the exact text inside the import-map element and adds that hash to `script-src`. It keeps the external module files restricted to the same origin. The relevant calculation is:

```js
const hash = createHash("sha256")
  .update(mapText)
  .digest("base64");
```

`mapText` includes the whitespace inside the element. Hashing only the parsed JSON, or changing indentation after computing the hash, would authorize different text.

This implementation is specific to the included local server. A static host needs the matching header configured in its deployment system. Recalculate the hash whenever the map text changes. The tutorial does not require adding a blanket inline-script allowance.

This is another reason to inspect the files that will actually be served: the HTML, its mapped URLs, and the response headers need to agree.

## Verification and limits

The example and verification script were prepared and executed by an AI coding assistant in the development workspace. The results below describe those automated checks. They do not document the site owner’s personal production experience.

The recorded checks cover:

- Exact palette output, hue wrapping and rejection of a non-finite input.
- Module loading at root and nested document URLs in Playwright Chromium and WebKit.
- Keyboard changes to the slider and matching updates to the printed CSS values.
- The exact-map CSP hash used by the included server.
- Layout at 320, 768 and 1280 pixels, and automated accessibility checks.
- Static content with JavaScript disabled or a deliberately broken mapped module URL.

These checks are narrow and reproducible. They do not establish every browser version’s support, real-device performance, or the accessibility of colors used in another design.

The example uses a local module so the resolution step is visible. Introducing third-party packages would add separate decisions about installation, versions, transitive dependencies and permitted use. This tutorial tests only the included files.

For a small interface, that separation is useful: HTML supplies a readable starting state, CSS handles presentation, a local module performs one calculation, and an explicit map connects its name to its URL.
