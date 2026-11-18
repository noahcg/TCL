# Match the four Cascade Lounge interior page designs

Implement the four supplied designs in the existing The Cascade Lounge site. Treat the attached contact sheet as the visual acceptance reference. Match the layout, artwork, typography, hierarchy, colors, and spacing as closely as possible. Use the labels and editorial copy specified here. Render the interfaces as semantic HTML and CSS with working routes and controls.

## Read the handoff and inspect the checkout

The handoff directory contains this prompt, `reference/tcl-modern-css-collection.png`, and six WebP files under `assets/`. Look beside the prompt first or in `handoff/tcl-interior-redesign/` in the checkout. The original reference on the owner's Mac is `/Users/noah/Documents/TheCascadeLounge/designs/The Cascade Lounge_ Modern CSS Collection.png`.

Read `lib/pages.mjs`, `src/assets/site.css`, `src/assets/site.js`, `scripts/build.mjs`, `lib/content.mjs`, and `test/browser/site.spec.mjs`. The redesigned homepage already has a live wordmark component in `homeMasthead()` and a separate full-bleed composition. Reuse its wordmark markup and design tokens where appropriate. Scope the new layout to the interior pages. Preserve the homepage composition and editorial content, search behavior, static builds, source snapshot, content import, permalink structure, and deployment settings. Use the bundled Newsreader and DM Sans faces, existing static generator, and small native interactions. Avoid new runtime dependencies.

| Reference panel | Crop in the contact sheet | Exact route | Affected rendering |
| --- | --- | --- | --- |
| Upper left | x=0, y=0, width=768, height=512 | `/articles/` | Articles archive with a new lead, feature, and list style |
| Upper right | x=768, y=0, width=768, height=512 | `/articles/container-query-units/` | Shared article detail template, using this article as the reference case |
| Lower left | x=0, y=512, width=768, height=512 | `/quick-wins/simplify-slideshows-with-scroll-snap/` | Shared Quick Win detail template, using scroll snap as the reference case |
| Lower right | x=768, y=512, width=768, height=512 | `/resources/` | Resources index with working category cards and existing collection below |

Also style the `/quick-wins/` index with the compact masthead, palette, and typography. Retain the index's existing title, list, shareable topic filters, and detail URLs. The lower-left panel depicts a single Quick Win in detail.

### Art files

Copy only the six WebP files from the handoff to `src/assets/`. The existing build copies that directory to `dist/assets/`. Keep the contact sheet in reference material outside the site's published output. Do not use a screenshot as a page background.

| File | Size | Usage |
| --- | --- | --- |
| `tcl-articles-hero.webp` | 765 × 213 | Archive stage behind the masthead and hero. Potted plant and abstract poster at the right. |
| `tcl-article-hero.webp` | 765 × 326 | Article detail stage. Clean, softly lit forest-green wall. |
| `tcl-quick-win-hero.webp` | 765 × 273 | Quick Win detail stage. Window light, mug, plant, and wood table at the right. |
| `tcl-resources-hero.webp` | 765 × 239 | Resources stage. Orange dome lamp and CSS book at the right. |
| `tcl-cq-feature.webp` | 252 × 142 | Archive feature thumbnail for the Container Query Units article. |
| `tcl-cq-cover.webp` | 262 × 214 | Article hero cover for the Container Query Units article. |

The four stage plates were reconstructed from the contact sheet with the interface removed and trimmed to omit the rounded panel borders. They begin about 12 reference pixels below the original panel top. Paint the very top using the matching dark fallback and align the bottom of each plate to its dark-to-cream transition. At the desktop reference size, retain the original aspect ratio and object placement. The two separate cover crops come directly from the supplied art. Clip their original corner pixels with the corresponding rounded display frame. Use empty alt text for this decorative art. Provide a solid fallback, reserve the artwork's aspect ratio, and load the main above-the-fold asset promptly. Apply slight local shading only where contrast needs it. Keep the plant, poster, mug, and lamp recognizable.

## Reference scale and common components

Use each 768 × 512 panel as a 50% view of a desktop composition. At a **1536 × 1024** browser viewport, downsample a capture to **768 × 512** for comparison. Positions and sizes below are in panel pixels, relative to the top-left of that panel. Multiply them by two for the full desktop starting values. Match the positions and wrap points using fluid widths, grid tracks, and typography. Exclude the thin outlines, rounded outer corners and seams of the contact sheet from the website. The archive's rounded cream overlap is part of the page design.

- Use a compact transparent masthead over each dark stage. The four colored bars, two-line cream italic wordmark, amber star, and small tracked **THE CSS LOUNGE** caption sit near x=49, y=14, around 186 × 40 in the panel. Reuse the homepage's live wordmark and scale it for this variant. Its link has one accessible name, **The Cascade Lounge**.
- The masthead's **Articles**, **Quick Wins**, and **Resources** run across the right half around y=33. Use DM Sans semibold, around 11 to 12 panel px. Place the current section link in a filled burnt-orange pill with cream text, roughly 29px tall in the panel. Keep the correct current state on the archive and its detail pages. Use `aria-current="page"` on the section index and an appropriate location state on subordinate routes. Keep hover and focus distinct.
- Place a slim warm-gold divider near x=668 and an outlined round magnifier near x=693, y=18. The magnifier is a real link to `/search/` with accessible name **Search**. On the homepage retain the existing search field.
- Sample palette starting points from the reference include forest `#152518`, dark edge `#101d13`, cream paper `#faecda`, cream card fill `#f7e9d7`, burnt-orange active fill `#b0480c`, and warm cream type. Use a stronger contrast-equivalent color where needed for controls or text. Keep the rich green shading, warm paper, quiet fine rules, orange accents, strong Newsreader display, and DM Sans supporting copy. Use semantically live inline icons or the project's existing icon idiom. Hide decorative icons from assistive technology.
- Keep the top band and cream content full bleed. Set inner margins per panel, typically 6–9% of the full width. Use a pale cream background with subtle tonal variation. The visible body sections are the first screen, so continue the existing article or resource content naturally below.

## Articles archive

Implement the upper-left panel in `articlesPage(entries)`. At the 768px panel scale the green-to-cream transition occurs around y=226. The cream sheet overlaps the dark header with about 40px top corner radii. Use a wrapper for the cream sheet so it has full width and wraps all the archive rows.

- Hero copy starts at x=70. Place **ARTICLES** at y=89 as a tracked kicker. Use the H1 **In-depth CSS for real-world builders.** at y=108, around 36px Newsreader at panel scale, wrapping after **for**. Set the deck **Guides, deep dives, and thoughtful explorations of modern CSS.** at about y=187.
- Feature the real published entry with slug `container-query-units`. Keep homepage feature selection as-is. In the archive only, choose this curated record and exclude it from the regular list. If it is unavailable, use the first published article without misapplying the curated thumbnail or copy.
- Place the thumbnail at x=65, y=252, about 252 × 142 with a 12px corner radius. At x=343, y=260 place **FEATURED**, then the real headline **Sizing Components with Container Query Units** around 25px Newsreader in two lines. Use the editorial deck **The missing half of component-responsive CSS.** The bottom row shows the source date and reading time. A small orange outlined circular arrow sits around x=669, y=309.
- Use a real link to `/articles/container-query-units/`, with the title as its accessible name. If the title and arrow share a single link, keep it one focus stop and avoid nested links. Date and reading time are readable text.
- Draw the first thin divider near y=412 from x=58 to x=710. The next row is the real `modern-resets` entry. At x=88, use **STYLING** as the curated display category, then the real title **Rethinking CSS Resets for Modern CSS** and the reference deck **A practical approach to cleaner, more predictable foundations.** Right-align the source date, reading time, and arrow. Link to `/articles/modern-resets/`. Continue with the remainder of the published collection in its existing order, showing legitimate metadata and omitting duplicate entries. Keep editorial deck and category overrides local to the view or a small presentation map keyed by verified slugs.

## Article detail

Implement the upper-right panel as the shared article detail design. The proof route is `/articles/container-query-units/`. Stop the green hero around y=337 in panel coordinates. Build the changes around `detail(entry)` and preserve the article body, IDs, code blocks, links, attribution, and interactive examples.

- Add breadcrumb **Articles › Layout › Sizing Components with Container Query Units** starting near x=48, y=87. **Articles** links to the archive. **Layout** is a curated display category for this article, shown as text unless backed by a real category route. Mark the last crumb as the current location. Other articles use their own title and omit categories that are unavailable.
- Position the left content at x=61. Use a small orange **LAYOUT** pill around y=119. The true title starts around y=151 in approximately 36px Newsreader, wrapping after **with**. Set **The missing half of component-responsive CSS.** near y=232. Place the right cover near x=473, y=95, about 264 × 216, with a fine cream stroke and 16px radius. Maintain enough width for real article titles and allow wrapping. Use the cover only for its assigned article. For other articles use the green stage and content-driven spacing, plus any verified cover that is already available.
- Place a compact date and reading-time row near y=276. Show a byline and portrait when the article has a verified author and approved portrait asset. The current source for this article is dated April 9, 2026 and has no author field. Use the source date and omit the portrait and byline until those values are independently established. The design's rendered date, byline, and avatar are layout references. Do not copy or recreate the portrait or overwrite migrated metadata to force a screenshot match. Use real supplied reading times when present. Otherwise derive a consistent estimate from the readable article text and keep it clearly an estimate.
- Put bookmark, share, and more actions at the right of the metadata row, around x=357–450. Match the cream bookmark outline and the slender circular share and ellipsis outlines. Make them useful with minimal client behavior. Use a local-only bookmark keyed by article URL with `aria-pressed`, native share where available with a copy-link fallback, and an accessible disclosure for Copy link and Print. Keep keyboard focus predictable, announce success or errors, and handle unsupported local APIs without breaking reading. An unavailable action can be omitted. Keep this behavior scoped to article detail.
- At the cream transition, use a spacious editorial lead-in x=62, y≈366. For the reference article, render the following visible design copy as a distinct introductory deck before the migrated article.

  > Container query units (CQ units) let components respond to the size of their container, not the viewport. They’re a powerful addition to modern CSS, and they open up new, more predictable layout patterns.

- Set the opening **C** as an oversized burnt-orange Newsreader drop cap, roughly 78px tall at panel scale. Keep the full word in normal DOM text using `::first-letter` or equivalent. Body text begins near x=133 in roughly 17.5px DM Sans with 26–27px lines. A fine pale-orange horizontal rule spans the content around y=468. Continue into the original article below with its accessible table of contents, tables, original headings, code controls, and attribution. A direct link such as `/articles/container-query-units/#why` must still resolve to the true section. For articles without a supplied separate lede, use their existing opening text without copying it twice.

## Quick Win detail

Implement the lower-left panel as the shared Quick Win detail view. The proof route is `/quick-wins/simplify-slideshows-with-scroll-snap/`. Keep the list at `/quick-wins/` working with the existing topic filter and URLs.

- Use the **Quick Wins** masthead pill. Set the dark-to-cream boundary around y=286 in panel coordinates. Position text at x=72. Set **QUICK WIN** around y=85 as a tracked cream kicker. The H1 **Simplify slideshows with scroll snap** starts around y=107, spans two lines after **slideshows**, and uses roughly 39–40px Newsreader. Use the real deck **Create smooth, user-friendly carousels with one property family.** Wrap it to two lines at reference scale.
- At y≈245 show compact metadata with a clock icon, a reading-time estimate or verified reading time, a thin divider, a difficulty bars icon, and **Beginner** from the source value. Keep the mug and window highlights on the right. The mockup's three-minute label is a size reference. Preserve the source date elsewhere if it is part of the current view.
- On cream, use two columns, with the left beginning around x=68 and the right around x=377. Put a short orange line near y=325, then **The idea** at y≈341 around 28px Newsreader. Use the supplied display copy for this Quick Win.

  > Use CSS scroll snap to create a clean, aligned slideshow — no JavaScript required.

- Put the code panel around x=377, y≈310, about 342 × 168 with rounded 14px corners. Use a near-black evergreen window, a thin warm rule below its approximately 36px header, orange/gold/green decorative dots at the left, and a small **CSS** language label at the right. Set text in the existing monospace stack. Use gold selectors, cyan properties, rose values and pale punctuation with accessible contrast. Keep copy text clean and preserve original whitespace. Use the following **expanded example supplied in the design** for this visible panel.

  ```css
  .container {
    scroll-snap-type: x mandatory;
    overflow-x: auto;
    display: flex;
    gap: 1rem;
  }
  ```

- Keep the migrated snippet, notes, and source attribution below this showcase. The expanded code is a presentation example from the supplied reference. Preserve the original short snippet as source and keep actual snippets for other Quick Wins. Supply an accessible copy action for the visible code. Reuse existing code-copy logic. Allow overflow inside the code frame only. Stack the idea and code in document order on narrower screens.

## Resources index

Implement the lower-right panel in `resourcesPage(entries)` and keep all current resource detail URLs.

- Activate **Resources** in the masthead. End the green stage around y=251. At x≈63, place **RESOURCES** around y=85 and the H1 **Trusted CSS resources in one place.** around y=108, wrapping after **resources**. Set the deck **Documentation, reference sites, tools, and more — handpicked for modern front-end work.** on two lines near y=188. Align the book and orange dome lamp to the lower right.
- At y≈280 use a four-card row spanning x≈42 to x≈737 with 14–15px gaps. Each card is about 162 to 166px wide and 187px tall. Use pale cream fill, a fine tan outline, a 19px radius, and about 19px padding. Icons are cream, on small 48–50px rounded tiles. Target a 19–20px Newsreader heading, 12px supporting copy, and a 28px circular orange arrow at the lower left. Keep each card a single link and associate its description.

| Card title | Description | Icon and tint | Real destination |
| --- | --- | --- | --- |
| Documentation | Authoritative references and specifications. | Open book on amber | `#documentation` |
| Tools | Useful utilities for CSS development. | Wrench on deep green | `#tools` |
| Patterns | Practical, real-world CSS pattern libraries. | Stacked layers on burnt orange | `#patterns` |
| Community | Places to learn, share, and stay current. | People on olive | `#community` |

- Render matching stable section IDs below the fold. Use existing entries by slug, such as MDN Web Docs for Documentation, CSS-Tricks for Patterns, and the people entries and State of CSS for Community. Continue to use their real detail URLs and source credits. For Tools, use a real existing tool when one is available or include a direct link to the official [Chrome DevTools CSS guide](https://developer.chrome.com/docs/devtools/css/). Keep this resource link view-level, with its source clear. Preserve the complete existing collection and avoid inventing a migrated record or an empty card destination.
- Reflow to a two-by-two grid at a suitable tablet width and one column at narrow phone widths. Keep headings and arrows aligned without fixed row heights.

## Responsive, accessibility, and content fidelity

- Use fluid measurements and appropriate breakpoints. At 1536 × 1024, match the reference composition and its typographic wraps. At 1440, tighten proportionally. At tablet widths let the masthead, art, feature grid, and article header adapt. On phones put key text ahead of art, move the cover when it would crowd a title, stack feature and idea/code content, and keep all actions reachable. Ensure normal scrolling and clean reflow at 320 CSS pixels and 200% text size.
- Keep the skip link, semantic landmarks, one H1 per route, original article heading IDs, and deep links. Preserve focus visibility, pointer targets, contrast on photo backgrounds, input labels, status announcements, reduced-motion preferences, and forced-colors usability. Test the screenshot's decorative strokes and the controls separately. Do not hide overflowing layout globally to disguise a broken grid.
- Presentation copy in this prompt is supplied by the target design. The imported corpus and search index should continue to represent real published content with verified fields. Keep slugs, dates, article bodies, source credit, and original code intact. Use optional author fields only when they are present and verified. Use scoped presentation data for reference-specific copy and artwork. Preserve the homepage's newest-article logic, unrelated pages, build pipeline, and content counts.
- Maintain native links, in-page navigation, and access to all published content without JavaScript. Limit enhancements such as clipboard, bookmark state, and filtering to the existing script and retain usable fallback behavior.

## Finish with comparison and working behavior

1. Run `npm run content:verify`, `npm test`, `npm run build`, and `npm run test:browser` on Node 22.12 or newer. Keep the existing direct-link, search, topic-filter, article demo, and accessibility checks. Update selectors and heading expectations that encode the old visual copy, including `.feature h2 a` queries or the homepage card test that expects the old destination H1 labels. Preserve what those tests verify.
2. Capture the four proof routes at **1536 × 1024** after the fonts and hero images finish loading. Downsample each capture to 768 × 512 and compare against its panel. Ignore the contact sheet's outer framing. Check masthead position, copy baselines and wrap points, image crops, stage boundaries, thumbnail geometry, cards, dividers, and controls. At the panel scale, aim for major stage edges within 3px and key boxes within 4px of the stated anchors. Iterate with actual captures or a translucent overlay and record any remaining differences from fonts, source metadata, or image reconstruction. Keep comparison captures outside deployed assets.
3. Perform the same layout checks at **1440 × 900**, and check behavior at **768px**, **390px**, and **320px** widths. Retain the existing Chromium and mobile WebKit checks. Add narrowly scoped checks for the archive feature and regular row destinations, Quick Win display/source snippets, Resource card section anchors, and any new article actions. Check keyboard operation, focus, and no horizontal overflow beyond local code/table scroll areas.
4. Open the real routes from the masthead and card links. Check the article's section link after reload, the Resources category anchors and detail links, Quick Wins topic filters, the magnifier's route, and home search. Review the redesigned homepage once for visual regressions. Report the changed files, proof routes, test results, and concrete deviations from the references. Leave publishing decisions to the owner.
