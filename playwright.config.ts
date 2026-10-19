import { defineConfig } from '@playwright/test'

// End-to-end tests: Playwright launches the real Glossa app (Electron), clicks
// through it like a user, and checks what appears on screen.
// Run with `pnpm test:e2e`. Docs: https://playwright.dev/docs/api/class-electron
export default defineConfig({
  testDir: 'e2e',
  // A session test listens to ~20 seconds of audio, so allow plenty of time.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // One retry in CI absorbs the occasional slow runner; locally, fail fast.
  retries: process.env['CI'] ? 1 : 0,
  // Only one Glossa can run at a time (single-instance lock).
  workers: 1,
  // In CI, 'github' also turns failures into annotations on the PR.
  reporter: process.env['CI'] ? [['list'], ['github'], ['html', { open: 'never' }]] : 'list',
  outputDir: 'test-results',
})
