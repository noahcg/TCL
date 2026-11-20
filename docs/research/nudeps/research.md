# Historical research — superseded article

The product-focused draft described below has been withdrawn and replaced by an [original browser import-map tutorial](../browser-import-maps/article.md). This file records the earlier research only. Its launch narrative, source list and product-test framing are not part of the active article.

# Nudeps research file

Research date: November 19, 2026. Prepared for The Cascade Lounge in response to Lea Verou’s [launch article](https://lea.verou.me/blog/2026/nudeps/).

## Deliverables and editorial position

- `article.md`: approximately 1,600 words including code and references; original practical reporting rather than a condensed rewrite of the announcement.
- `content/authored/article-nudeps-browser-imports.json`: the matching native content record, saved as **draft**, with no publication date or invented byline.
- `example/`: original color-tool source, exact dependency versions, lockfile and local server. Generated dependencies remain outside the website’s actual dependency graph.
- `verify-example.mjs`: executable browser experiment. Observed results and screenshots are in ignored `artifacts/nudeps-research/`.

Angle: whether a small browser-native project can use npm libraries and CSS assets while retaining its source files and a useful static fallback. The two distinguishing findings are the tested strict-CSP failure and the entry-point requirement observed while pruning. This work evaluates Nudeps; it does not adopt it into TCL’s public site.

## Primary-source register

| Source | What was examined | Use and boundaries |
| --- | --- | --- |
| [Launch article](https://lea.verou.me/blog/2026/nudeps/) | November 19 announcement | Credit for the idea, scope and author’s stated lack of benchmarks. Its claims were not treated as our own test results. |
| [Earlier dependency essay](https://lea.verou.me/blog/2026/web-deps/) | January architecture discussion | Background on separating installation, resolution and delivery. No poll percentages or rhetorical claims reproduced in the draft. |
| [External-map explanation](https://lea.verou.me/blog/2026/external-import-maps-today/) | March loader technique | Ordering and relative-URL context. The draft uses the generated loader, not a copied implementation. |
| [Project README](https://github.com/nudeps/nudeps) | Setup and documented capabilities | Starting workflow. The published npm tarball, rather than possibly newer main-branch code, was used for experiments. |
| [How it works](https://nudeps.dev/how-it-works/) | Dependency graph and map generation | Architecture and JSPM relationship. The project’s competitor comparison was not adopted as an independent evaluation of JSPM. |
| [Configuration](https://nudeps.dev/config/) | Output ownership, root, modes, pruning, host integration | Guided the prod experiment and deployment cautions. Retrieved directly when browser search extraction returned a cache miss. |
| [Aliases](https://nudeps.dev/config/aliases/) | Unversioned asset URLs and host handling | Checked against actual Open Props CSS requests. |
| [Deployed files](https://nudeps.dev/config/files/) | Copying defaults and exclusion options | Prevents equating import-map pruning with per-export tree shaking or a minimal copied file set. |
| [FAQ](https://nudeps.dev/faq/) | npm scope, browser claims and CJS path | Source-reported limitations. Historical browser-version claims were not independently tested. |
| [Troubleshooting](https://nudeps.dev/troubleshooting/) | Entry points, Node assumptions and extensionless URLs | Compatibility context. No universal package-support claim. |
| [MDN import maps](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type/importmap) | Resolution, ordering and scope | Current document behavior. Worker support distinguished from document support. |
| [npm lifecycle scripts](https://docs.npmjs.com/cli/v11/using-npm/scripts/) | `dependencies`, `prepare` and installation | Official terminology; actual workflow tested on npm 10.9.9, not claimed tested on every npm version. |
| [MDN CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src) | Script policy, inline authorization | Explains our observed failure; nonce/hash alternatives are suggestions for review, not completed fixes. |
| [Color object](https://colorjs.io/docs/the-color-object) and [output](https://colorjs.io/docs/output) | Color.js API | Our application code and conversions were tested. This is not a color science or contrast conformance study. |
| [Worker discussion](https://github.com/whatwg/html/issues/8173) | Open platform issue | A document’s import map cannot simply be assumed to cover a worker. |
| [Stylesheet proposal](https://github.com/whatwg/html/issues/10673) | Proposed specifier-based stylesheet mechanisms | Context only. The draft uses ordinary stylesheet URLs, not proposed HTML attributes. |

Some docs returned extraction cache misses through search tooling but were retrieved successfully from the official site over HTTPS. No unavailable page was treated as read. Project demos were catalogued from the announcement; broad demo compatibility was not claimed.

## Version and implementation inspection

The npm registry reported Nudeps **0.4.4** during this run. Its package metadata identifies Lea Verou as author, MIT licensing and `https://github.com/nudeps/nudeps` as the repository. Versions are recorded in the example lockfile, including integrity values. The testing runtime was Node **22.23.5**, npm **10.9.9**, and the repository’s Playwright **1.59.1** browser installations on macOS.

Read from that release: package metadata, CLI/install code, configuration definitions, built-in mode rules, host adapters, map serialization and package copying. Noteworthy details:

- Setup writes `dependencies` and `prepare` hooks invoking the local binary directly; current code differs in that detail from examples that spell the hook as `npx nudeps`.
- Generated maps rebase addresses relative to the loader URL. We tested the resulting behavior on nested document URLs.
- Default generation serializes a map into a DOM-created inline script element; it did not attach a nonce in the inspected serialization path.
- Production mode enables pruning, terse map output and copied dependency directories. Unversioned asset aliases remain a separate concern.
- Alias-only direct dependencies can still be copied without a JavaScript map entry. Pruning the map is not a promise that all unused package files disappear.

A source package inspection is not a supply-chain security audit. The example does not change TCL’s root `package.json`, lockfile, dependency delivery or CSP.

## Experiment and observations

All browser checks used a server bound to `127.0.0.1`. Nothing was deployed publicly for this experiment.

| Case | Chromium | WebKit | Meaning |
| --- | --- | --- | --- |
| Root page, default generation | Enhanced palette works | Enhanced palette works | Bare import resolves to locally served package files |
| Nested `/nested/page/` document | Works | Works | One root-referenced loader supports the tested nested page |
| Open Props CSS alias | Token resolves; grid gap is 20px | Same | CSS delivery works through an ordinary URL |
| Range keyboard interaction | Hex values change | Hex values change | Dependency executes and enhancement is keyboard operable |
| 320px viewport | No horizontal overflow | No horizontal overflow | Original layout reflows at the tested width |
| JavaScript disabled | Three static swatches and disabled slider | Same | Failure leaves explanatory content and a preview |
| Strict `default-src 'self'` | Default map blocked; enhancement unavailable | Same | Default generated injector needs a CSP-aware integration |
| Production-pruned output, declared `main` | Works | Works | Tested prod artifact remains functional |
| Runtime origins | Only the lab origin | Only the lab origin | No third-party runtime request observed in these runs |

Additional installation checks:

- A fresh project install created the map and versioned directories. The site’s own dependencies were untouched.
- `npm ci` in a clean copy regenerated output through the installed hooks.
- `npm install nanoid@5.1.6` added the temporary package mapping and alias without a manual Nudeps run. `npm uninstall nanoid` removed them.
- With no `main` pointing at the example module, `nudeps --mode prod` produced zero map entries. With `"main": "main.js"`, the same mode produced two map entries and passed the browser checks. This is an observed fixture result, not a claim that every application should use a single `main` entry.
- The CSS-only alias path remained usable in the production experiment.

No cross-bundler timing benchmark, real-device Safari/Firefox session, CJS matrix, workspace matrix, Windows alias test, hosted alias deployment or CSP remediation was performed. Tests on Playwright WebKit do not constitute a Safari-version support matrix.

## Publishing review

The article is a draft. Before release, choose a real byline if desired, prepare the required unique article artwork, and verify any later Nudeps version against the recorded tests. Add deliberate SEO metadata and an appropriate future front-end-tooling reading path if that topic grows; do not create a thin new topic hub just for this draft.

The article openly records the strict-CSP limitation and does not suggest weakening the existing production policy. A future adoption project should test a CSP-compatible map strategy and the exact build/output lifecycle separately.

The authoring JSON is the native site draft. The Markdown is a human-readable snapshot of the same body. Registered in Editorial Studio on November 20, 2026 after a coordinated refresh of the idle local app. The previous Studio state was backed up, existing drafts were preserved, and the actual Drafts card and formatting preview were verified. All eight code examples render and live publication remains unapproved.

## Capability and alternative notes

These are source-reported capabilities unless marked tested above:

- Browser ESM is the primary path. Dynamic imports, `import.meta.resolve()`, npm aliases and Git dependencies are listed by the project, but were not independently exercised here. CommonJS uses a separate shim and remains an experimental compatibility path.
- [Local dependencies](https://nudeps.dev/local-deps/) can be linked. Their dependency-change propagation uses registration and notification hooks. `wireLocalDeps` is explicit consent to edit those other package files; this research did not enable it or touch another repository.
- [npm workspaces](https://nudeps.dev/workspaces/) require root-level hook coordination and the shared lockfile. The launch article calls workspaces experimental. We did not extrapolate our single-package fixture into a monorepo guarantee.
- The official FAQ currently scopes package-manager support to npm. No pnpm, Yarn or Bun installation was tested.

Do not describe Nudeps as the only route to self-hosted import maps. [JSPM Generator’s own documentation](https://jspm.org/docs/generator/) includes a `nodemodules` provider and custom providers. Nudeps packages a particular install-time workflow around that lower-level functionality. A hand-written map may be reasonable for a very small dependency surface; a larger graph adds maintenance. An existing bundler can also remain a deliberate choice when its transformations or optimization pipeline are useful. These are architectural considerations, not comparative benchmark results.

Proposed search presentation for eventual publication: **Nudeps Tutorial: npm Imports and CSS Assets Without a Bundler**. Description: **Use Nudeps with native browser modules, Color.js and Open Props. Explore a tested example, production pruning and a strict-CSP integration constraint.** These are editorial suggestions; no indexable route or metadata entry was published for the draft.
