import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'

// electron-vite builds three bundles, one per kind of Electron process:
//   main     -> out/main     (src/main/index.ts, plus the engine: src/engine/index.ts)
//   preload  -> out/preload  (src/preload/index.ts)
//   renderer -> out/renderer (one HTML page per window under src/renderer/)
// Docs: https://electron-vite.org/config/
export default defineConfig({
  main: {
    build: {
      rolldownOptions: {
        input: {
          index: resolve('src/main/index.ts'),
          // The engine runs in its own process; see src/main/engine.ts.
          engine: resolve('src/engine/index.ts'),
        },
      },
    },
  },
  preload: {},
  renderer: {
    plugins: [react()],
    build: {
      rolldownOptions: {
        input: {
          app: resolve('src/renderer/app/index.html'),
          overlay: resolve('src/renderer/overlay/index.html'),
        },
      },
    },
  },
})
