# Deployment

## Build contract

- Install dependencies with `npm ci`.
- Build and validate with `npm run verify`.
- Publish the generated `dist/` directory.
- Use Node 22, matching `package.json`, `.nvmrc`, and `netlify.toml`.

## Vercel

The existing `thecascadelounge` Vercel project tracks `noahcg/thecascadelounge` on GitHub, which Vercel copied from the original project during import. This checkout keeps `origin` pointing to `noahcg/TCL` and a `vercel` remote pointing to the connected deployment repository. Their histories were joined without removing either initial commit. Push accepted changes to both destinations:

```sh
git push origin main
git push vercel main
```

The second push triggers Vercel production deployment. For a new checkout, add the deployment remote with `git remote add vercel https://github.com/noahcg/thecascadelounge.git`. Use `main` as the production branch and the repository root as the root directory. The connected source can be inspected under **Settings → Git**.

The [private editorial studio](editorial-studio.md#approve-and-publish-live) can prepare, check, and publish an individual approved content update through these same remotes. Use **Review live publication**, inspect the release, and click **Approve & publish live**. It commits only the approved content and artwork while preserving unrelated local edits.

The checked-in [Vercel configuration](../vercel.json) sets **Other** as the framework, installs with `npm ci`, runs `npm run verify`, and publishes `dist/`. It also retains trailing-slash URLs and defines the site’s response headers. The output directory is explicitly configured because Vercel’s default `public/` directory does not match this build.

Production builds recognize Vercel’s environment and use its stable `VERCEL_PROJECT_PRODUCTION_URL` hostname for canonicals and the sitemap. Set `TCL_SITE_URL` to override the canonical origin when needed. Preview and custom staging builds remain noindex. Vercel serves the generated `404.html` for missing files; avoid a catch-all rewrite to the homepage.

## Netlify

The checked-in [Netlify configuration](../netlify.toml) defines the build command, publish directory, content security policy, and other response headers. Connect the Git repository to the intended Netlify project and enable pull-request Deploy Previews.

## Configuration

| Variable | Purpose |
| --- | --- |
| `CONTEXT` | `production` enables production canonical URLs and sitemap generation; Netlify sets this automatically |
| `VERCEL_ENV` | Vercel sets `production`, `preview`, or `development`; production enables canonicals and sitemap generation |
| `VERCEL_TARGET_ENV` | Vercel target environment; custom staging environments stay noindex |
| `VERCEL_PROJECT_PRODUCTION_URL` | Stable production hostname supplied by Vercel, without `https://` |
| `TCL_SITE_URL` | Optional explicit production HTTPS origin, such as `https://your-domain.example` |
| `URL` | Netlify’s production origin, used when `TCL_SITE_URL` is unset |
| `PORT` | Local preview port; defaults to 4173 |

A production build requires a valid HTTPS origin. `TCL_SITE_URL` must be an origin without a path, query, or fragment. It takes precedence over either host’s default production origin. Set variables in the hosting environment or shell; the scripts do not automatically load `.env` files. [.env.example](../.env.example) provides comments for local configuration.

Local and preview builds emit `noindex, follow` metadata and omit production canonicals and the sitemap. To check production output locally, substitute the intended origin:

```sh
CONTEXT=production TCL_SITE_URL=https://your-domain.example npm run verify
npm run preview
```

Run `npm run build` afterward to return to a normal local preview.

## Web Analytics

Vercel Web Analytics is enabled for `thecascadelounge`. The pinned `@vercel/analytics` browser SDK is copied into the static assets with its license, and the shared template loads `/assets/analytics.js` on every public page in Vercel production builds. It calls the package’s `inject()` function and uses the same-origin `/_vercel/insights/` routes, compatible with the existing content security policy.

Local development, Vercel previews, Netlify builds, and the private admin studio do not load the analytics module. HTTPS is also required before injection, keeping an exported production build quiet on the local HTTP preview server. View traffic in [the project’s Analytics dashboard](https://vercel.com/noahcgs-projects/thecascadelounge/analytics).

## Release checks

Run `npm run verify:all` on the candidate revision. Review the deployed preview at desktop and phone widths, including direct entry to a long article and section link, snippet copy, search, Quick Wins filters, resource links, and an unknown URL returning HTTP 404. Check keyboard access and relevant accessibility behavior.

Confirm the production hostname, canonical URLs, sitemap, HTTPS, and response headers at the actual hosting origin. Keep private exports, credentials, and local artifacts out of the published directory. Promote the reviewed revision and retain the previous successful deployment.

## Rollback

Redeploy the previous accepted build in the hosting provider. Repeat direct URL, section-link, 404, and search smoke checks. For a content migration, restore the previous reviewed snapshot in Git and rebuild; the [migration guide](apex-migration.md) explains import review and source parity.
