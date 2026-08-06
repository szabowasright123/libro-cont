import { defineConfig, devices } from '@playwright/test'

// E2E con Playwright. Levanta el preview del build de producción local (sin red externa).
// El build usa la base de GitHub Pages ('/libro-cont/'), así que la baseURL la incluye.
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173/libro-cont/',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173/libro-cont/',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
