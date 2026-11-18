# Deployment

## Build contract

- Install dependencies with `npm ci`.
- Build and validate with `npm run verify`.
- Publish the generated `dist/` directory.
- Use Node 22, matching `.nvmrc` and `netlify.toml`.

The checked-in [Netlify configuration](../netlify.toml) defines the build command, publish directory, content security policy, and other response headers. Connect the Git repository to the intended Netlify project and enable pull-request Deploy Previews.

## Configuration

| Variable | Purpose |
| --- | --- |
| `CONTEXT` | `production` enables production canonical URLs and sitemap generation; Netlify sets this automatically |
| `TCL_SITE_URL` | Optional explicit production HTTPS origin, such as `https://your-domain.example` |
| `URL` | Netlify’s production origin, used when `TCL_SITE_URL` is unset |
| `PORT` | Local preview port; defaults to 4173 |

A production build requires a valid HTTPS origin. `TCL_SITE_URL` must be an origin without a path, query, or fragment. Netlify should use `TCL_SITE_URL` when the canonical custom domain differs from its `URL` value. Set variables in the hosting environment or shell; the scripts do not automatically load `.env` files. [.env.example](../.env.example) provides comments for local configuration.

Local and preview builds emit `noindex, follow` metadata and omit production canonicals and the sitemap. To check production output locally, substitute the intended origin:

```sh
CONTEXT=production TCL_SITE_URL=https://your-domain.example npm run verify
npm run preview
```

Run `npm run build` afterward to return to a normal local preview.

## Release checks

Run `npm run verify:all` on the candidate revision. Review the deployed preview at desktop and phone widths, including direct entry to a long article and section link, snippet copy, search, Quick Wins filters, resource links, and an unknown URL returning HTTP 404. Check keyboard access and relevant accessibility behavior.

Confirm the production hostname, canonical URLs, sitemap, HTTPS, and response headers at the actual hosting origin. Keep private exports, credentials, and local artifacts out of the published directory. Promote the reviewed revision and retain the previous successful deployment.

## Rollback

Redeploy the previous accepted build in the hosting provider. Repeat direct URL, section-link, 404, and search smoke checks. For a content migration, restore the previous reviewed snapshot in Git and rebuild; the [migration guide](apex-migration.md) explains import review and source parity.
