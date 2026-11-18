# Implement the supplied Cascade Lounge homepage design

Update the existing The Cascade Lounge homepage at `/` to match `tcl-homepage-target.png`. Implement and verify the redesign in this checkout. The current homepage has a flat forest-green header, a framed photo beside a split headline, and a cream editorial section below. Replace the top composition with the full-bleed design in the target. Use the reference image as visual evidence. All website text and controls must be live HTML.

## Find the three handoff files

Keep this Markdown file, `tcl-homepage-target.png`, and `tcl-homepage-background.webp` together. Look beside this prompt or under `handoff/tcl-homepage-redesign/` in the checkout. On the original Mac, the target image is also at `/Users/noah/Documents/TheCascadeLounge/designs/The Cascade Lounge Homepage.png`.

- **tcl-homepage-target.png** is the 1672 × 941 design reference for the complete first screen. Keep it outside the site's published assets.
- **tcl-homepage-background.webp** is the 1672 × 941 scene reconstructed from the target with its interface removed. Copy it to `src/assets/tcl-homepage-background.webp`. The static build copies files from `src/assets/` to `dist/assets/`. Use this exact image. Its original crop aligns the window light, mug, amber lamp, book, plant, framed art, and chair with the reference. The visible `CSS` lettering belongs to the book in the scene.

## Work in the existing templates

Read `README.md`, `lib/pages.mjs`, `src/assets/site.css`, `src/assets/site.js`, `scripts/build.mjs`, and `test/browser/site.spec.mjs`. Preserve existing work. The static builder uses `page({ homepage: true, … })` and `home(entries, quick)` for `/`. Scope the masthead variant to the existing `.home-page` hook and the hero/card styles to the new home composition. Keep the reading pages, internal navigation and header on other routes, search engine, sitemap, article data, import pipeline, and hosting setup intact. Use the existing Newsreader roman and italic faces and DM Sans. Keep dependencies and client-side JavaScript to the existing set.

Preserve the current Featured Article, Recent articles, Quick Wins, and footer below the new above-the-fold composition. The screenshot ends at the bottom of the dark composition and gives no direction for the cream editorial sections. Wrap or space those sections as needed to transition cleanly after the dark stage. Use the existing data-driven article and Quick Win lists.

## Match the desktop composition

Use the 1672 × 941 reference as the comparison canvas. The coordinates below are visual anchors at that viewport. Use fluid containers, grid/flex layouts, and responsive typography. Keep the page in document flow so text enlargement and smaller windows can expand it.

| Element | Reference alignment at 1672 × 941 |
| --- | --- |
| Background stage | Starts at the top edge behind the masthead and ends around y=941. Full viewport width. Match the supplied image at its native aspect ratio at the reference size. |
| Home masthead | Brand starts near x=80 and y=26. Navigation and search center vertically near y=67. Search ends around x=1584. The masthead is transparent over the scene, with a thin gold divider immediately before search. |
| Hero intro | Kicker and title start near x=125. Kicker appears near y=227 and headline top near y=258. Tagline and calls to action inset slightly from the headline, starting near x=144. |
| Hero actions | Sit side by side near y=471 with roughly 40px between them. Primary is about 281 × 64px. Secondary is about 266 × 64px. |
| Destination cards | One row spanning about x=104–1576. Top edge near y=676, height around 151px, gaps around 34px, 20px corner radius. Leave about 110px of atmospheric space below the row before the editorial content. |

Make the image one continuous background shared by the header, intro, and cards. Remove the old framed photo, its border, and the flat green band from the homepage. A single decorative image positioned behind the homepage header and hero, with `alt=""` and a dark fallback, is suitable. Use an eager image with high fetch priority, or preload the local image if using CSS. Keep the original scene clearly visible on the right. Use restrained local shading behind text and controls only where legibility needs it. The table begins around the midpoint, with the mug and lamp to the right of the headline. The orange chair fills the lower right edge and the framed art crops off the top right. Avoid a global dark wash that obscures those objects.

### Home masthead

- Rebuild the brand as a real home link. At the left, four rounded vertical bars rise and fall in olive, burnt orange, amber cream, and orange. Use approximate reference heights of 29, 53, 81, and 48px and 13px widths at the reference viewport. To their right, set small italic **The** over the large italic **Cascade Lounge** in warm cream. An eight-point amber star sits at the upper right of the wordmark. Under the lettering, place **THE CSS LOUNGE** in small, widely tracked cream capitals between two short gold rules. Render the bars, star, and rules as decorative shapes and give the home link one accessible name, **The Cascade Lounge**.
- Render **Articles**, **Quick Wins**, and **Resources** as the three masthead navigation links, spaced across the upper right at about 21px in DM Sans semibold. Use `/articles/`, `/quick-wins/`, and `/resources/`. The search pill replaces the standalone Search link on this homepage masthead.
- Render the pill about 307 × 48px at the reference viewport with a thin cream border, warm translucent dark fill, and a cream magnifier on the left. Use visible placeholder text **Search the Lounge...**. Use a labeled `input type="search"` with `name="q"`, `required`, and `maxlength="100"`, and a real magnifier submit button with accessible name **Search**. Use a native GET form with `action="/search/"`, so both Enter and the submit button work. Give the homepage form a distinct class from `.search-form`, which currently activates results-page logic in `site.js`. Continue using the existing results route and query parameter.

### Hero

Use this wording and visual hierarchy.

- **WELCOME TO** in cream, around 18px DM Sans, with wide tracking and a compact gap to the headline.
- **The Cascade Lounge** as the only H1. Use roughly 92px Newsreader at the reference size, with a tight line-height and tracking. Set **The Cascade** upright in warm cream and **Lounge** in vivid amber-orange italic. Keep all three words on one line at 1672px and allow natural wrapping at smaller widths. Remove the existing forced line break.
- **The place to gather for the latest in CSS — where styles flow and ideas spill.** Set in cream DM Sans around 27px with a comfortable line-height. Match the reference's two lines at desktop, with the first ending after the em dash. Let the text reflow naturally on narrower screens.
- **Read the latest** is a filled burnt-orange pill with a cream arrow. Link to the first real published article in `entries`, using `entries[0].path`. Currently that is `/articles/scroll-state/`. If the collection becomes empty, omit this action and retain **Browse articles**.
- **Browse articles** is a cream-outlined transparent pill with no arrow. Link to `/articles/`. Align the pill heights and typography.

Use a cream such as `#f5e5c7` and an amber-orange such as `#ef8f1d` as starting points. Tune foreground and control fills against the real image. Keep a burnt-orange primary fill dark enough for the cream label to pass contrast at its rendered size.

### Destination cards

Render three whole-card links. Each has a colored rounded icon tile at the left, a Newsreader title around 34px, a cream DM Sans description around 18px, and a slim cream right arrow aligned near the title at the right. At desktop, use roughly 29–30px card padding and a 75px square icon tile with a 15px radius. Use dark translucent tinted surfaces with a delicate amber/olive edge and rounded corners. Keep the scene legible behind the row and use enough fill opacity to support the copy.

| Title | Exact description | Route | Icon tile |
| --- | --- | --- | --- |
| Articles | In-depth guides on modern CSS techniques, patterns, and workflows. | `/articles/` | Cream outline of three stacked diamond layers over burnt orange |
| Quick Wins | Practical, bite-sized CSS tips you can use right away. | `/quick-wins/` | Cream filled lightning bolt over deep teal green |
| Resources | Trusted references, tools, and links worth keeping close. | `/resources/` | Cream outline of an open book over amber gold |

Give each card one keyboard focus stop. Hide its decorative icon and arrow from assistive technology. Keep the visible title as the link's accessible name and associate its description as supporting text. Avoid a nested link or button.

## Responsive and accessible behavior

- At desktop widths, keep the art at the right, the masthead on one row, both hero actions side by side, and the three cards aligned in a row. Use fluid margins and spacing so the composition stays balanced at 1440 × 900 as well as 1672 × 941.
- At tablet widths, let navigation and search reflow before they collide with the wordmark. Let the headline and actions wrap naturally. Adjust the image position and scale to retain the mug and lamp in view without crowding the text. Let cards move to fewer columns when they can no longer hold their content comfortably.
- At phone widths, use a smaller wordmark and an orderly stacked masthead with all three links and functional search visible. Use a full-width intro, a repositioned right-hand art crop, and three single-column cards. Stack the two actions when necessary. Keep the art quiet behind copy and use a dark fallback down to the cream section. At 320px there should be no clipping, collision, fixed-height text traps, or horizontal scroll.
- Preserve the skip link, one main landmark, heading hierarchy, findable labels, visible focus styles on every dark surface, and reduced-motion/forced-colors support. Use generous hit areas. Check WCAG 2.2 AA contrast for text, icons, control outlines, and focus indicators at their actual image-backed positions. Use stronger local shading or more solid surfaces where required.

## Verify the actual build before finishing

1. Run `npm run content:verify`, `npm test`, and `npm run build` with Node 22.12 or newer. Run `npm run test:browser` after building. In the existing browser suite, replace the obsolete **Explore articles** expectation with the **Browse articles** link. Preserve the article and section deep-link assertions. Add focused coverage for home search and the two CTA destinations if those paths are otherwise untested. Use exact accessible names or scope selectors to the home nav and card region where names repeat.
2. Open the local site and compare a browser-content capture at **1672 × 941** with `tcl-homepage-target.png`. Check the continuous scene, wordmark, intro baseline and width, both pills, card alignment, and desktop fold. Check **1440 × 900**, **768px**, **390px**, and **320px** widths for the responsive transitions. Adjust the implementation until the desktop screenshot and mobile checks hold.
3. Verify links and search with both keyboard and pointer. Confirm the latest CTA opens the actual article, Browse articles opens the archive, the three cards open their proper routes, and entering `subgrid` in the home search lands at `/search/?q=subgrid` and displays results. Sanity-check one inner page to catch shared header or style regressions.
4. Report what changed, the local preview URL if running, and the checks you actually performed. Leave publishing decisions to the owner.
