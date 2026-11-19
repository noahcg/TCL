import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://127.0.0.1:8869';
const browsers = [
  { name: 'Chromium', use: devices['Desktop Chrome'] },
  { name: 'WebKit mobile', use: devices['iPhone 13'] },
];
export default defineConfig({
  testDir: 'tests/browser',
  outputDir: 'artifacts/test-results',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'artifacts/playwright-report', open: 'never' }],
  ],
  fullyParallel: true,
  projects: browsers,
  use: { baseURL, trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run dev',
    env: { PORT: '8869', TCL_HOMEPAGE_MONTH: '2026-11' },
    url: baseURL,
    reuseExistingServer: false,
    timeout: 20_000,
  },
});
