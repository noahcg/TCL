# Contributing

## Local setup

Run commands from the repository root with Node.js 22 (22.12 or newer within 22.x). `.nvmrc` selects Node 22 for nvm users and CI.

```sh
npm ci
npx playwright install chromium webkit
npm run dev
```

The preview builds once before serving. After an edit, run `npm run build` in another terminal and refresh. `npm run preview` serves an existing `dist/` build. Browser tests start and stop their own server on port 8869; keep that port available.

## Make a change

Edit browser assets in `src/assets/` and build logic in `src/build/`. Keep command entry points in `scripts/`. Add editorial records under `content/authored/` using the [authoring guide](docs/authoring.md). Refresh imported material through the [migration runbook](docs/apex-migration.md) so its integrity seal remains valid.

Use UTF-8, LF line endings, and two-space indentation for JavaScript/JSON; Python uses four spaces. `.editorconfig` and `.gitattributes` record these conventions. Preserve the existing compact CSS style when editing its rules. Commit dependency changes together with `package-lock.json`.

## Verify

```sh
npm run verify:all
```

This checks the published snapshot, unit tests, static build, and Chromium/mobile WebKit flows. Existing tests cover code fidelity, deep links, navigation, search, filters, keyboard actions, accessibility scans, and narrow-screen reflow. Browser tests build fresh output automatically, including after `npm run clean`.

Review representative pages at phone and desktop sizes and exercise relevant keyboard interactions. Add tests for changed behavior where useful. Open the browser report with `npx playwright show-report artifacts/playwright-report` when diagnosing a failure. Linux environments can install browser prerequisites with `npx playwright install --with-deps chromium webkit`.

`npm run clean` removes `dist/`, generated test results/reports, and coverage. Historical handoffs and private migration data remain in `artifacts/`.

## Prepare the first Git commit

The directory is ready for initialization. Review the [repository boundaries](docs/repository.md) first, including the locally preserved archives excluded from Git.

```sh
git init -b main
git add .
git status --short
git diff --cached --stat
git diff --cached --check
git commit -m "Set up The Cascade Lounge static site"
```

The initial commit should include source, reviewed public content, documentation, configuration, tests, and the lockfile. Git ignores installed dependencies, generated output, local environment files, migration scratch data, and bulky historical handoffs. `.env.example` documents configuration without credentials. `.github/workflows/verify.yml` runs on pull requests and pushes to `main` once the repository is hosted on GitHub.

Use short-lived branches for subsequent changes and include the reason, preview evidence, and verification results in pull requests. Follow the [deployment guide](docs/deployment.md) for releases.
