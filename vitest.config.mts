import { defineConfig } from 'vitest/config'

// Unit tests live next to the code they test: foo.ts -> foo.test.ts.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
