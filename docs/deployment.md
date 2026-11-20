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
| `TCL_GA_MEASUREMENT_ID` | Public GA4 ID; defaults to `G-6XZZLW4VFL` in production. Set an empty value to disable GA4 |
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

GA4 uses measurement ID `G-6XZZLW4VFL` by default in production on Vercel and Netlify. Override it with `TCL_GA_MEASUREMENT_ID`, or set that variable to an empty string to disable GA4. The shared layout includes `/assets/analytics.js` once per public page. After checking the site's saved analytics preference, the module queues consent and configuration before asynchronously loading `gtag.js`. No package, inline executable script, or blocking request is added. Hosting and local-preview content security policies allow Google's documented analytics script and collection endpoints without enabling inline scripts or eval.

Navigation uses ordinary document loads, so a single `gtag('config', ...)` sends the automatic `page_view` for each page, including direct article entries, search, reloads, and missing pages. There are no manual `page_view` calls or History API wrappers. In the GA4 web stream, keep **Page loads** enabled and disable **Page changes based on browser history events** under **Admin → Data streams → Web → Enhanced measurement → Page views → Show advanced settings**. Quick Wins and Resources update query parameters with `replaceState` while filtering; these are not new pages. Google controls that enhanced history measurement in the property, independently of the site's config; see [Google's pageview guide](https://developers.google.com/analytics/devguides/collection/ga4/views).

The existing Vercel Web Analytics integration remains enabled only for Vercel production. Its pinned browser SDK and license are copied to the static assets, and `inject()` continues to use same-origin `/_vercel/insights/` routes. View traffic in [the project's Analytics dashboard](https://vercel.com/noahcgs-projects/thecascadelounge/analytics).

Local development, preview/staging builds, and the private admin studio do not load analytics. HTTPS is also required, keeping an exported production build quiet on the local HTTP preview server. The existing site uses an analytics opt-out rather than a consent banner. Both providers honor `va-disable`, Global Privacy Control, and Do Not Track; excluded browsers make no initial Google tag or Vercel SDK requests. GA4 advertising storage, advertising user data, personalization consent, and Google signals remain disabled. If the site later adds a consent manager, it must gate initialization before loading either provider.

For a production smoke check after deployment, open a browser with analytics allowed, visit the homepage, follow an article link, and check GA4 Realtime/DebugView and the network panel for one `page_view` per document. Use Tag Assistant for DebugView without enabling debug mode for all visitors. Test `?analytics=off`, subsequent visits, and `?analytics=on`. Automated tests intercept Google requests and verify configuration under the actual CSP without recording test visits in the live property.

## Release checks

Run `npm run verify:all` on the candidate revision. Review the deployed preview at desktop and phone widths, including direct entry to a long article and section link, snippet copy, search, Quick Wins filters, resource links, and an unknown URL returning HTTP 404. Check keyboard access and relevant accessibility behavior.

Confirm the production hostname, canonical URLs, sitemap, HTTPS, and response headers at the actual hosting origin. Keep private exports, credentials, and local artifacts out of the published directory. Promote the reviewed revision and retain the previous successful deployment.

## Rollback

Redeploy the previous accepted build in the hosting provider. Repeat direct URL, section-link, 404, and search smoke checks. For a content migration, restore the previous reviewed snapshot in Git and rebuild; the [migration guide](apex-migration.md) explains import review and source parity.

## Exclude your own browser from Web Analytics

Open `https://www.thecascadelounge.com/?analytics=off` once in each browser profile you use. The production analytics loader saves `va-disable=1` in local storage, shows confirmation, and removes the helper parameter from the URL before either provider initializes. It skips GA4 and Vercel Analytics on that visit and subsequent visits on the same origin. A Vercel `beforeSend` filter also drops events if the preference is enabled after initialization. GA4's disable flag and consent update stop an already loaded tag when a storage event announces exclusion from another tab.

Use `?analytics=on` to include that browser again. Preferences are per browser/profile and origin; clearing site storage removes them, and private windows need their own opt-out. Historical analytics remain unchanged. If storage is unavailable, the explicit opt-out suppresses the current visit and displays that it could not be saved. Local and preview builds never load analytics.
