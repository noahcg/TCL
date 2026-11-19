# Search visibility

The canonical production origin is `https://www.thecascadelounge.com`. Live checks on November 19, 2026 confirmed that the apex redirects to `www` and the Vercel alias identifies the same canonical origin. Keep `TCL_SITE_URL` set to this origin in production. Do not change published article slugs just to add keywords.

## Implemented

- Search-focused titles and unique descriptions for the homepage, three collection pages, all 16 articles, 10 Quick Wins and six resource profiles. Curated values live in `content/seo/metadata.json`; visible editorial titles remain intact.
- Five CSS reading paths with substantive introductions, technique selection advice, and crawlable links to existing tutorials. The `/topics/` index, homepage, archive, footer and related reading connect these paths. They cover responsive layout, selectors and the cascade, animation and scrolling, typography and color, and forms and accessible interfaces.
- Related articles and topic navigation on tutorial pages, rendered in HTML and usable without JavaScript. Internal search also includes the search-focused titles and descriptions.
- JSON-LD for the website, publisher, article/Quick Win, collection and breadcrumb hierarchy. Authors and modification dates are emitted only when known. Unknown legacy authors remain absent; publisher identity is not substituted for a human byline. No fabricated reviews, ratings or FAQ markup.
- Production-only, absolute self-canonicals, matching Open Graph URLs, large-image preview permission and representative share images. Previews, search results and the real 404 page remain noindex. Those utility pages are excluded from the sitemap and structured data.
- Sitemap image entries and real article publication/update dates. Builds do not invent modification times for unchanged pages. The production Atom feed at `/feed.xml` enables subscriptions and content discovery.
- A visible terminology correction on the legacy text-spacing article links to the current `text-box-trim` example and MDN. The imported source snapshot, original code, dates and URL remain preserved.

Existing strengths retained: static article HTML, semantic headings, stable fragment links, unique article artwork with dimensions and alt text, compressed WebP scenes, local WOFF2 fonts with swap, HTTPS, responsive layouts and keyboard-accessible controls.

## Checks and future publishing

Run `npm run verify:all` before release. `npm run verify` now includes `npm run seo:check`. The SEO command builds production output in a temporary directory; it does not turn the local preview into an indexable site. It checks unique titles/descriptions, one H1, absolute canonicals and social images, parseable page schema, crawlable internal links, reachability from the homepage, sitemap membership, robots discovery and feed generation.

The current production build has **42 indexable HTML pages**, two noindex HTML pages, and no orphaned pages or broken internal links. This measures eligibility and crawl paths, not actual Google indexing or rankings.

For each new tutorial:

1. Write a useful original answer to a specific problem, with tested examples, support/fallback notes and authoritative sources. Do not create a second article that answers the same intent without adding value.
2. Use the actual CSS feature name in the search title and a distinct description that accurately summarizes the page. Put reviewed overrides in `content/seo/metadata.json` under the stable URL. Plain-text summary fallbacks exist for new entries.
3. Add the published slug to an appropriate path in `content/seo/topics.json`. Related reading and collection schema update from this membership. The checks validate curated topic references; add new Studio publications to a reading path during editorial review. New entries retain metadata fallbacks and archive links until curated.
4. Add a real author name and a useful author profile when verified. Never fill unknown legacy bylines with a guess. Record a genuine update time when changing the article substantially.
5. Check the page at narrow widths, enlarged text and reduced motion. Copy and run the snippets; confirm links to browser compatibility and original documentation.

## Search Console and measurement

Account access is required for these steps; no Search Console or Bing Webmaster account was connected for this work. No search-performance data or indexing submissions were fabricated.

- Verify the `thecascadelounge.com` Domain property in Google Search Console with the provided DNS record. This includes `www`, apex and HTTPS variants. Use the existing property if it is already verified.
- Submit `https://www.thecascadelounge.com/sitemap.xml` in Search Console and Bing Webmaster Tools. Inspect the homepage, a representative article and a new topic path. Request indexing after publishing significant changes, not repeatedly for every build.
- Use Google's Rich Results Test on an article and a topic page. The local audit checks syntax and known facts; it does not certify eligibility in Google's live validator.
- Review Page Indexing, Crawl Stats, HTTPS and Core Web Vitals. Use field data for LCP, INP and CLS; passing automated accessibility checks is not a substitute for field performance measurements.
- Establish a baseline for non-branded clicks, impressions, queries, pages, CTR and average position. Compare equivalent 28-day periods and review at least monthly. Segment by the five topic paths and their linked tutorials.
- Prioritize pages with relevant impressions but weak CTR for clearer titles. Improve pages that answer an intent incompletely before publishing overlapping content. Rankings, rich results and indexing are not guaranteed by metadata or sitemap submission.

## Editorial opportunities

The collection currently specializes in modern CSS. It does not yet substantively answer every broad CSS or front-end query. Build coverage deliberately, informed by Search Console queries and reader needs:

| Next guide | Useful scope | Links into the existing collection |
| --- | --- | --- |
| CSS Grid fundamentals | Tracks, placement, gaps, auto-fit versus auto-fill, responsive cards | Subgrid, container query units |
| Flexbox layout and debugging | Basis, shrinking, wrapping, min-width and overflow | Safe alignment, dynamic viewport units |
| Container queries versus media queries | Viewport versus component decisions, containment and fallbacks | Style queries, container query units |
| The CSS cascade from start to finish | Origins, importance, layers, specificity, inheritance and source order | Specificity, @layer, modern selectors |
| Accessible CSS forms | Labels, focus, validation, error visibility, textarea behavior | :focus-visible, field-sizing |
| CSS animation accessibility | Reduced motion, readable state changes, keyboard scrolling | sibling-index(), scroll snap, transitions |
| HTML and JavaScript for interface behavior | Native semantics and when CSS needs actual state/event handling | Popover and anchor-positioning guide |

These are an editorial roadmap, not published claims of coverage or keyword-volume estimates. Build genuinely useful examples and earn relevant links through sharing original work. Avoid mass-produced keyword pages, copied documentation, misleading freshness dates and keyword stuffing.

## Primary guidance

- [Google SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
- [Helpful, reliable, people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
- [Article structured data](https://developers.google.com/search/docs/appearance/structured-data/article)
- [Breadcrumb structured data](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb)
- [Sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [MDN text-box-trim reference](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/text-box-trim)
