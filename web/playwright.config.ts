import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:4300' },
  webServer: {
    command: 'npx ng serve --host 127.0.0.1 --port 4300',
    url: 'http://127.0.0.1:4300',
    reuseExistingServer: !process.env.CI,
    timeout: 180000,
  },
});
