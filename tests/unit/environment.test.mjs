import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEnvironment } from '../../src/build/environment.mjs';

test('Vercel production uses the stable production domain, not a deployment URL', () => {
  assert.deepEqual(buildEnvironment({
    VERCEL_ENV: 'production',
    VERCEL_PROJECT_PRODUCTION_URL: 'lounge.example',
    VERCEL_URL: 'lounge-random-deployment.vercel.app',
  }), { publishing: true, siteUrl: 'https://lounge.example' });
});

test('Netlify production continues using its production origin', () => {
  assert.deepEqual(buildEnvironment({ CONTEXT: 'production', URL: 'https://lounge.example' }), {
    publishing: true, siteUrl: 'https://lounge.example',
  });
});

test('An explicit canonical origin takes precedence on either host', () => {
  for (const env of [
    { VERCEL_ENV: 'production', VERCEL_PROJECT_PRODUCTION_URL: 'lounge.vercel.app' },
    { CONTEXT: 'production', URL: 'https://lounge.netlify.app' },
  ]) {
    assert.equal(buildEnvironment({ ...env, TCL_SITE_URL: 'https://lounge.example' }).siteUrl, 'https://lounge.example');
  }
});

test('Local, preview, and custom staging builds remain unpublished', () => {
  for (const env of [
    {},
    { CONTEXT: 'deploy-preview', URL: 'https://lounge.netlify.app' },
    { VERCEL_ENV: 'preview', VERCEL_PROJECT_PRODUCTION_URL: 'lounge.example' },
    { VERCEL_ENV: 'production', VERCEL_TARGET_ENV: 'staging', VERCEL_PROJECT_PRODUCTION_URL: 'lounge.example' },
  ]) {
    assert.deepEqual(buildEnvironment(env), { publishing: false, siteUrl: null });
  }
});

test('Production fails without a stable canonical origin', () => {
  for (const env of [{ CONTEXT: 'production' }, { VERCEL_ENV: 'production', VERCEL_URL: 'random.vercel.app' }]) {
    assert.throws(() => buildEnvironment(env), /requires its canonical site URL/);
  }
});

test('Canonical origins reject HTTP, credentials, paths, queries, and fragments', () => {
  for (const siteUrl of ['http://lounge.example', 'https://user:secret@lounge.example', 'https://lounge.example/articles/', 'https://lounge.example/?q=css', 'https://lounge.example/#intro']) {
    assert.throws(() => buildEnvironment({ CONTEXT: 'production', TCL_SITE_URL: siteUrl }), /HTTPS site origin/);
  }
});
