import { defineConfig, devices } from '@playwright/test';

const testPortValue = process.env.PLAYWRIGHT_PORT ?? '5174';
const testPort = /^\d+$/.test(testPortValue) ? Number(testPortValue) : Number.NaN;
if (!Number.isInteger(testPort) || testPort < 1 || testPort > 65_535) throw new Error('PLAYWRIGHT_PORT must be a valid TCP port');
const testBaseUrl = `http://127.0.0.1:${testPort}`;

export default defineConfig({
  testDir: './tests/visual',
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  reporter: 'line',
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      threshold: 0.18,
    },
  },
  use: {
    ...devices['Desktop Chrome'],
    baseURL: testBaseUrl,
    deviceScaleFactor: 1,
    locale: 'de-DE',
    serviceWorkers: 'block',
    timezoneId: 'Europe/Berlin',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
  webServer: {
    command: `env -u VITE_USE_MOCK_API npm run dev -- --host 127.0.0.1 --port ${testPort} --strictPort`,
    url: testBaseUrl,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
