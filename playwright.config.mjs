import { defineConfig } from '@playwright/test';

const widths = [375, 768, 1024, 1440];

export default defineConfig({
  testDir: './tests/browser',
  outputDir: 'output/playwright',
  workers: 2,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    permissions: ['clipboard-read', 'clipboard-write'],
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: widths.map((width) => ({
    name: `chromium-${width}`,
    use: {
      browserName: 'chromium',
      viewport: { width, height: width === 375 ? 812 : 900 },
    },
  })),
  webServer: {
    command: 'npm run build:web && python3 -m http.server 4173 --bind 127.0.0.1 --directory dist',
    port: 4173,
    reuseExistingServer: false,
  },
});
