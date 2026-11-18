# The Cascade Lounge implementation plan

## Evidence and product decisions

- The starting workspace was empty and had no Git history. The nearby TCL package contained the v2.15 specification, historical README, brand guide, docs starter, wallpapers, and five screenshots of the legacy APEX app. Those screenshots supplied content and page references. The source package contained no runnable TCL application.
- The referenced design discussion established the preferred Option 4 palette and reading experience. Its text described dark forest-green headers, warm cream surfaces, burnt orange accents, editorial type, and a spacious article reading view. The Option 4 mockup itself was unavailable. The implementation interprets this written brief with Newsreader and DM Sans, an architectural photo on the homepage, a single featured item, and a chronological editorial archive. The homepage uses an original generated image of a modernist reading room with an amber globe lamp and an olive chair. The optimized asset is at `src/assets/lounge.webp`.
- The live .waterCooler archive has 15 entries addressed by `p2_slug` in links signed for the current APEX session. The public page provides titles, subtitles, archive dates, complete rendered article bodies, and section IDs. Public article detail exposed no author or update timestamp. The snapshot credits .waterCooler as the source. The database must establish any missing bylines, catalog status, date semantics, and other metadata. [Legacy .waterCooler home](https://oracleapex.com/ords/r/nglushien/watercooler/home)
- The article-first request supersedes the historical checker-first homepage. The v2.15 POC deferred account storage, user saves, document downloads, and AI. Keep those options on the roadmap. The search route uses a pinned MDN-backed term index to retrieve syntax and authoritative links without a live third-party dependency on every query. Explanatory prose comes from published TCL articles and the linked documentation. [MDN Data schema](https://github.com/mdn/data/blob/main/css/properties.md)

## Architecture and experience

| Area | Implementation |
| --- | --- |
| Delivery | Prebuilt HTML and CSS on Netlify. Small enhancements for search, copying snippets, filtering, and the original transition demo. No browser hydration required for editorial pages. |
| URLs | `/`, `/articles/`, `/articles/<slug>/`, `/quick-wins/`, `/quick-wins/<slug>/`, `/resources/`, `/resources/<slug>/`, `/search/?q=…`, and an HTTP 404 page. Existing article IDs remain valid fragments. |
| Home and archive | One hero action and featured article. The archive uses roomy headline, summary, and date rows. Article bodies use a narrow reading column and an in-page table of contents. |
| Quick Wins and resources | Real source snippets, copy actions and a shareable topic filter. Resource credits and links lead both to the TCL entry and the source site. |
| Authoring | Versioned records in Git. Draft and archived records stay out of all public output. Pull-request previews and validation allow editorial review before release. |
| Migration | Owner-operated read-only Oracle export for the authoritative copy. The browser baseline provides published content and stable URLs. Import verification checks route identity, raw bodies, code parity, checksums and unexpected removals. |
| Search | Query in the URL. Matches article full text, titles, summaries, tags, snippets and resources. CSS syntax and source links are labeled as MDN reference results. Empty, loading, failure and no-JS states provide usable alternatives. |
| Operations | A reproducible build, pinned dependencies, Playwright and axe checks, deploy previews, deploy logs, rollback to the prior accepted build, and a public availability check after launch. |

## Staged acceptance criteria

### 1. Source inventory and design baseline

- Inventory source paths and distinguish the app-definition export from data storage. Record APEX app ID and parsing schema only when an authorized owner view supplies them.
- Reconcile all visible archive entries with opened bodies and record the gaps. Current browser snapshot contains 15 articles and 95 article code blocks, plus 9 Quick Wins and 6 resources.
- Confirm the homepage, archive, article, Quick Wins and Resources use the agreed hierarchy, legible type and generous spacing at 320, 768 and 1440 CSS px.

### 2. Source extraction and editorial parity

- The owner runs the read-only database export or delivers a compatible bundle with an independent ID/status inventory. Reconcile every source row by ID and every public record by slug. Missing records, collisions, incomplete CLOBs, changed code, unresolved assets and unexpected status changes block promotion.
- Review the browser/Oracle delta, especially author and attribution, date format/time zone, and any body represented as plain text or Markdown. Compare longest articles, sections with inline markup, code indentation, escaping and Unicode, and all resources and Quick Wins. Retain source text and attribution verbatim and isolate active examples for separate review.
- Keep a private copy of the full source export and hashes. Commit the reviewed published subset. Never generate content to fill a missing source record or infer a contributor from the workspace owner.

### 3. Site and accessibility

- Direct navigation and refresh work for every route and section ID. Expected unknown routes return 404. Search, no results, lookup fallback, Quick Wins filters, resource URLs, and code copy work. Verify search indexes published content only.
- Run automated accessibility tests across representative states. Manually verify focus visibility and order, skip link, focus at fragment destinations, link context, keyboard copy with feedback, 200% text zoom, 320px reflow, text-spacing overrides, reduced motion, forced colors, VoiceOver/Safari and NVDA/Firefox desktop where available. Inspect the long article tables and interactive demo.
- Compare design at desktop and phone width. Review color contrast, semantic structure and accessible names. Automated results are partial evidence for conformance. [WCAG 2.2](https://www.w3.org/TR/WCAG22/)

### 4. Preview and release

- Run `npm ci`, `npm run content:verify`, `npm test`, `npm run build`, and `npm run test:browser` on the candidate commit. Confirm the artifact contains no drafts, private archive, APEX session links, or credentials.
- Deploy a pull-request preview and repeat direct URL, 404, search, and keyboard smoke tests at the actual hosting origin. Test response headers, HTTPS, preview noindex, and the production sitemap and canonicals on the intended URL.
- Review source parity and accessible page evidence with the owner, promote the accepted revision, set uptime monitoring, and retain the prior deploy. If a regression surfaces, restore the prior deploy, check representative routes and document the rollback.

## Remaining source decisions

The public pages are migrated. Full database parity requires either an owner-produced article export including stable IDs, publication status, full body, metadata and an inventory, or the relevant App Builder definition and owner-run read-only query access. Oracle release, parsing schema and source table names remain unverified. An exact visual comparison requires the Option 4 mockup. Hosting setup needs the intended Netlify project or domain.
