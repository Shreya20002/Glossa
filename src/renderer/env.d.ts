/// <reference types="vite/client" />

import type { GlossaApi } from '../shared/ipc'

declare global {
  interface Window {
    /** Exposed by src/preload/index.ts. The only way a window talks to Electron. */
    glossa: GlossaApi
  }
}
