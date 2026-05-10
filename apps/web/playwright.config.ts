import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'on-first-retry'
  },
  webServer: {
    command: 'pnpm exec next dev -H 127.0.0.1 -p 3100',
    cwd: process.cwd(),
    timeout: 120000,
    reuseExistingServer: true,
    env: {
      NEXT_PUBLIC_API_BASE_URL: 'http://127.0.0.1:3100/api'
    }
  }
});
