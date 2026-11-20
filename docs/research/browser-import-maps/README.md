# Original browser import-map tutorial

This replaces the earlier Nudeps-focused draft. It is an independently written tutorial built around the local `makePalette()` module in `example/lib/palette.js`. It contains no third-party quotations, testimonials, launch narrative, external source section or first-person account attributed to the site owner.

The example and verification were prepared with AI assistance; that fact is stated in the draft. Browser import maps are an existing web-platform feature, and the tutorial claims no ownership of that feature or of another developer’s work.

Run from the repository root:

```sh
node docs/research/browser-import-maps/example/serve.mjs
node docs/research/browser-import-maps/verify-example.mjs
```

The first command prints a temporary loopback URL. The second uses the repository’s installed Playwright and axe dependencies, runs checks, closes its servers and writes results under ignored `artifacts/browser-import-maps/`.

No npm installation is needed for the example itself. Its files are original code prepared for this tutorial. The local server computes a CSP hash from the exact inline-map text. A real deployment needs a corresponding header integration; this server is not a production hosting recommendation.

`article.md` is the readable snapshot. The native JSON draft under `content/authored/` is the editable site record. Both remain unpublished. The earlier Nudeps research remains background material rather than the article’s text or narrative structure.
