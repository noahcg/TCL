import { assert, sourceUrl } from './content.mjs';

export function buildEnvironment(env = process.env) {
  const publishing = (env.VERCEL_TARGET_ENV || env.VERCEL_ENV || env.CONTEXT) === 'production';
  const platformUrl = env.VERCEL_ENV
    ? env.VERCEL_PROJECT_PRODUCTION_URL && `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
    : env.URL;
  const siteUrl = env.TCL_SITE_URL || (publishing ? platformUrl : null);

  if (siteUrl) assert(sourceUrl(siteUrl) && new URL(siteUrl).origin === siteUrl.replace(/\/$/, ''), 'TCL_SITE_URL must be an HTTPS site origin');
  if (publishing) assert(siteUrl, 'The production build requires its canonical site URL');

  return { publishing, siteUrl };
}
