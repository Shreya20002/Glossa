import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'

// electron-vite builds three bundles, one per Electron process:
//   main     -> out/main     (src/main/index.ts)
//   preload  -> out/preload  (src/preload/index.ts)
//   renderer -> out/renderer (one HTML page per window under src/renderer/)
// Docs: https://electron-vite.org/config/
export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    plugins: [react()],
    build: {
      rolldownOptions: {
        input: {
          app: resolve('src/renderer/app/index.html'),
        },
      },
    },
  },
})
