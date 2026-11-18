# Architecture

The Cascade Lounge is a static publication. Build-time JavaScript creates HTML, a JSON search index, and local assets. Vercel, Netlify, or another static host serves `dist/`. The browser receives complete editorial pages and a small enhancement script.

## Source boundaries

| Path | Responsibility |
| --- | --- |
| `content/authored/` | New editorial JSON records |
| `content/imported/watercooler/published.json` | Reviewed source snapshot and integrity seal |
| `src/build/content.mjs` | Record validation, publication filtering, sanitization, source/code/anchor fidelity |
| `src/build/pages.mjs` | Shared page shell, route templates, article presentation, reading guide |
| `src/build/highlight.mjs` | Build-time CSS, HTML, and JavaScript highlighting |
| `src/build/environment.mjs` | Production/preview detection and canonical origins for Vercel and Netlify |
| `src/assets/site.css` | Typography, layout, component styles, responsive/print/forced-color rules |
| `src/assets/site.js` | Search, copy actions, topic filters, local bookmarks, sharing, reading progress, demo |
| `src/assets/` | Images and icons copied to `/assets/` |
| `scripts/build.mjs` | Build orchestration, routes, MDN index, fonts/licenses, production metadata |
| `scripts/serve.mjs` | Local server with nested routes, redirects, response headers, and HTTP 404s |
| `scripts/migration/` | Optional legacy source capture/export and guarded snapshot import |
| `tests/unit/`, `tests/browser/` | Content/rendering checks and browser acceptance checks |

Assets deliberately retain a flat published `/assets/` namespace. Their source names and public URLs match; fonts and license notices come from pinned dependencies at build time. Preserve published paths when reorganizing their inputs.

## Build flow

1. Load the sealed legacy snapshot and authored JSON files.
2. Validate records, slugs, metadata, duplicate routes, source fidelity, snippets, and section IDs. Select published records.
3. Render the homepage, collection pages, detail pages, search, and 404 using the shared templates. Highlight code during rendering.
4. Generate the content and MDN CSS search index using the installed `mdn-data` package.
5. Replace `dist/`, write HTML and search data, and copy browser assets, fonts, and license notices.
6. For production builds, write canonicals and a sitemap using the configured HTTPS origin.

Draft and archived records are excluded from published pages and search. Raw imported bodies remain in the snapshot; sanitization creates a separate renderable projection. Imports use a write lock and atomic replacement and reject unreviewed route removals.

## Public routes

- `/`
- `/articles/` and `/articles/<slug>/`
- `/quick-wins/` and `/quick-wins/<slug>/`
- `/resources/` and `/resources/<slug>/`
- `/search/?q=…`
- `/404.html`, served with HTTP 404 for unknown paths

Published slugs and article fragment IDs are stable interfaces. Renames require explicit redirects and review. Search and topic state use query parameters. Bookmarks use browser local storage. Content browsing and native fragment links remain available with JavaScript disabled.

## Operational boundaries

The normal build reads local files and installed packages. Network access is needed for dependency/browser installation and optional legacy capture. The Python Oracle exporter is an optional owner-operated tool; its driver belongs in a local virtual environment rather than the site’s Node dependencies. Private migration exports and historical handoffs live in ignored `artifacts/` and are never copied to `dist/`.

See [deployment](deployment.md) for configuration and [repository organization](repository.md) for file retention rules.
