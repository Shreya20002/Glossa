import { defineConfig } from 'vitest/config'

// The benchmark runs with Vitest only because Vitest already runs TypeScript.
// It isn't part of `pnpm test`: it downloads audio and runs the real models,
// which takes a minute or two. Run it with `pnpm eval`.
export default defineConfig({
  test: {
    include: ['eval/**/*.eval.ts'],
    environment: 'node',
    // Print the report as it's written, and keep it readable.
    silent: false,
    reporters: ['default'],
  },
})
