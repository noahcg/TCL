import { rm } from 'node:fs/promises';

// Migration exports and historical handoffs are irreplaceable local inputs.
// Only these explicitly named, reproducible outputs may be cleaned.
for (const path of ['dist/', 'artifacts/test-results/', 'artifacts/playwright-report/', 'coverage/']) {
  await rm(new URL(`../${path}`, import.meta.url), { recursive: true, force: true });
}
console.log('Removed generated build and test output.');
