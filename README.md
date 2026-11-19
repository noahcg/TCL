# The Cascade Lounge

A static CSS publication with articles, Quick Wins, curated resources, and local search. Node.js generates complete HTML pages, a search index, and self-hosted assets into `dist/`. The deployed site runs as static files.

## Get started

Use Node.js 22 (22.12 or newer within the 22.x release line). The project’s package engines, `.nvmrc`, CI, and hosting configuration target Node 22.

```sh
# If you use nvm:
nvm install
nvm use

npm ci
npm run dev
```

Open `http://127.0.0.1:4173/`. Set `PORT` to use another port, for example `PORT=4180 npm run dev`. The command builds once and starts a local server; rebuild after editing source files, then refresh the browser.

## Project structure

```text
content/
  authored/              New editorial records, one JSON file per item
  imported/watercooler/   Reviewed legacy publication snapshot
src/
  assets/                Browser CSS, JavaScript, images, and icons
  build/                 Content validation, HTML templates, highlighting
scripts/
  migration/             Optional APEX capture, export, and import tools
  build.mjs              Static-site build entry point
  clean.mjs              Generated-output cleanup
  serve.mjs              Local static preview server
desktop/                 Mac Editorial Studio app shell and separate dependency lockfile
tests/
  unit/                  Content integrity and rendering tests
  browser/               Chromium and mobile WebKit interaction/a11y tests
docs/                    Architecture, publishing, migration, and history
.github/                 Verification workflow and pull request template
dist/                    Generated deployable site (ignored by Git)
artifacts/               Local handoffs, migration data, test output (ignored)
```

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Build and serve locally |
| `npm run build` | Regenerate `dist/` |
| `npm run preview` | Serve the existing build |
| `npm run admin` | Open the private local CSS research and drafting studio |
| `npm run desktop:setup` | Prepare the bundled runtime and install desktop dependencies |
| `npm run desktop:package` | Build the Mac Editorial Studio app |
| `npm run desktop:install` | Install the app, pin it to the Dock, and launch it |
| `npm test` | Run unit tests |
| `npm run test:browser` | Build, start a test server, and run browser checks |
| `npm run verify` | Verify the content snapshot, run unit tests, and build |
| `npm run verify:all` | Run all verification, including browser checks |
| `npm run clean` | Remove generated build and test output |
| `npm run images:plan` | Inspect title-based artwork prompts and cache status |
| `npm run content:prepare` | Generate missing artwork and verify content before publishing |

Install the test browsers once with `npx playwright install chromium webkit`. Browser checks use port 8869 and save reports under `artifacts/`. Run project commands from this directory.

## Working on the project

- [Contributing](CONTRIBUTING.md): setup, validation, and preparing the first Git commit.
- [Architecture](docs/architecture.md): build flow, source boundaries, routes, and assets.
- [Authoring](docs/authoring.md): adding and publishing content.
- [Editorial studio](docs/editorial-studio.md): private web research, AI drafts, and local publishing.
- [Article images](docs/article-images.md): unique AI hero artwork, publishing automation, and social cards.
- [Deployment](docs/deployment.md): Vercel and Netlify configuration, production metadata, and rollback.
- [Repository organization](docs/repository.md): file moves, Git exclusions, and local archives.
- [APEX migration](docs/apex-migration.md): refreshing the reviewed legacy snapshot.
- [Historical references](docs/archive/README.md): original briefs, brand notes, and roadmap.

Search uses a pinned build-time copy of [MDN Data](https://github.com/mdn/data). Newsreader, DM Sans, and MDN Data license notices are copied into the published assets. Application dependencies stay pinned in `package-lock.json`.
