# A small color desk

Original companion example for the draft Nudeps article. This is a separate research project, not a dependency change to The Cascade Lounge.

Tested versions: Node 22.23.5, npm 10.9.9, Nudeps 0.4.4, Color.js 0.7.1, Open Props 1.7.23.

From this directory:

```sh
npm ci
npm start
```

The server prints a loopback URL. `/nested/page/` serves the same HTML to exercise nested document URLs. npm hooks generate `importmap.js` and `client_modules/`; those outputs and `node_modules/` are ignored. Do not open the page with `file://`.

The application uses a bare JavaScript import and a regular CSS link through an unversioned Open Props alias. Static swatches remain visible without JavaScript. Color.js calculates hex strings; the UI makes no contrast claim and uses no animation.

To generate the tested production preset:

```sh
npx nudeps --mode prod
```

The included `main` field makes `main.js` a traceable package entry. Validate all required entry points for a larger application. This command prunes the map; it is not a promise of tree shaking or a minimum copied file set.

From the TCL repository root, browser verification uses the already-installed Playwright dependency:

```sh
node docs/research/nudeps/verify-example.mjs
```

For the isolated research installation instead, pass its path as the first argument. The verifier starts temporary loopback servers, checks Chromium and WebKit, writes results to `artifacts/nudeps-research/`, and stops its servers.

**Known constraint:** the default generated import-map injector fails under the strict CSP used by the verifier. That failure is an expected research result. The example does not loosen TCL’s production CSP or implement a hash/nonce-based alternative. Hosting integration and performance benchmarking remain separate work.
