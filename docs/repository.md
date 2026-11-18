# Repository organization

Source, editorial inputs, scripts, tests, and current documentation have explicit homes. Generated files and local evidence are separated so a first Git commit stays focused on reproducible product inputs.

## Git boundaries

Commit `src/`, `content/`, `scripts/`, `tests/`, `docs/`, `.github/`, the root guides, package files, and root configuration. The reviewed public legacy snapshot is a required build input and belongs in Git. New authored content belongs in `content/authored/`.

`.gitignore` excludes installed dependencies (`node_modules/`), generated deployment output (`dist/`), test reports/coverage, local environment files and keys, import lock/temp files, OS/editor/Python caches, and all of `artifacts/`. `.env.example` is explicitly included. Git line endings and binary asset handling are defined in `.gitattributes`.

## Local artifacts

| Directory | Contents | Retention |
| --- | --- | --- |
| `artifacts/handoffs/` | Original design bundles, ZIPs, screenshots, reports, and verification notes | Preserve locally; back up separately from Git |
| `artifacts/migration/` | Private source exports, capture candidates, repeat-check evidence, optional virtual environment | Preserve locally; back up separately from Git |
| `artifacts/test-results/` | Playwright traces and failure artifacts | Recreated by tests; removed by `npm run clean` |
| `artifacts/playwright-report/` | Playwright HTML report | Recreated by tests; removed by `npm run clean` |

Historical handoffs and migration evidence were moved intact. Their exclusion from Git means a clone will not contain these local archives. Current runtime assets are already under `src/assets/`, while the original design brief Markdown is also retained in `docs/archive/design-briefs/` for versioned reference.

## Reorganization map

| Previous path | Current path |
| --- | --- |
| `lib/` | `src/build/` |
| `sources/watercooler/` | `content/imported/watercooler/` |
| `scripts/import-apex.mjs` | `scripts/migration/import-apex.mjs` |
| `scripts/capture-apex.mjs` | `scripts/migration/capture-apex.mjs` |
| `scripts/export-apex.py` | `scripts/migration/export-apex.py` |
| `test/*.test.mjs` | `tests/unit/*.test.mjs` |
| `test/browser/` | `tests/browser/` |
| `CODEX-BUILD-PROMPT.md` | `docs/archive/initial-build-prompt.md` |
| `docs/implementation-plan.md` | `docs/archive/implementation-plan.md` |
| `docs/reference/` | `docs/archive/reference/` |
| `handoff/` | `artifacts/handoffs/` |
| `.migration/` | `artifacts/migration/` |
| `test-results/` | `artifacts/test-results/` |

Historical documents preserve their original wording, paths, and assumptions. Use the current [README](../README.md), [architecture](architecture.md), and [deployment guide](deployment.md) for the active implementation. All published URLs and browser asset names remain stable.

Only generated OS/Python caches were discarded during the source reorganization. `npm run clean` removes explicitly named generated outputs and preserves migration files and handoffs. Reinstall dependencies with `npm ci` and regenerate the site with `npm run build` when needed.
